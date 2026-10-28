"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Banknote, ChevronLeft, ChevronRight, Clock, CreditCard, Flame, Moon, Sun } from "lucide-react";
import { BarList } from "@/components/charts/bar-list";
import { ChartCard, LegendItem, VIZ } from "@/components/charts/chart-kit";
import { ColumnChart } from "@/components/charts/column-chart";
import { Card, CardHeader, EmptyState, Segmented } from "@/components/ui/surface";
import type { ReportData } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import {
  addDays,
  diffDays,
  formatDateShortTr,
  formatDateTr,
  formatMinutes,
  formatTime,
  hourRangeLabel,
  MONTHS_TR,
  toIsoDate,
  weekdayOf,
  WEEKDAYS_SHORT_TR,
  WEEKDAYS_TR,
} from "@/lib/domain/time";
import {
  categoryBreakdown,
  change,
  fillDays,
  hourlySummary,
  leastProducts,
  tableStats,
  topProducts,
  totalsOf,
  type Tier,
} from "@/lib/domain/report";
import { num, pct, tl } from "@/lib/format";
import { DateRangePicker } from "@/components/ui/date-range";
import { StatTile } from "./stat-tile";
import { usePerms } from "@/components/shell/perms";

const TIER_LABEL: Record<Tier, string> = { busy: "Yoğun", medium: "Orta", calm: "Sakin" };

type ReportPeriod = "day" | "week" | "month" | "all" | "range";
const PERIOD_PARAM: Record<ReportPeriod, string> = { day: "gun", week: "hafta", month: "ay", all: "tum", range: "aralik" };

