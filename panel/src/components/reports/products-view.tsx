"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { ChartCard, VIZ } from "@/components/charts/chart-kit";
import { DateRangePicker } from "@/components/ui/date-range";
import { Badge, Card, CardHeader, EmptyState, Segmented } from "@/components/ui/surface";
import type { ProductsReport } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateTr } from "@/lib/domain/time";
import { num, pct, tl } from "@/lib/format";
import { usePerms } from "@/components/shell/perms";

type Period = "bugun" | "hafta" | "ay" | "90gun" | "aralik" | "tum";
type Sort = "qty" | "revenue" | "profit";

const PERIOD_LABEL: Record<Period, string> = {
  bugun: "Bugün",
  hafta: "Bu hafta",
  ay: "Bu ay",
  "90gun": "Son 90 gün",
  aralik: "Aralık",
  tum: "Tüm zamanlar",
};

export function ProductsView({
  slug,
  period,
  today,
  report,
}: {
  slug: string;
  period: Period;
  today: string;
  report: ProductsReport;
}) {
  const router = useRouter();
  const showProfit = usePerms().profit;
  const [sort, setSort] = useState<Sort>("qty");
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(() => [...new Set(report.products.map((p) => p.category || "Diğer"))].sort(), [report.products]);

  const rows = useMemo(() => {
    const filtered = report.products.filter((p) => category === "all" || (p.category || "Diğer") === category);
    return [...filtered].sort((a, b) =>
      sort === "qty" ? b.qty - a.qty : sort === "revenue" ? b.revenue - a.revenue : b.revenue - b.cost - (a.revenue - a.cost),
    );
  }, [report.products, sort, category]);

  const max = Math.max(1, ...rows.map((r) => (sort === "qty" ? r.qty : sort === "revenue" ? r.revenue : r.revenue - r.cost)));
  const totalQty = report.totals.items || 1;

  const rangeText =
    period === "tum"
      ? report.first_sale
        ? `${formatDateTr(report.first_sale)} — bugün · ${report.days} satış günü`
        : "Henüz satış yok"
      : period === "bugun"
        ? formatDateTr(today)
        : `${formatDateTr(report.range.from)} — ${formatDateTr(report.range.to)} · ${report.days} satış günü`;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">Ürün satışları</h1>
          <p className="text-[14px] text-stone-500">{rangeText}</p>
        </div>
      </div>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() =>
              router.push(
                p === "aralik" ? `/${slug}/urunler?donem=aralik&bas=${report.range.from}&bit=${report.range.to}` : `/${slug}/urunler?donem=${p}`,
                { scroll: false },
              )
            }
            className={cn(
              "h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold transition",
              p === period ? "bg-brand-600 text-white shadow-card" : "border border-stone-200 bg-white text-stone-600 hover:border-stone-300",
            )}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>
      {period === "aralik" && (
        <div className="mt-3">
          <DateRangePicker
            key={`${report.range.from}_${report.range.to}`}
            from={report.range.from}
            to={report.range.to}
            max={today}
            onApply={(a, b) => router.push(`/${slug}/urunler?donem=aralik&bas=${a}&bit=${b}`, { scroll: false })}
          />
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Satılan ürün" value={num(report.totals.items, 0)} />
        <Summary label="Adisyon" value={num(report.totals.orders, 0)} />
        <Summary label="Ciro" value={tl(report.totals.revenue, { decimals: "never" })} strong />
        {showProfit && (
          <Summary
            label="Brüt kâr"
            value={tl(report.totals.revenue - report.totals.cost, { decimals: "never" })}
            sub={report.totals.revenue > 0 ? `Marj ${pct((report.totals.revenue - report.totals.cost) / report.totals.revenue, 0)}` : undefined}
          />
        )}
      </div>

      {report.products.length === 0 ? (
        <Card className="mt-4">
          <EmptyState title="Bu dönemde satış yok" description="Ödemesi alınan adisyonlardaki ürünler burada listelenir." />
        </Card>
      ) : (
        <>
          <ChartCard
            className="mt-4"
            title="En çok satanlar"
            description={`${rows.length} ürün · ${PERIOD_LABEL[period].toLocaleLowerCase("tr")}`}
            action={
              <Segmented
                size="sm"
                value={sort}
                onChange={setSort}
                options={[
                  { value: "qty", label: "Adet" },
                  { value: "revenue", label: "Ciro" },
                  ...(showProfit ? [{ value: "profit" as const, label: "Kâr" }] : []),
                ]}
              />
            }
            table={{
              columns: showProfit ? ["#", "Ürün", "Adet", "Ciro", "Maliyet", "Kâr", "Pay"] : ["#", "Ürün", "Adet", "Ciro", "Pay"],
              rows: rows.map((p, i) =>
                showProfit
                  ? [
                      i + 1,
                      p.name,
                      num(p.qty, 0),
                      tl(p.revenue, { decimals: "never" }),
                      tl(p.cost, { decimals: "never" }),
                      tl(p.revenue - p.cost, { decimals: "never" }),
                      pct(p.qty / totalQty, 1),
                    ]
                  : [i + 1, p.name, num(p.qty, 0), tl(p.revenue, { decimals: "never" }), pct(p.qty / totalQty, 1)],
              ),
            }}
          >
            {categories.length > 1 && (
              <div className="-mx-1 mb-4 flex flex-wrap gap-1.5">
                <CategoryChip active={category === "all"} onClick={() => setCategory("all")}>
                  Tümü
                </CategoryChip>
                {categories.map((c) => (
                  <CategoryChip key={c} active={category === c} onClick={() => setCategory(c)}>
                    {c}
                  </CategoryChip>
                ))}
              </div>
            )}

            <ol className="flex flex-col gap-2.5">
              {rows.map((p, i) => {
                const value = sort === "qty" ? p.qty : sort === "revenue" ? p.revenue : p.revenue - p.cost;
                const margin = p.revenue > 0 ? (p.revenue - p.cost) / p.revenue : null;
                return (
                  <li key={p.product_id ?? p.name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className={cn("w-5 shrink-0 text-right text-[13px] font-bold tabular-nums", i < 3 ? "text-brand-700" : "text-stone-400")}>
                          {i + 1}
                        </span>
                        <span className="truncate text-[15px] font-semibold text-stone-900">{p.name}</span>
                        {!p.is_active && <Badge>menüde yok</Badge>}
                      </span>
                      <span className="shrink-0 text-[15px] font-bold tabular-nums">
                        {sort === "qty" ? `${num(p.qty, 0)} adet` : tl(value, { decimals: "never" })}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 pl-7">
                      <div className="h-2 flex-1 rounded-full bg-stone-100">
                        <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (value / max) * 100)}%`, background: VIZ.primary }} />
                      </div>
                      <span className="shrink-0 text-[12px] text-stone-500">
                        {sort === "qty" ? tl(p.revenue, { decimals: "never" }) : `${num(p.qty, 0)} adet`}
                        {showProfit && margin !== null && p.cost > 0 ? ` · marj ${pct(margin, 0)}` : ""}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </ChartCard>

          <Card className="mt-3">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Trophy className="size-5 text-brand-600" /> En az satanlar
                </span>
              }
              description="Bu dönemde en az satılan ürünler"
            />
            <ul className="px-4 pb-4 pt-2 sm:px-5">
              {[...rows]
                .sort((a, b) => a.qty - b.qty)
                .slice(0, 8)
                .map((p) => (
                  <li key={p.product_id ?? p.name} className="flex items-center justify-between border-b border-stone-100 py-2 text-[14px] last:border-0">
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 tabular-nums text-stone-600">
                      {num(p.qty, 0)} adet · {p.days_sold} gün
                    </span>
                  </li>
                ))}
            </ul>
          </Card>
        </>
      )}

      {report.unsold.length > 0 && (
        <Card className="mt-3">
          <CardHeader title="Hiç satılmayanlar" description={`Menüde açık ama bu dönemde hiç satılmamış ${report.unsold.length} ürün`} />
          <div className="flex flex-wrap gap-2 px-4 pb-4 pt-3 sm:px-5">
            {report.unsold.map((u) => (
              <span key={u.product_id} className="rounded-full border border-stone-200 px-3 py-1 text-[13px] text-stone-600">
                {u.name} <span className="text-stone-400">· {tl(u.price, { decimals: "never" })}</span>
              </span>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}

function Summary({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-2xl border px-4 py-3", strong ? "border-brand-200 bg-brand-50" : "border-stone-200 bg-white")}>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className={cn("mt-0.5 text-[20px] font-extrabold", strong && "text-brand-800")}>{value}</p>
      {sub && <p className="text-[12px] text-stone-500">{sub}</p>}
    </div>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-full px-3 text-[13px] font-semibold transition",
        active ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200",
      )}
    >
      {children}
    </button>
  );
}
