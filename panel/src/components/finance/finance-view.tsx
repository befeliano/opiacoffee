"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { deleteExpenseAction, saveExpenseAction } from "@/app/(panel)/[cafe]/finans/actions";
import { BarList } from "@/components/charts/bar-list";
import { ChartCard, LegendItem, VIZ } from "@/components/charts/chart-kit";
import { ColumnChart } from "@/components/charts/column-chart";
import { StatTile } from "@/components/reports/stat-tile";
import { Button } from "@/components/ui/button";
import { Field, Input, NumberInput, Select } from "@/components/ui/field";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Badge, Card, CardHeader, EmptyState, Segmented } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import type { Expense, ExpenseCategory, ReportData } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { EXPENSE_CATEGORIES, expensesForMonth } from "@/lib/domain/expenses";
import { change, fillDays, totalsOf } from "@/lib/domain/report";
import { addDays, daysInMonth, diffDays, formatDateShortTr, formatDateTr, monthEnd, monthStart, MONTHS_TR } from "@/lib/domain/time";
import { pct, tl, currencySymbol } from "@/lib/format";

export function FinanceView({
  cafeId,
  slug,
  month,
  today,
  expenses,
  report,
  previous,
}: {
  cafeId: string;
  slug: string;
  month: string;
  today: string;
  expenses: Expense[];
  report: ReportData;
  previous: ReportData;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Expense | "new" | null>(null);

  const end = monthEnd(month) < today ? monthEnd(month) : today;
  const days = fillDays(report.daily, month, end);
  const t = totalsOf(days);
  const p = totalsOf(previous.daily);
  const exp = expensesForMonth(expenses, month);
  const prevExp = expensesForMonth(expenses, addDays(month, -1));
  const isCurrent = month === monthStart(today);
  const elapsed = diffDays(month, end) + 1;
  const total = daysInMonth(month);

  const net = t.grossProfit - exp.total;
  const prevNet = p.grossProfit - prevExp.total;
  const contribution = t.revenue > 0 ? t.grossProfit / t.revenue : null;
  const breakEven = contribution && contribution > 0.02 ? exp.total / contribution : null;
  const breakEvenDaily = breakEven !== null ? breakEven / total : null;

  const byCategory = Object.entries(
    [...exp.monthly, ...exp.oneTime].reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const go = (d: string) => router.push(`/${slug}/finans?ay=${d.slice(0, 7)}`, { scroll: false });
  const [y, m] = month.split("-").map(Number);
  const monthLabel = `${MONTHS_TR[m - 1]} ${y}`;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">Finans</h1>
          <p className="text-[14px] text-stone-500">
            {monthLabel}
            {isCurrent ? ` · ${elapsed}/${total} gün` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(addDays(month, -1))} className="grid size-10 place-items-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50" aria-label="Önceki ay">
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-32 text-center text-[15px] font-bold">{monthLabel}</span>
          <button
            type="button"
            disabled={isCurrent}
            onClick={() => go(addDays(monthEnd(month), 1))}
            className="grid size-10 place-items-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40"
            aria-label="Sonraki ay"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-5" /> Gider ekle
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Ciro" value={tl(t.revenue, { decimals: "never" })} emphasis deltas={isCurrent ? [] : [{ value: change(t.revenue, p.revenue), label: "önceki aya göre" }]} sub={isCurrent ? `Günlük ort. ${tl(t.revenue / elapsed, { decimals: "never" })}` : undefined} />
        <StatTile label="Brüt kâr" value={tl(t.grossProfit, { decimals: "never" })} sub={`Ciro − maliyet (${pct(t.costRatio)}) − komisyon`} />
        <StatTile label="Giderler" value={tl(exp.total, { decimals: "never" })} sub={`${exp.monthly.length} sabit · ${exp.oneTime.length} tek seferlik`} />
        <StatTile
          label={isCurrent ? "Net kâr (şu ana kadar)" : "Net kâr"}
          value={<span className={net >= 0 ? "text-emerald-700" : "text-red-700"}>{tl(net, { decimals: "never" })}</span>}
          deltas={isCurrent ? [] : [{ value: change(net, prevNet), label: "önceki aya göre" }]}
          sub={t.revenue > 0 ? `Net marj ${pct(net / t.revenue)}` : undefined}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="p-4 sm:p-5">
          <p className="text-[13px] font-semibold text-stone-500">Gelir tablosu</p>
          <dl className="mt-3 flex flex-col gap-1.5 text-[14px]">
            <Line label="Ciro" value={t.revenue} strong />
            <Line label="Satılan malın maliyeti" value={-t.cost} />
            <Line label="Kart komisyonu" value={-t.commission} />
            <Line label="Brüt kâr" value={t.grossProfit} strong border />
            <Line label="Sabit giderler" value={-exp.monthlyTotal} />
            <Line label="Tek seferlik giderler" value={-exp.oneTimeTotal} />
            <Line label="Net kâr" value={net} strong border tone={net >= 0 ? "good" : "bad"} />
          </dl>
          <p className="mt-3 text-[12px] text-stone-500">İkram edilen ürünlerin maliyeti satılan malın maliyetine dahildir ({tl(t.compValue)} liste fiyatıyla).</p>
        </Card>

        <Card className="p-4 sm:p-5">
          <p className="text-[13px] font-semibold text-stone-500">Başabaş</p>
          {breakEven === null ? (
            <p className="mt-3 text-[14px] text-stone-500">{exp.total === 0 ? "Giderleri girince başabaş cirosu hesaplanır." : "Hesap için bu ay satış verisi gerekli."}</p>
          ) : (
            <>
              <p className="mt-1 text-[26px] font-extrabold">{tl(breakEven, { decimals: "never" })}</p>
              <p className="text-[13px] text-stone-500">
                aylık ciro gerekli · günde {tl(breakEvenDaily ?? 0, { decimals: "never" })}
              </p>
              <div className="mt-4 h-3 rounded-full bg-brand-100">
                <div className="h-3 rounded-full bg-brand-600" style={{ width: `${Math.min(100, (t.revenue / breakEven) * 100)}%` }} />
              </div>
              <p className="mt-1.5 text-[13px] text-stone-600">
                {t.revenue >= breakEven ? "Başabaş aşıldı 🎉" : `Başabaşa ${tl(breakEven - t.revenue, { decimals: "never" })} kaldı`} · {pct(t.revenue / breakEven, 0)}
              </p>
            </>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <p className="text-[13px] font-semibold text-stone-500">Gider dağılımı</p>
          <div className="mt-3">
            <BarList
              color={VIZ.primary}
              emptyText="Bu ay gider yok"
              items={byCategory.map(([cat, amount]) => ({
                key: cat,
                label: EXPENSE_CATEGORIES[cat as ExpenseCategory],
                value: amount,
                display: tl(amount, { decimals: "never" }),
                sub: exp.total > 0 ? pct(amount / exp.total, 0) : undefined,
              }))}
            />
          </div>
        </Card>
      </div>

      <ChartCard
        className="mt-3"
        title="Günlük ciro"
        description={breakEvenDaily ? "Koyu çizgi: günlük başabaş cirosu" : undefined}
        table={{ columns: ["Gün", "Ciro", "Brüt kâr"], rows: days.map((d) => [formatDateShortTr(d.date), tl(d.revenue, { decimals: "never" }), tl(d.revenue - d.cost - d.commission, { decimals: "never" })]) }}
      >
        <ColumnChart
          height={220}
          data={days.map((d) => ({
            key: d.date,
            label: String(Number(d.date.slice(8, 10))),
            value: d.revenue,
            compare: breakEvenDaily,
            tooltip: (
              <>
                <p className="text-[14px] font-bold">{tl(d.revenue, { decimals: "never" })}</p>
                <p className="text-stone-300">{formatDateTr(d.date, { year: false })}</p>
                {breakEvenDaily && <p className="text-stone-400">Başabaş {tl(breakEvenDaily, { decimals: "never" })}</p>}
              </>
            ),
          }))}
        />
        {breakEvenDaily && (
          <div className="mt-2 flex flex-wrap gap-3">
            <LegendItem color={VIZ.primary} label="Ciro" />
            <LegendItem color={VIZ.ink} label="Günlük başabaş" line />
          </div>
        )}
      </ChartCard>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <ExpenseList title="Aylık sabit giderler" description="Her ay tekrar eder (kira, faturalar, maaşlar, kredi)" items={exp.monthly} onEdit={setEditing} />
        <ExpenseList title={`Tek seferlik giderler · ${monthLabel}`} description="Yalnızca girildiği aya yazılır" items={exp.oneTime} onEdit={setEditing} />
      </div>

      {expenses.some((e) => !exp.monthly.includes(e) && !exp.oneTime.includes(e)) && (
        <details className="mt-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-[14px]">
          <summary className="cursor-pointer font-semibold text-stone-700">Bu aya dahil olmayan diğer giderler</summary>
          <ul className="mt-2 divide-y divide-stone-100">
            {expenses
              .filter((e) => !exp.monthly.includes(e) && !exp.oneTime.includes(e))
              .map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <button type="button" onClick={() => setEditing(e)} className="text-left">
                    {e.name} <span className="text-stone-500">· {e.kind === "monthly" ? "aylık" : formatDateTr(e.starts_on)}</span>
                  </button>
                  <span className="tabular-nums">{tl(e.amount, { decimals: "never" })}</span>
                </li>
              ))}
          </ul>
        </details>
      )}

      {editing && <ExpenseEditor cafeId={cafeId} expense={editing === "new" ? null : editing} month={month} onClose={() => setEditing(null)} />}
    </main>
  );
}

function Line({ label, value, strong, border, tone }: { label: string; value: number; strong?: boolean; border?: boolean; tone?: "good" | "bad" }) {
  return (
    <div className={cn("flex justify-between gap-3", border && "mt-1 border-t border-stone-200 pt-2")}>
      <dt className={cn(strong ? "font-semibold text-stone-800" : "text-stone-500")}>{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-bold", tone === "good" && "text-emerald-700", tone === "bad" && "text-red-700")}>
        {value < 0 ? "−" : ""}
        {tl(Math.abs(value), { decimals: "never" })}
      </dd>
    </div>
  );
}

function ExpenseList({ title, description, items, onEdit }: { title: string; description: string; items: Expense[]; onEdit: (e: Expense) => void }) {
  const total = items.reduce((s, e) => s + e.amount, 0);
  return (
    <Card>
      <CardHeader title={title} description={description} action={<span className="text-[15px] font-bold tabular-nums">{tl(total, { decimals: "never" })}</span>} />
      {items.length === 0 ? (
        <EmptyState title="Gider yok" className="py-8" />
      ) : (
        <ul className="mt-2 divide-y divide-stone-100">
          {items.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onEdit(e)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-stone-50 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{e.name}</span>
                    <Badge>{EXPENSE_CATEGORIES[e.category]}</Badge>
                  </span>
                  <span className="block text-[12px] text-stone-500">
                    {e.kind === "monthly"
                      ? `${formatMonth(e.starts_on)} itibarıyla${e.ends_on ? ` · ${formatMonth(e.ends_on)} sonuna kadar` : ""}`
                      : formatDateTr(e.starts_on)}
                    {e.note ? ` · ${e.note}` : ""}
                  </span>
                </span>
                <span className="text-[15px] font-bold tabular-nums">{tl(e.amount, { decimals: "never" })}</span>
                <Pencil className="size-4 text-stone-400" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function formatMonth(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS_TR[m - 1]} ${y}`;
}

function ExpenseEditor({ cafeId, expense, month, onClose }: { cafeId: string; expense: Expense | null; month: string; onClose: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<"monthly" | "one_time">(expense?.kind ?? "monthly");
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "kira");
  const [name, setName] = useState(expense?.name ?? "");
  const [amount, setAmount] = useState<number | null>(expense?.amount ?? null);
  const [startMonth, setStartMonth] = useState((expense?.starts_on ?? month).slice(0, 7));
  const [endMonth, setEndMonth] = useState(expense?.ends_on?.slice(0, 7) ?? "");
  const [date, setDate] = useState(expense?.kind === "one_time" ? expense.starts_on : month);
  const [note, setNote] = useState(expense?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("Gider adı gerekli.");
    if (amount === null || amount < 0) return setError("Tutarı gir.");
    setSaving(true);
    const result = await saveExpenseAction(cafeId, {
      id: expense?.id ?? null,
      kind,
      category,
      name: name.trim(),
      amount,
      starts_on: kind === "monthly" ? `${startMonth}-01` : date,
      ends_on: kind === "monthly" && endMonth ? monthEnd(`${endMonth}-01`) : null,
      note: note.trim(),
    }).catch(() => null);
    setSaving(false);
    if (!result) return setError("Bağlantı sorunu.");
    if (!result.ok) return setError(result.error);
    toast.show(expense ? "Gider güncellendi" : "Gider eklendi");
    onClose();
  };

  const remove = async () => {
    if (!expense) return;
    setSaving(true);
    const result = await deleteExpenseAction(cafeId, expense.id).catch(() => null);
    setSaving(false);
    setConfirmDelete(false);
    if (!result || !result.ok) return setError(result?.ok === false ? result.error : "Bağlantı sorunu.");
    toast.show("Gider silindi");
    onClose();
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={expense ? "Gideri düzenle" : "Yeni gider"}
        size="md"
        footer={
          <div className="flex flex-col gap-2">
            {error && <p className="text-[14px] font-medium text-red-600">{error}</p>}
            <div className="flex gap-2">
              {expense && (
                <Button variant="secondary" size="lg" className="text-red-600" onClick={() => setConfirmDelete(true)} aria-label="Gideri sil">
                  <Trash2 className="size-5" />
                </Button>
              )}
              <Button size="lg" className="flex-1" onClick={save} disabled={saving}>
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              {
                value: "monthly",
                label: (
                  <span className="flex items-center gap-1.5">
                    <Repeat className="size-4" /> Her ay
                  </span>
                ),
              },
              { value: "one_time", label: "Tek seferlik" },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gider adı">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={kind === "monthly" ? "örn. Dükkân kirası" : "örn. Değirmen tamiri"} autoFocus={!expense} />
            </Field>
            <Field label="Kategori">
              <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={kind === "monthly" ? "Aylık tutar" : "Tutar"}>
            <NumberInput value={amount} onValueChange={setAmount} suffix={currencySymbol()} placeholder="0" />
          </Field>
          {kind === "monthly" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Başlangıç ayı">
                <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="h-11 rounded-xl border border-stone-200 px-3 text-[15px]" />
              </Field>
              <Field label="Bitiş ayı" hint="Boş = devam ediyor">
                <input type="month" value={endMonth} min={startMonth} onChange={(e) => setEndMonth(e.target.value)} className="h-11 rounded-xl border border-stone-200 px-3 text-[15px]" />
              </Field>
            </div>
          ) : (
            <Field label="Tarih">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl border border-stone-200 px-3 text-[15px]" />
            </Field>
          )}
          <Field label="Not" hint="İsteğe bağlı">
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </Field>
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        pending={saving}
        danger
        title={`${expense?.name} silinsin mi?`}
        description={expense?.kind === "monthly" ? "Geçmiş aylar dahil tüm aylardan kaldırılır. Sadece bundan sonrası için durdurmak istiyorsan bitiş ayı gir." : undefined}
        confirmLabel="Sil"
      />
    </>
  );
}
