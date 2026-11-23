"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banknote, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, FileText, Paperclip, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { deleteExpenseAction, deleteExpenseFileAction, payExpenseAction, saveExpenseAction } from "@/app/(panel)/[cafe]/finans/actions";
import { BarList } from "@/components/charts/bar-list";
import { ChartCard, LegendItem, VIZ } from "@/components/charts/chart-kit";
import { ColumnChart } from "@/components/charts/column-chart";
import { StatTile } from "@/components/reports/stat-tile";
import { DateRangePicker } from "@/components/ui/date-range";
import { Button } from "@/components/ui/button";
import { Field, Input, NumberInput, Select } from "@/components/ui/field";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Badge, Card, CardHeader, EmptyState, Segmented } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import type { Expense, ExpenseCategory, ReportData } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { EXPENSE_CATEGORIES, expensesForMonth, expensesForRange } from "@/lib/domain/expenses";
import { change, fillDays, totalsOf } from "@/lib/domain/report";
import { addDays, daysInMonth, diffDays, formatDateShortTr, formatDateTr, monthEnd, monthStart, MONTHS_TR } from "@/lib/domain/time";
import { pct, tl, currencySymbol } from "@/lib/format";

export function FinanceView({
  cafeId,
  slug,
  month,
  span,
  today,
  expenses,
  report,
  previous,
}: {
  cafeId: string;
  slug: string;
  month: string;
  /** Aylık değil de bir tarih aralığı: "Tüm zamanlar" (ilk satıştan bugüne) ya da özel aralık */
  span: { from: string; to: string; kind: "all" | "range" } | null;
  today: string;
  expenses: Expense[];
  report: ReportData;
  /** Önceki ay (tüm zamanlarda boş) */
  previous: ReportData | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [paying, setPaying] = useState<Expense | null>(null);

  const allTime = span !== null; // aylık olmayan (tüm zamanlar ya da aralık)
  const start = span?.from ?? month;
  const end = span ? span.to : monthEnd(month) >= today ? today : monthEnd(month);
  const days = fillDays(report.daily, start, end);
  const t = totalsOf(days);
  const p = previous ? totalsOf(previous.daily) : null;
  // Tüm zamanlar: aylık gider kapsanan her ay için bir kez; özel aralık: gün payı kadar
  const range = span ? expensesForRange(expenses, start, end, { prorate: span.kind === "range" }) : null;
  const exp: ReturnType<typeof expensesForMonth> & { monthly: (Expense & { months?: number })[] } = range ?? expensesForMonth(expenses, month);
  const prevExp = expensesForMonth(expenses, addDays(month, -1));
  const isCurrent = span ? end >= today : month === monthStart(today);
  const elapsed = diffDays(start, end) + 1;
  // Başabaş için gider döneminin gün sayısı (aylık: ayın günleri, tüm zamanlar: kapsanan ayların günleri)
  const total = range ? range.days : daysInMonth(month);
  const counted = new Set([...exp.monthly, ...exp.oneTime].map((e) => e.id));

  const net = t.grossProfit - exp.total;
  // Ödenmemiş tek seferlik giderler (fatura geldi, ödeme yapılmadı)
  const unpaid = exp.oneTime.filter((e) => !e.paid_at).reduce((s, e) => s + e.amount, 0);
  const prevNet = p ? p.grossProfit - prevExp.total : 0;
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
  const goRange = (a: string, b: string) => router.push(`/${slug}/finans?bas=${a}&bit=${b}`, { scroll: false });
  const [y, m] = month.split("-").map(Number);
  const monthLabel = `${MONTHS_TR[m - 1]} ${y}`;
  const periodLabel = span?.kind === "all" ? "Tüm zamanlar" : span ? `${formatDateShortTr(start)} – ${formatDateShortTr(end)}` : monthLabel;
  const mode = span?.kind ?? "month";

  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">Finans</h1>
          <p className="text-[14px] text-stone-500">
            {span?.kind === "all"
              ? `${formatDateTr(start)} – bugün · ${elapsed} gün`
              : span
                ? `${formatDateTr(start)} – ${formatDateTr(end)} · ${elapsed} gün`
                : `${monthLabel}${isCurrent ? ` · ${elapsed}/${total} gün` : ""}`}
          </p>
        </div>
        <Segmented
          value={mode}
          onChange={(v) =>
            v === "all"
              ? router.push(`/${slug}/finans?ay=tum`, { scroll: false })
              : v === "range"
                ? goRange(start, end > today ? today : end)
                : go(today)
          }
          options={[
            { value: "month", label: "Aylık" },
            { value: "range", label: "Aralık" },
            { value: "all", label: "Tüm zamanlar" },
          ]}
        />
        {mode === "range" && <DateRangePicker key={`${start}_${end}`} from={start} to={end} max={today} onApply={goRange} />}
        <div className={cn("flex items-center gap-1", allTime && "hidden")}>
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
        <StatTile label="Ciro" value={tl(t.revenue, { decimals: "never" })} emphasis deltas={isCurrent || !p ? [] : [{ value: change(t.revenue, p.revenue), label: "önceki aya göre" }]} sub={isCurrent ? `Günlük ort. ${tl(t.revenue / elapsed, { decimals: "never" })}` : undefined} />
        <StatTile label="Brüt kâr" value={tl(t.grossProfit, { decimals: "never" })} sub={`Ciro − maliyet (${pct(t.costRatio)}) − komisyon`} />
        <StatTile
          label="Giderler"
          value={tl(exp.total, { decimals: "never" })}
          sub={`${exp.monthly.length} sabit · ${exp.oneTime.length} tek seferlik${range ? ` · ${range.months} ay` : ""}${unpaid > 0 ? ` · ${tl(unpaid, { decimals: "never" })} ödenmedi` : ""}`}
        />
        <StatTile
          label={isCurrent ? "Net kâr (şu ana kadar)" : "Net kâr"}
          value={<span className={net >= 0 ? "text-emerald-700" : "text-red-700"}>{tl(net, { decimals: "never" })}</span>}
          deltas={isCurrent || !p ? [] : [{ value: change(net, prevNet), label: "önceki aya göre" }]}
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
            <p className="mt-3 text-[14px] text-stone-500">
              {exp.total === 0 ? "Giderleri girince başabaş cirosu hesaplanır." : allTime ? "Hesap için satış verisi gerekli." : "Hesap için bu ay satış verisi gerekli."}
            </p>
          ) : (
            <>
              <p className="mt-1 text-[26px] font-extrabold">{tl(breakEven, { decimals: "never" })}</p>
              <p className="text-[13px] text-stone-500">
                {span?.kind === "range" ? "bu dönemin giderleri için ciro gerekli" : allTime ? `${range?.months ?? 1} ayın giderleri için ciro gerekli` : "aylık ciro gerekli"} · günde {tl(breakEvenDaily ?? 0, { decimals: "never" })}
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
              emptyText={allTime ? "Gider yok" : "Bu ay gider yok"}
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
            label: allTime ? `${Number(d.date.slice(8, 10))}.${Number(d.date.slice(5, 7))}` : String(Number(d.date.slice(8, 10))),
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
        <ExpenseList
          title={allTime ? "Sabit giderler (ay sayısıyla)" : "Aylık sabit giderler"}
          description="Her ay tekrar eder (kira, faturalar, maaşlar, kredi)"
          items={exp.monthly}
          // Tüm zamanlarda listelenen tutar ay sayısıyla çarpılmıştır; düzenlemede asıl kayıt açılır
          onEdit={(e) => setEditing(expenses.find((x) => x.id === e.id) ?? e)}
          slug={slug}
        />
        <ExpenseList
          title={`Tek seferlik giderler · ${periodLabel}`}
          description="Faturalar ve alışverişler; ödenmeyenler işaretli"
          items={exp.oneTime}
          onEdit={setEditing}
          onPay={setPaying}
          slug={slug}
        />
      </div>

      {expenses.some((e) => !counted.has(e.id)) && (
        <details className="mt-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-[14px]">
          <summary className="cursor-pointer font-semibold text-stone-700">{allTime ? "Bu döneme dahil olmayan diğer giderler" : "Bu aya dahil olmayan diğer giderler"}</summary>
          <ul className="mt-2 divide-y divide-stone-100">
            {expenses
              .filter((e) => !counted.has(e.id))
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

      {editing && <ExpenseEditor cafeId={cafeId} slug={slug} expense={editing === "new" ? null : editing} month={month} onClose={() => setEditing(null)} />}
      {paying && <PaySheet cafeId={cafeId} expense={paying} onClose={() => setPaying(null)} />}
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

function ExpenseList({
  title,
  description,
  items,
  onEdit,
  onPay,
  slug,
}: {
  title: string;
  description: string;
  /** months: tüm zamanlar görünümünde bu aylık giderin kaç ay sayıldığı */
  items: (Expense & { months?: number })[];
  onEdit: (e: Expense) => void;
  /** Verilirse ödenmemiş giderde "Öde" düğmesi çıkar (tek seferlik giderler) */
  onPay?: (e: Expense) => void;
  slug: string;
}) {
  const total = items.reduce((s, e) => s + e.amount, 0);
  return (
    <Card>
      <CardHeader title={title} description={description} action={<span className="text-[15px] font-bold tabular-nums">{tl(total, { decimals: "never" })}</span>} />
      {items.length === 0 ? (
        <EmptyState title="Gider yok" className="py-8" />
      ) : (
        <ul className="mt-2 divide-y divide-stone-100">
          {items.map((e) => (
            <li key={e.id} className="flex items-center gap-1 pr-3 hover:bg-stone-50 sm:pr-4">
              <button type="button" onClick={() => onEdit(e)} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left sm:pl-5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{e.name}</span>
                    <Badge>{EXPENSE_CATEGORIES[e.category]}</Badge>
                  </span>
                  <span className="block text-[12px] text-stone-500">
                    {e.kind === "monthly"
                      ? `${formatMonth(e.starts_on)} itibarıyla${e.ends_on ? ` · ${formatMonth(e.ends_on)} sonuna kadar` : ""}`
                      : formatDateTr(e.starts_on)}
                    {e.months ? ` · ${Number.isInteger(e.months) ? e.months : e.months.toFixed(2).replace(".", ",")} ay × ${tl(e.amount / e.months, { decimals: "never" })}` : ""}
                    {e.note ? ` · ${e.note}` : ""}
                  </span>
                </span>
                <span className="text-[15px] font-bold tabular-nums">{tl(e.amount, { decimals: "never" })}</span>
                <Pencil className="size-4 shrink-0 text-stone-400" />
              </button>
              {e.file && (
                <a
                  href={`/${slug}/finans/dosya/${e.id}`}
                  target="_blank"
                  rel="noopener"
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                  aria-label={`Fatura: ${e.file.name}`}
                  title={e.file.name}
                >
                  <FileText className="size-4" />
                </a>
              )}
              {onPay &&
                (e.paid_at ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[12px] font-semibold text-emerald-800" title={e.paid_by ? `Ödeyen: ${e.paid_by}` : undefined}>
                    <CheckCircle2 className="size-3.5" /> {e.paid_method === "cash" ? "Nakit" : "Kart"}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onPay(e)}
                    className="h-9 shrink-0 rounded-lg bg-amber-100 px-3 text-[13px] font-bold text-amber-900 hover:bg-amber-200"
                    aria-label={`${e.name} ödenmedi, öde`}
                  >
                    Öde
                  </button>
                ))}
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

const MAX_FILE_BYTES = 3 * 1024 * 1024;

/** Fatura dosyasını yükler (sunucu eylemlerinin gövde sınırı küçük olduğu için ayrı uç) */
async function uploadFile(slug: string, expenseId: string, file: File): Promise<string | null> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`/${slug}/finans/dosya/${expenseId}`, { method: "POST", body }).catch(() => null);
  if (!res) return "Bağlantı sorunu.";
  const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  return res.ok && json?.ok ? null : (json?.error ?? "Dosya yüklenemedi.");
}

function ExpenseEditor({ cafeId, slug, expense, month, onClose }: { cafeId: string; slug: string; expense: Expense | null; month: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [unpay, setUnpay] = useState(false);
  const [kind, setKindState] = useState<"monthly" | "one_time">(expense?.kind ?? "monthly");
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "kira");
  // Yeni giderde tür değişince varsayılan kategori de değişir (tek seferlik: çoğunlukla market alışverişi)
  const setKind = (next: "monthly" | "one_time") => {
    setKindState(next);
    if (!expense) setCategory((c) => (next === "one_time" && c === "kira" ? "market" : next === "monthly" && c === "market" ? "kira" : c));
  };
  const [name, setName] = useState(expense?.name ?? "");
  const [amount, setAmount] = useState<number | null>(expense?.amount ?? null);
  const [startMonth, setStartMonth] = useState((expense?.starts_on ?? month).slice(0, 7));
  const [endMonth, setEndMonth] = useState(expense?.ends_on?.slice(0, 7) ?? "");
  const [date, setDate] = useState(() => {
    if (expense?.kind === "one_time") return expense.starts_on;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return today.slice(0, 7) === month.slice(0, 7) ? today : month;
  });
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
    if (!result || !result.ok) {
      setSaving(false);
      return setError(result ? result.error : "Bağlantı sorunu.");
    }
    const savedId = result.data.id;
    // Fatura dosyası ve ödeme durumu: kayıttan sonra
    const extra: string[] = [];
    if (file) {
      const failed = await uploadFile(slug, savedId, file);
      if (failed) extra.push(failed);
    } else if (removeFile && expense?.file) {
      const r = await deleteExpenseFileAction(cafeId, savedId).catch(() => null);
      if (!r?.ok) extra.push("Fatura kaldırılamadı.");
    }
    if (unpay && expense?.paid_at) {
      const r = await payExpenseAction(cafeId, savedId, null).catch(() => null);
      if (!r?.ok) extra.push("Ödeme durumu değiştirilemedi.");
    }
    setSaving(false);
    router.refresh();
    // Gider kaydedildi; ek işlem başarısızsa uyar (yeniden kaydedip çift gider oluşmasın diye pencere kapanır)
    if (extra.length) toast.show(`Gider kaydedildi; ${extra.join(" ")}`, "error");
    else toast.show(expense ? "Gider güncellendi" : "Gider eklendi");
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
          <Field label="Fatura" hint="e-Arşiv PDF ya da fotoğraf · en fazla 3 MB · isteğe bağlı">
            <div className="flex flex-wrap items-center gap-2">
              {expense?.file && !removeFile && !file && (
                <a
                  href={`/${slug}/finans/dosya/${expense.id}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-stone-200 px-3 text-[14px] font-semibold hover:bg-stone-50"
                >
                  <FileText className="size-4" /> {expense.file.name}
                </a>
              )}
              <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-stone-300 px-3 text-[14px] font-semibold text-stone-700 hover:bg-stone-50">
                <Paperclip className="size-4" /> {file ? file.name : expense?.file ? "Değiştir" : "Dosya seç"}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.size > MAX_FILE_BYTES) {
                      e.target.value = "";
                      return setError("Dosya en fazla 3 MB olabilir.");
                    }
                    setError(null);
                    setFile(f);
                    setRemoveFile(false);
                  }}
                />
              </label>
              {(file || (expense?.file && !removeFile)) && (
                <button
                  type="button"
                  className="h-10 rounded-xl px-2 text-[13px] font-semibold text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setFile(null);
                    setRemoveFile(true);
                  }}
                >
                  Kaldır
                </button>
              )}
            </div>
          </Field>
          {kind === "one_time" && expense?.paid_at && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[14px] text-emerald-900">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4" />
                {unpay ? "Kaydedince ödenmedi olarak işaretlenecek" : `${expense.paid_method === "cash" ? "Nakit" : "Kartla"} ödendi${expense.paid_by ? ` · ${expense.paid_by}` : ""}`}
              </span>
              <button type="button" className="text-[13px] font-semibold underline" onClick={() => setUnpay((v) => !v)}>
                {unpay ? "Vazgeç" : "Ödenmedi yap"}
              </button>
            </div>
          )}
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

/** "Öde": nakit mi kart mı? Nakit ödeme açık günde kasadan düşülür. */
function PaySheet({ cafeId, expense, onClose }: { cafeId: string; expense: Expense; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<"cash" | "card" | null>(null);

  const pay = async (method: "cash" | "card") => {
    setBusy(method);
    const result = await payExpenseAction(cafeId, expense.id, method).catch(() => null);
    setBusy(null);
    if (!result?.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show(method === "cash" ? "Nakit ödendi; kasadan düşüldü" : "Kartla ödendi");
    router.refresh();
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={`${expense.name} · ${tl(expense.amount)}`} description="Nasıl ödendi?" size="sm">
      <div className="grid grid-cols-2 gap-3">
        <Button size="xl" variant="secondary" disabled={!!busy} onClick={() => pay("cash")} className="h-20 flex-col gap-1">
          <Banknote className="size-6" /> Nakit
        </Button>
        <Button size="xl" variant="secondary" disabled={!!busy} onClick={() => pay("card")} className="h-20 flex-col gap-1">
          <CreditCard className="size-6" /> Kart
        </Button>
      </div>
      <p className="mt-3 text-[13px] text-stone-500">Nakit ödeme, kafe açıksa gün sonu kasa sayımında beklenen nakitten düşülür.</p>
    </Sheet>
  );
}