export function ReportView({
  slug,
  view,
  date,
  from,
  to,
  prevFrom,
  prevTo,
  today,
  current,
  previous,
  openHour,
  closeHour,
  timezone,
  currentHour,
}: {
  slug: string;
  view: ReportPeriod;
  date: string;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  today: string;
  current: ReportData;
  /** Tüm zamanlar görünümünde boş (karşılaştırılacak önceki dönem yok) */
  previous: ReportData | null;
  openHour: number;
  closeHour: number;
  timezone: string;
  currentHour: number;
}) {
  const router = useRouter();
  // Kâr/maliyet yetkisi yoksa veritabanı maliyet alanlarını göndermez
  const showProfit = usePerms().profit;
  const multi = view !== "day";
  const allTime = view === "all";
  const isRange = view === "range";
  const rangeDays = diffDays(from, to) + 1;
  const days = fillDays(current.daily, from, to);
  const elapsedDays = multi ? Math.max(1, days.filter((d) => d.date <= today).length) : 1;
  const t = totalsOf(days, elapsedDays);

  // Karşılaştırmalar
  const prevDays = previous ? fillDays(previous.daily, prevFrom, prevTo) : [];
  const prevDay = view === "day" ? totalsOf(prevDays.filter((d) => d.date === addDays(from, -1))) : null;
  const lastWeekSameDay = view === "day" ? totalsOf(prevDays.filter((d) => d.date === addDays(from, -7))) : null;
  // Hafta/ay devam ediyorsa öncekinin aynı gün sayısıyla karşılaştır
  const prevRange = multi ? totalsOf(prevDays.slice(0, elapsedDays)) : null;
  const prevLabel = isRange
    ? `önceki ${rangeDays} güne göre`
    : view === "week"
      ? elapsedDays < 7
        ? `geçen haftanın ilk ${elapsedDays} günü`
        : "geçen haftaya göre"
      : elapsedDays < prevDays.length
        ? `geçen ayın ilk ${elapsedDays} günü`
        : "geçen aya göre";

  const deltas = (pick: (x: ReturnType<typeof totalsOf>) => number | null, upGood = true) =>
    view === "all"
      ? []
      : view === "day"
      ? [
          { value: change(pick(t), pick(prevDay!)), label: "düne göre", upGood },
          { value: change(pick(t), pick(lastWeekSameDay!)), label: `geçen ${WEEKDAYS_SHORT_TR[weekdayOf(from)]}`, upGood },
        ]
      : [{ value: change(pick(t), pick(prevRange!)), label: prevLabel, upGood }];

  // Bugünün günlük görünümünde henüz gelmemiş saatler "sakin" sayılmasın
  const isLiveDay = view === "day" && from === today;
  const effectiveClose = isLiveDay ? Math.max(openHour + 1, Math.min(closeHour, currentHour + 1)) : closeHour;
  const hourly = useMemo(
    () => hourlySummary(current.hourly, openHour, effectiveClose, elapsedDays),
    [current.hourly, openHour, effectiveClose, elapsedDays],
  );
  const top = topProducts(current.products, 6);
  const { least, unsold } = leastProducts(current, 6);
  const categories = categoryBreakdown(current.products);
  const tables = tableStats(current.tables);
  const hasData = t.orders > 0;

  const go = (next: { view?: ReportPeriod; date?: string; range?: [string, string] }) => {
    const v = next.view ?? view;
    const d = next.date ?? date;
    // Aralığa geçerken şu an görülen dönemle başla
    const [a, b] = next.range ?? [from, to > today ? today : to];
    const query = v === "all" ? "" : v === "range" ? `&bas=${a}&bit=${b}` : `&tarih=${d}`;
    router.push(`/${slug}/rapor?gorunum=${PERIOD_PARAM[v]}${query}`, { scroll: false });
  };
  const prevDate = view === "month" ? prevFrom : addDays(from, view === "week" ? -7 : -1);
  const nextDate = addDays(to, 1);
  const canNext = nextDate <= today;
  const periodLabel = isRange ? "Önceki dönem" : view === "week" ? "Geçen hafta" : "Geçen ay";

  const rangeTitle =
    view === "all"
      ? `${formatDateTr(from)} – bugün · ${elapsedDays} gün`
      : isRange
        ? `${formatDateTr(from)} – ${formatDateTr(to)} · ${rangeDays} gün`
      : view === "day"
      ? `${formatDateTr(from)}, ${WEEKDAYS_TR[weekdayOf(from)]}`
      : view === "month"
        ? `${MONTHS_TR[Number(from.slice(5, 7)) - 1]} ${from.slice(0, 4)}`
        : `${formatDateShortTr(from)} – ${formatDateTr(to)}`;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-6">
      {/* Filtre satırı */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-extrabold tracking-tight sm:text-[28px]">Rapor</h1>
        <Segmented
          value={view}
          onChange={(v) => go({ view: v })}
          options={[
            { value: "day", label: "Günlük" },
            { value: "week", label: "Haftalık" },
            { value: "month", label: "Aylık" },
            { value: "range", label: "Aralık" },
            { value: "all", label: "Tüm zamanlar" },
          ]}
        />
        {isRange && <DateRangePicker key={`${from}_${to}`} from={from} to={to} max={today} onApply={(a, b) => go({ range: [a, b] })} />}
        <div className={cn("flex items-center gap-1", (view === "all" || isRange) && "hidden")}>
          <button type="button" onClick={() => go({ date: prevDate })} className="grid size-10 place-items-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50" aria-label="Önceki">
            <ChevronLeft className="size-5" />
          </button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && go({ date: e.target.value })}
            className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-[14px] font-medium"
            aria-label="Tarih"
          />
          <button type="button" disabled={!canNext} onClick={() => go({ date: nextDate })} className="grid size-10 place-items-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40" aria-label="Sonraki">
            <ChevronRight className="size-5" />
          </button>
          {date !== today && (
            <button type="button" onClick={() => go({ date: today })} className="ml-1 h-10 rounded-xl px-3 text-[14px] font-semibold text-brand-700 hover:bg-brand-50">
              Bugün
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-[14px] text-stone-500">
        {rangeTitle}
        {view === "week" && " · hafta pazartesi 00:00'da başlar, pazar 24:00'te biter"}
        {(isLiveDay || (multi && to >= today)) && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-semibold text-emerald-700">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> {view === "day" ? "Gün devam ediyor" : view === "week" ? "Hafta devam ediyor" : view === "month" ? "Ay devam ediyor" : "Bugün dahil"}
          </span>
        )}
      </p>

      {!hasData ? (
        <Card className="mt-6">
          <EmptyState title="Bu aralıkta ödemesi alınmış adisyon yok" description="Adisyonlar ödeme alınınca rapora yazılır." />
        </Card>
      ) : (
        <>
          {/* Temel metrikler */}
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Ciro" value={tl(t.revenue, { decimals: "never" })} emphasis deltas={deltas((x) => x.revenue)} />
            <StatTile
              label="Sipariş (adisyon)"
              value={num(t.orders, 0)}
              sub={`${num(t.items, 0)} ürün · ${t.takeawayOrders} gel-al${t.cancelled ? ` · ${t.cancelled} iptal` : ""}`}
              deltas={deltas((x) => x.orders)}
            />
            <StatTile label="Ortalama sepet" value={t.avgBasket === null ? "—" : tl(t.avgBasket, { decimals: "never" })} deltas={deltas((x) => x.avgBasket)} />
            {showProfit && (
              <StatTile
                label="Brüt kâr"
                value={tl(t.grossProfit, { decimals: "never" })}
                sub={t.marginRatio !== null ? `Marj ${pct(t.marginRatio)}` : undefined}
                deltas={deltas((x) => x.grossProfit)}
              />
            )}
          </div>

          {/* Müşteri analizi (adisyonda kişi sayısı girildiyse) */}
          {t.guestOrders > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label="Müşteri"
                value={`${num(t.guests, 0)} kişi`}
                sub={`${t.guestOrders}/${t.orders} adisyonda girildi${multi ? ` · günde ort. ${num(t.guests / elapsedDays, 1)}` : ""}`}
                deltas={deltas((x) => (x.guestOrders > 0 ? x.guests : null))}
              />
              <StatTile
                label="Kişi başı harcama"
                value={t.perGuest === null ? "—" : tl(t.perGuest, { decimals: "never" })}
                deltas={deltas((x) => x.perGuest)}
              />
              <StatTile
                label="Masa başına kişi"
                value={t.guestsPerOrder === null ? "—" : num(t.guestsPerOrder, 1)}
                deltas={deltas((x) => x.guestsPerOrder)}
              />
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-stone-200 px-4 py-2.5 text-[13px] text-stone-500">
              Müşteri sayısı analizi için adisyonun altındaki “Kişi sayısı”nı girin; günlük, haftalık ve aylık müşteri sayısı ile kişi başı harcama burada görünür.
            </p>
          )}

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <Card className="p-4 sm:p-5">
              <p className="text-[13px] font-semibold text-stone-500">Ödemeler</p>
              <div
                className="mt-3 flex h-3 overflow-hidden rounded-full bg-stone-100"
                role="img"
                aria-label={`Kart ${pct(t.card / Math.max(t.revenue, 1))}, nakit ${pct(t.cash / Math.max(t.revenue, 1))}${t.ticket > 0 ? `, ticket ${pct(t.ticket / Math.max(t.revenue, 1))}` : ""}`}
              >
                <div style={{ width: `${(t.card / Math.max(t.card + t.cash + t.ticket, 1)) * 100}%`, background: VIZ.primary }} />
                <div className="border-l-2 border-white" style={{ width: `${(t.cash / Math.max(t.card + t.cash + t.ticket, 1)) * 100}%`, background: VIZ.second }} />
                {t.ticket > 0 && (
                  <div className="border-l-2 border-white" style={{ width: `${(t.ticket / Math.max(t.card + t.cash + t.ticket, 1)) * 100}%`, background: VIZ.muted }} />
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-600">
                    <span className="size-2.5 rounded-[3px]" style={{ background: VIZ.primary }} />
                    <CreditCard className="size-4" /> Kart
                  </p>
                  <p className="text-[20px] font-extrabold">{tl(t.card, { decimals: "never" })}</p>
                  <p className="text-[12px] text-stone-500">Komisyon {tl(t.commission)}{t.ticket > 0 ? " (ticket dahil)" : ""}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-600">
                    <span className="size-2.5 rounded-[3px]" style={{ background: VIZ.second }} />
                    <Banknote className="size-4" /> Nakit
                  </p>
                  <p className="text-[20px] font-extrabold">{tl(t.cash, { decimals: "never" })}</p>
                  <p className="text-[12px] text-stone-500">Komisyon yok</p>
                </div>
              </div>
              {t.ticket > 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-[13px] text-stone-600">
                  <span className="size-2.5 rounded-[3px]" style={{ background: VIZ.muted }} />
                  Ticket <b className="tabular-nums">{tl(t.ticket, { decimals: "never" })}</b>
                </p>
              )}
            </Card>

            {showProfit && <Card className="p-4 sm:p-5">
              <p className="text-[13px] font-semibold text-stone-500">Maliyet (satılan malın maliyeti)</p>
              <p className="mt-1 text-[26px] font-extrabold">{tl(t.cost, { decimals: "never" })}</p>
              <p className="text-[13px] text-stone-500">{t.costRatio !== null ? `Cironun ${pct(t.costRatio)}'ü` : ""}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                <dt className="text-stone-500">İkram tutarı</dt>
                <dd className="text-right font-semibold">{tl(t.compValue)}</dd>
                <dt className="text-stone-500">İndirim</dt>
                <dd className="text-right font-semibold">{tl(t.discount)}</dd>
                <dt className="text-stone-500">Net (komisyon sonrası)</dt>
                <dd className="text-right font-semibold">{tl(t.revenue - t.commission, { decimals: "never" })}</dd>
              </dl>
            </Card>}

            <Card className="p-4 sm:p-5">
              <p className="text-[13px] font-semibold text-stone-500">Masa işgali</p>
              <p className="mt-1 text-[26px] font-extrabold">{t.avgOccupancy === null ? "—" : formatMinutes(t.avgOccupancy)}</p>
              <p className="text-[13px] text-stone-500">ortalama oturma · {t.tableSessions} masa oturumu</p>
              {tables[0] && (
                <p className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-[13px]">
                  En çok işgal edilen: <strong>{tables[0].name}</strong> · toplam {formatMinutes(tables[0].minutes)} ({tables[0].sessions} oturum)
                </p>
              )}
            </Card>
          </div>

          {/* Saatlik yoğunluk */}
          <ChartCard
            className="mt-3"
            title={view === "day" ? "Saatlik yoğunluk" : "Saatlik yoğunluk (günlük ortalama)"}
            description="Sipariş: bir masaya art arda eklenen ürün grubu. Saatler yoğunluğa göre üçe ayrılır."
            table={{
              columns: ["Saat", "Sipariş", "Ürün", "Ciro", "Seviye"],
              rows: hourly.hours.map((h) => [hourRangeLabel(h.hour), view === "day" ? h.rounds : num(h.avgRounds, 1), h.items, tl(h.revenue, { decimals: "never" }), TIER_LABEL[h.tier]]),
            }}
          >
            <div className="grid gap-2 sm:grid-cols-3">
              <HourChip icon={<Flame className="size-4" />} tone={VIZ.tiers.busy} title="En yoğun" hour={hourly.busiest} view={multi ? "week" : "day"} />
              <HourChip icon={<Sun className="size-4" />} tone={VIZ.tiers.medium} title="Orta yoğun" hour={hourly.medium} view={multi ? "week" : "day"} />
              <HourChip icon={<Moon className="size-4" />} tone={VIZ.tiers.calm} title="En sakin" hour={hourly.calmest} view={multi ? "week" : "day"} />
            </div>
            <div className="mt-4">
              <ColumnChart
                height={220}
                data={hourly.hours.map((h) => ({
                  key: String(h.hour),
                  label: String(h.hour).padStart(2, "0"),
                  value: view === "day" ? h.rounds : Math.round(h.avgRounds * 10) / 10,
                  color: VIZ.tiers[h.tier],
                  tooltip: (
                    <>
                      <p className="text-[14px] font-bold">
                        {view === "day" ? h.rounds : num(h.avgRounds, 1)} sipariş · {tl(h.revenue, { decimals: "never" })}
                      </p>
                      <p className="text-stone-300">
                        {hourRangeLabel(h.hour)} · {TIER_LABEL[h.tier]}
                      </p>
                    </>
                  ),
                }))}
                format={(v) => num(v, 1)}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              <LegendItem color={VIZ.tiers.busy} label="Yoğun" />
              <LegendItem color={VIZ.tiers.medium} label="Orta" />
              <LegendItem color={VIZ.tiers.calm} label="Sakin" />
            </div>
          </ChartCard>

          {multi && (
            <ChartCard
              className="mt-3"
              title="Günlere göre ciro"
              description={
                allTime ? "İlk satış gününden bugüne" : isRange ? "Koyu çizgi: önceki dönemin aynı sıradaki günü" : view === "week" ? "Koyu çizgi: geçen haftanın aynı günü" : "Koyu çizgi: geçen ayın aynı günü"
              }
              table={{
                columns: allTime ? ["Gün", "Ciro", "Sipariş", "Ort. sepet"] : ["Gün", "Ciro", periodLabel, "Sipariş", "Ort. sepet"],
                rows: days.map((d, i) => [
                  `${WEEKDAYS_SHORT_TR[weekdayOf(d.date)]} ${formatDateShortTr(d.date)}`,
                  tl(d.revenue, { decimals: "never" }),
                  ...(allTime ? [] : [tl(prevDays[i]?.revenue ?? 0, { decimals: "never" })]),
                  d.orders,
                  d.orders ? tl(d.revenue / d.orders, { decimals: "never" }) : "—",
                ]),
              }}
            >
              <ColumnChart
                height={240}
                data={days.map((d, i) => ({
                  key: d.date,
                  label:
                    view === "week"
                      ? WEEKDAYS_SHORT_TR[i]
                      : allTime || isRange
                        ? `${Number(d.date.slice(8))}.${Number(d.date.slice(5, 7))}`
                        : String(Number(d.date.slice(8))),
                  value: d.revenue,
                  compare: allTime ? null : (prevDays[i]?.revenue ?? null),
                  tooltip: (
                    <>
                      <p className="text-[14px] font-bold">{tl(d.revenue, { decimals: "never" })}</p>
                      <p className="text-stone-300">
                        {formatDateShortTr(d.date)} {WEEKDAYS_TR[weekdayOf(d.date)]} · {d.orders} sipariş
                      </p>
                      {!allTime && (
                        <p className="text-stone-400">
                          {periodLabel} {tl(prevDays[i]?.revenue ?? 0, { decimals: "never" })}
                        </p>
                      )}
                    </>
                  ),
                }))}
              />
              {!allTime && (
                <div className="mt-2 flex flex-wrap gap-3">
                  <LegendItem color={VIZ.primary} label={isRange ? "Seçilen dönem" : view === "week" ? "Bu hafta" : "Bu ay"} />
                  <LegendItem color={VIZ.ink} label={periodLabel} line />
                </div>
              )}
            </ChartCard>
          )}

          {/* Ürünler */}
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader title="En çok satanlar" description="Satış adedine göre" />
              <div className="px-4 pb-4 pt-3 sm:px-5">
                <BarList
                  items={top.map((p) => ({
                    key: p.product_id ?? p.name,
                    label: p.name,
                    value: p.qty,
                    display: `${num(p.qty, 0)} adet`,
                    sub: tl(p.revenue, { decimals: "never" }),
                  }))}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="En az satanlar" description="Satılanlar arasından" />
              <div className="px-4 pb-4 pt-3 sm:px-5">
                <BarList
                  color={VIZ.context}
                  items={least.map((p) => ({
                    key: p.product_id ?? p.name,
                    label: p.name,
                    value: p.qty,
                    display: `${num(p.qty, 0)} adet`,
                    sub: tl(p.revenue, { decimals: "never" }),
                  }))}
                />
                {unsold.length > 0 && (
                  <details className="mt-4 rounded-xl bg-stone-50 px-3 py-2 text-[13px]">
                    <summary className="cursor-pointer font-semibold text-stone-700">Hiç satılmayan {unsold.length} ürün</summary>
                    <p className="mt-2 text-stone-600">{unsold.map((u) => u.name).join(", ")}</p>
                  </details>
                )}
              </div>
            </Card>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader title="Kategorilere göre ciro" />
              <div className="px-4 pb-4 pt-3 sm:px-5">
                <BarList
                  items={categories.map((c) => ({
                    key: c.category,
                    label: c.category,
                    value: c.revenue,
                    display: tl(c.revenue, { decimals: "never" }),
                    sub: showProfit
                      ? `${num(c.qty, 0)} adet · marj ${c.revenue > 0 ? pct((c.revenue - c.cost) / c.revenue, 0) : "—"}`
                      : `${num(c.qty, 0)} adet`,
                  }))}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Masa işgal süreleri" description="İlk ürün eklenmesinden ödemeye kadar" />
              <div className="px-4 pb-4 pt-3 sm:px-5">
                <BarList
                  items={tables.slice(0, 10).map((tb) => ({
                    key: tb.table_id ?? tb.name,
                    label: tb.name,
                    value: tb.minutes,
                    display: formatMinutes(tb.minutes),
                    sub: `${tb.sessions} oturum · ort. ${formatMinutes(tb.avg)}`,
                  }))}
                  emptyText="Masa oturumu yok"
                />
                {current.longest.length > 0 && (
                  <div className="mt-4 border-t border-stone-100 pt-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-stone-600">
                      <Clock className="size-4" /> En uzun oturumlar
                    </p>
                    <ul className="flex flex-col gap-1 text-[13px]">
                      {current.longest.map((l, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span>
                            <strong>{l.table_name}</strong> · {formatTime(l.opened_at, timezone)}–{formatTime(l.closed_at, timezone)}
                            {multi && <span className="text-stone-500"> · {formatDateShortTr(toIsoDate(l.opened_at, timezone))}</span>}
                          </span>
                          <span className="tabular-nums text-stone-600">
                            {formatMinutes(l.minutes)} · {tl(l.revenue, { decimals: "never" })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {current.options.length > 0 && (
            <Card className="mt-3">
              <CardHeader title="Seçenek kullanımı" description="Vegan süt, ekstra shot, buzlu gibi seçimlerin kaç kez istendiği" />
              <div className="flex flex-wrap gap-2 px-4 pb-4 pt-3 sm:px-5">
                {current.options.map((o) => (
                  <span key={o.id} className="rounded-full border border-stone-200 px-3 py-1 text-[13px]">
                    <span className="text-stone-500">{o.group_name}:</span> <strong>{o.name}</strong> · {num(o.qty, 0)}
                  </span>
                ))}
              </div>
            </Card>
          )}

          <p className="mt-6 text-center text-[12px] text-stone-400">
            Maliyetler satış anındaki reçete ve alış fiyatlarıyla hesaplanır. Fiyatları sonradan girdiysen{" "}
            <Link prefetch={false} href={`/${slug}/menu`} className="font-semibold text-brand-700 underline-offset-2 hover:underline">
              Menü › Geçmiş maliyetleri güncelle
            </Link>{" "}
            ile düzeltebilirsin.
          </p>
        </>
      )}
    </main>
  );
}

function HourChip({
  icon,
  tone,
  title,
  hour,
  view,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  hour: { hour: number; rounds: number; avgRounds: number } | null;
  view: "day" | "week";
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-200 px-3 py-2.5">
      <span className="grid size-9 place-items-center rounded-lg text-white" style={{ background: tone }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-stone-500">{title}</p>
        <p className="text-[15px] font-bold">{hour ? hourRangeLabel(hour.hour) : "—"}</p>
        {hour && (
          <p className="text-[12px] text-stone-500">
            {view === "day" ? `${hour.rounds} sipariş` : `günde ort. ${num(hour.avgRounds, 1)} sipariş`}
          </p>
        )}
      </div>
    </div>
  );
}
