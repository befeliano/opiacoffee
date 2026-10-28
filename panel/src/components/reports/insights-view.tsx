"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChefHat, Info, Sparkles, Target, TrendingUp } from "lucide-react";
import { ChartCard, compactNumber, LegendItem, VIZ } from "@/components/charts/chart-kit";
import { ColumnChart } from "@/components/charts/column-chart";
import { Heatmap } from "@/components/charts/heatmap";
import { LineChart } from "@/components/charts/line-chart";
import { ScatterChart } from "@/components/charts/scatter-chart";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Segmented } from "@/components/ui/surface";
import type { DailyRow, Expense, HourlyRow, ProductDailyRow, ReportData } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { expensesForMonth } from "@/lib/domain/expenses";
import {
  backtest,
  confidenceOf,
  fitSeries,
  forecastSeries,
  productDemand,
  projectMonth,
  weekdayHourMatrix,
  type Confidence,
} from "@/lib/domain/forecast";
import { engineerMenu, MENU_CLASS, type MenuClass } from "@/lib/domain/menu-engineering";
import { classifyDay, rainyDayFavorites, WEATHER_CLASS, weatherImpact, type WeatherClass } from "@/lib/domain/weather";
import { useWeather } from "@/lib/weather/use-weather";
import { change, fillDays, totalsOf, weekdayAverages } from "@/lib/domain/report";
import {
  addDays,
  formatDateShortTr,
  formatDateTr,
  monthEnd,
  monthStart,
  weekdayOf,
  weekStart,
  WEEKDAYS_SHORT_TR,
  WEEKDAYS_TR,
} from "@/lib/domain/time";
import { currencySymbol, num, pct, tl } from "@/lib/format";
import { Delta } from "./stat-tile";
import { usePerms } from "@/components/shell/perms";

const CONFIDENCE: Record<Confidence, { label: string; tone: "green" | "amber" | "red" }> = {
  high: { label: "Tahmin güveni yüksek", tone: "green" },
  medium: { label: "Tahmin güveni orta", tone: "amber" },
  low: { label: "Tahmin için veri az", tone: "red" },
};

export function InsightsView({
  slug,
  today,
  historyFrom,
  history,
  last30,
  productDaily,
  expenses,
  openHour,
  closeHour,
  allFrom,
}: {
  slug: string;
  today: string;
  /** "Tüm zamanlar": ilk satış günü — menü mühendisliği, gün deseni ve yoğunluk haritası buradan başlar */
  allFrom: string | null;
  historyFrom: string;
  history: { daily: DailyRow[]; hourly: HourlyRow[] };
  last30: ReportData;
  productDaily: ProductDailyRow[];
  expenses: Expense[] | null;
  openHour: number;
  closeHour: number;
}) {
  const router = useRouter();
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const showProfit = usePerms().profit;

  // Bugün yarım gün olduğu için model dünü son gün kabul eder
  const yesterday = addDays(today, -1);
  const days = useMemo(() => fillDays(history.daily, historyFrom, today), [history.daily, historyFrom, today]);
  const complete = useMemo(() => days.filter((d) => d.date <= yesterday), [days, yesterday]);

  const revenueModel = useMemo(() => fitSeries(complete.map((d) => ({ date: d.date, value: d.revenue }))), [complete]);
  const ordersModel = useMemo(() => fitSeries(complete.map((d) => ({ date: d.date, value: d.orders }))), [complete]);
  const model = metric === "revenue" ? revenueModel : ordersModel;
  const confidence = confidenceOf(revenueModel);
  const baseForecast = model ? forecastSeries(model, yesterday, 8) : [];

  // Hava: geçmiş günlerin havası ciroyla eşleştirilir; gelecek günlerin hava
  // tahminine göre tahmin düzeltilir (az veride etki 1'e doğru küçültülür).
  const weather = useWeather();
  const weatherByDate = useMemo(() => new Map((weather?.daily ?? []).map((d) => [d.date, d])), [weather]);
  const impact = useMemo(() => weatherImpact(complete, weatherByDate), [complete, weatherByDate]);
  const impactByClass = new Map(impact.map((r) => [r.cls, r]));
  const forecast = baseForecast.map((f) => {
    const w = weatherByDate.get(f.date);
    const cls: WeatherClass | null = w ? classifyDay(w) : null;
    const row = cls ? impactByClass.get(cls) : undefined;
    const k = row ? (metric === "revenue" ? row.factor : row.ordersFactor) : 1;
    return { ...f, value: f.value * k, low: f.low * k, high: f.high * k, cls, factor: k, precipProb: w?.precipProb ?? null };
  });

  // Geçmişe dönük test: her gün, yalnızca önceki günlerin verisiyle tahmin edilir
  const bt = useMemo(
    () => backtest(complete.map((d) => ({ date: d.date, value: metric === "revenue" ? d.revenue : d.orders })), 28),
    [complete, metric],
  );
  const btByDate = new Map(bt.points.map((p) => [p.date, p]));
  const fmt = metric === "revenue" ? (v: number) => tl(v, { decimals: "never" }) : (v: number) => num(v, 0);

  // Son 28 gün gerçekleşen + 7 gün tahmin
  const recent = complete.slice(-28);
  const labels = [...recent.map((d) => d.date), ...forecast.map((f) => f.date)];
  const actualValues = [...recent.map((d) => (metric === "revenue" ? d.revenue : d.orders)), ...forecast.map(() => null)];
  const forecastValues = [...recent.map((_, i) => (i === recent.length - 1 ? actualValues[i] : null)), ...forecast.map((f) => f.value)];
  const bandValues = [...recent.map(() => null), ...forecast.map((f) => ({ low: f.low, high: f.high }))];
  const pastPredicted = [...recent.map((d) => btByDate.get(d.date)?.predicted ?? null), ...forecast.map(() => null)];

  // Ay sonu projeksiyonu
  const last30Totals = totalsOf(last30.daily);
  const costRatio = last30Totals.revenue > 0 ? last30Totals.cost / last30Totals.revenue : 0.3;
  const commissionRatio = last30Totals.revenue > 0 ? last30Totals.commission / last30Totals.revenue : 0.02;
  const monthExpenses = expenses ? expensesForMonth(expenses, today) : null;
  const projection = projectMonth({
    today,
    monthStart: monthStart(today),
    monthEnd: monthEnd(today),
    daily: days,
    model: revenueModel,
    costRatio,
    commissionRatio,
    fixedExpenses: monthExpenses?.total ?? 0,
  });

  // Büyüme
  const sumRange = (from: string, to: string) => days.filter((d) => d.date >= from && d.date <= to).reduce((s, d) => s + d.revenue, 0);
  const last7 = sumRange(addDays(yesterday, -6), yesterday);
  const prev7 = sumRange(addDays(yesterday, -13), addDays(yesterday, -7));
  const last28 = sumRange(addDays(yesterday, -27), yesterday);
  const prev28 = sumRange(addDays(yesterday, -55), addDays(yesterday, -28));

  // Haftalık toplamlar (son 12 hafta)
  const weeks = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of days) {
      const w = weekStart(d.date);
      map.set(w, (map.get(w) ?? 0) + d.revenue);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  }, [days]);

  // 7 günlük hareketli ortalama
  const movingAvg = complete.map((_, i) => (i < 6 ? null : complete.slice(i - 6, i + 1).reduce((s, d) => s + d.revenue, 0) / 7));

  // Gün deseni ve yoğunluk haritası penceresi: son 8 hafta ya da ilk satıştan beri
  const windowFrom = allFrom ?? addDays(yesterday, -55);
  const windowLabel = allFrom ? `Tüm zamanlar (${formatDateShortTr(allFrom)}'den beri)` : "Son 30 gün";
  const weekdays = weekdayAverages(complete.filter((d) => d.date >= windowFrom));
  const hours = Array.from({ length: Math.max(1, closeHour - openHour) }, (_, i) => openHour + i);
  const matrix = weekdayHourMatrix(history.hourly.filter((h) => h.date >= windowFrom && h.date <= yesterday), windowFrom, yesterday);

  const engineering = engineerMenu(last30);
  const tomorrow = addDays(today, 1);
  const demand = productDemand(productDaily, tomorrow, yesterday);
  const productNames = new Map(last30.menu.map((m) => [m.product_id, m.name]));

  const hasHistory = complete.some((d) => d.orders > 0);

  if (!hasHistory) {
    return (
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-6">
        <PageHeader title="Analiz ve tahmin" />
        <Card className="mt-6">
          <EmptyState
            icon={<Sparkles className="size-6" />}
            title="Analiz için henüz satış geçmişi yok"
            description="İlk haftanın satışlarından sonra trendler, ilk iki haftadan sonra tahminler burada belirir."
          />
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-6">
      <PageHeader
        title="Analiz ve tahmin"
        description={`Son ${complete.length} günün verisiyle · ${formatDateShortTr(historyFrom)} – ${formatDateTr(yesterday)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={allFrom ? "all" : "recent"}
              onChange={(v) => router.push(`/${slug}/analiz${v === "all" ? "?donem=tum" : ""}`, { scroll: false })}
              options={[
                { value: "recent", label: "Son 30 gün" },
                { value: "all", label: "Tüm zamanlar" },
              ]}
            />
            <Badge tone={CONFIDENCE[confidence].tone}>{CONFIDENCE[confidence].label}</Badge>
          </div>
        }
      />

      {/* Tahmin */}
      <ChartCard
        className="mt-5"
        title="Önümüzdeki 7 gün"
        description="Haftanın günü deseni, son eğilim ve hava tahminiyle · gölgeli alan %80 olasılık aralığı"
        action={
          <Segmented
            size="sm"
            value={metric}
            onChange={setMetric}
            options={[
              { value: "revenue", label: "Ciro" },
              { value: "orders", label: "Sipariş" },
            ]}
          />
        }
        table={{
          columns: ["Gün", "Tahmin", "Alt", "Üst"],
          rows: forecast.slice(1).map((f) => [`${WEEKDAYS_SHORT_TR[weekdayOf(f.date)]} ${formatDateShortTr(f.date)}`, fmt(f.value), fmt(f.low), fmt(f.high)]),
        }}
      >
        {model ? (
          <>
            <LineChart
              height={260}
              labels={labels.map((d) => formatDateShortTr(d))}
              series={[
                { id: "actual", label: "Gerçekleşen", color: VIZ.primary, values: actualValues, area: true },
                { id: "forecast", label: "Tahmin", color: VIZ.primary, values: forecastValues, dashed: true, band: bandValues },
                { id: "past", label: "1 gün önceki tahmin", color: VIZ.ink, values: pastPredicted, dashed: true },
              ]}
              format={metric === "revenue" ? compactNumber : (v) => num(v, 0)}
              tooltipTitle={(i) => `${WEEKDAYS_TR[weekdayOf(labels[i])]}, ${formatDateTr(labels[i], { year: false })}`}
            />
            <div className="mt-2 flex flex-wrap gap-3">
              <LegendItem color={VIZ.primary} label="Gerçekleşen" line />
              <LegendItem color={VIZ.primary} label="Tahmin" line dashed />
              <LegendItem color={VIZ.ink} label="Geçmiş günler: 1 gün önce yapılan tahmin" line dashed />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {forecast.slice(1).map((f) => (
                <div key={f.date} className={cn("rounded-xl border px-3 py-2", weekdayOf(f.date) >= 5 ? "border-brand-200 bg-brand-50/50" : "border-stone-200")}>
                  <p className="text-[12px] font-semibold text-stone-500">
                    {WEEKDAYS_SHORT_TR[weekdayOf(f.date)]} · {formatDateShortTr(f.date)}
                  </p>
                  <p className="text-[16px] font-extrabold">{fmt(f.value)}</p>
                  <p className="text-[11px] text-stone-500">
                    {fmt(f.low)} – {fmt(f.high)}
                  </p>
                  {f.cls && (
                    <p className="mt-1 text-[11px] font-semibold text-stone-600" title="Hava tahmini ve geçmişte bu havadaki ciro farkı">
                      {WEATHER_CLASS[f.cls].emoji} {WEATHER_CLASS[f.cls].label}
                      {f.precipProb !== null && f.precipProb >= 30 ? ` %${f.precipProb}` : ""}
                      {Math.abs(f.factor - 1) >= 0.03 && (
                        <span className={f.factor > 1 ? "text-emerald-700" : "text-red-700"}>
                          {" "}
                          {f.factor > 1 ? "+" : "−"}%{Math.round(Math.abs(f.factor - 1) * 100)}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-[14px] text-stone-500">Tahmin için en az 7 günlük satış gerekli.</p>
        )}
      </ChartCard>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <AccuracyCard result={bt} fmt={fmt} />
        <WeatherCard impact={impact} favorites={rainyDayFavorites(productDaily, weatherByDate, productNames)} loaded={!!weather} />
      </div>

      {/* Ay sonu ve büyüme */}
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-500">
                <Target className="size-4" /> Ay sonu projeksiyonu
              </p>
              <p className="mt-1 text-[32px] font-extrabold leading-tight">{tl(projection.projectedRevenue, { decimals: "never" })}</p>
              <p className="text-[13px] text-stone-500">
                Bu ay şu ana kadar {tl(projection.actualRevenue, { decimals: "never" })} · kalan {projection.remainingDays} gün tahmini
              </p>
            </div>
          </div>

          {monthExpenses ? (
            <>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[14px] sm:grid-cols-4">
                <Metric label="Tahmini maliyet" value={tl(projection.projectedCost, { decimals: "never" })} />
                <Metric label="Kart komisyonu" value={tl(projection.projectedCommission, { decimals: "never" })} />
                <Metric label="Sabit + tek seferlik gider" value={tl(projection.fixedExpenses, { decimals: "never" })} />
                <Metric
                  label="Tahmini net kâr"
                  value={tl(projection.projectedNet, { decimals: "never" })}
                  tone={projection.projectedNet >= 0 ? "good" : "bad"}
                />
              </dl>
              {projection.breakEvenRevenue !== null && monthExpenses.total > 0 && (
                <div className="mt-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-semibold text-stone-700">Başabaş noktası: {tl(projection.breakEvenRevenue, { decimals: "never" })} ciro</span>
                    <span className="text-stone-500">günde ort. {tl(projection.breakEvenDaily ?? 0, { decimals: "never" })}</span>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-brand-100" role="img" aria-label={`Başabaşa ulaşma ${pct(projection.actualRevenue / projection.breakEvenRevenue)}`}>
                    <div className="h-3 rounded-full bg-brand-600" style={{ width: `${Math.min(100, (projection.actualRevenue / projection.breakEvenRevenue) * 100)}%` }} />
                  </div>
                  <p className="mt-1.5 text-[12px] text-stone-500">
                    Şu ana kadar başabaşın {pct(projection.actualRevenue / projection.breakEvenRevenue, 0)}’ine ulaşıldı · katkı payı oranı {pct(projection.contributionRatio)}
                  </p>
                </div>
              )}
              {monthExpenses.total === 0 && (
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-[13px] text-stone-600">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Net kâr ve başabaş için{" "}
                    <Link prefetch={false} href={`/${slug}/finans`} className="font-semibold text-brand-700 hover:underline">
                      Finans
                    </Link>{" "}
                    sayfasına kira, fatura, maaş gibi sabit giderleri gir.
                  </span>
                </p>
              )}
            </>
          ) : (
            <p className="mt-4 text-[13px] text-stone-500">Net kâr ve başabaş hesabı yalnızca kafe sahibine görünür.</p>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-500">
            <TrendingUp className="size-4" /> Büyüme hızı (ciro)
          </p>
          <div className="mt-3 flex flex-col gap-4">
            <div>
              <p className="text-[13px] text-stone-500">Son 7 gün</p>
              <p className="text-[22px] font-extrabold">{tl(last7, { decimals: "never" })}</p>
              <Delta value={change(last7, prev7)} label="önceki 7 güne göre" />
            </div>
            <div>
              <p className="text-[13px] text-stone-500">Son 28 gün</p>
              <p className="text-[22px] font-extrabold">{tl(last28, { decimals: "never" })}</p>
              <Delta value={change(last28, prev28)} label="önceki 28 güne göre" />
            </div>
            {revenueModel && (
              <p className="rounded-xl bg-stone-50 px-3 py-2 text-[12px] text-stone-600">
                Eğilim: günlük ciro {revenueModel.trend >= 0 ? "artıyor" : "azalıyor"} (günde yaklaşık {tl(Math.abs(revenueModel.trend), { decimals: "never" })})
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Trendler */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Haftalık ciro"
          description="Son 12 hafta · pazartesi–pazar"
          table={{ columns: ["Hafta", "Ciro"], rows: weeks.map(([w, v]) => [`${formatDateShortTr(w)} haftası`, tl(v, { decimals: "never" })]) }}
        >
          <ColumnChart
            height={220}
            data={weeks.map(([w, v]) => ({
              key: w,
              label: formatDateShortTr(w),
              value: v,
              tooltip: (
                <>
                  <p className="text-[14px] font-bold">{tl(v, { decimals: "never" })}</p>
                  <p className="text-stone-300">
                    {formatDateShortTr(w)} – {formatDateShortTr(addDays(w, 6))}
                  </p>
                </>
              ),
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Günlük ciro ve 7 günlük ortalama"
          description="Dalgalanmayı ayıklayıp gidişatı gösterir"
          table={{
            columns: ["Gün", "Ciro", "7 gün ort."],
            rows: complete.map((d, i) => [formatDateShortTr(d.date), tl(d.revenue, { decimals: "never" }), movingAvg[i] === null ? "—" : tl(movingAvg[i]!, { decimals: "never" })]),
          }}
        >
          <LineChart
            height={220}
            labels={complete.map((d) => formatDateShortTr(d.date))}
            series={[
              { id: "daily", label: "Günlük", color: VIZ.context, values: complete.map((d) => d.revenue) },
              { id: "ma", label: "7 günlük ortalama", color: VIZ.primary, values: movingAvg },
            ]}
          />
          <div className="mt-2 flex flex-wrap gap-3">
            <LegendItem color={VIZ.context} label="Günlük" line />
            <LegendItem color={VIZ.primary} label="7 günlük ortalama" line />
          </div>
        </ChartCard>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-5">
        <ChartCard
          className="lg:col-span-2"
          title="Haftanın günlerine göre ortalama ciro"
          description={allFrom ? `${formatDateShortTr(allFrom)}'den beri` : "Son 8 hafta"}
          table={{ columns: ["Gün", "Ort. ciro", "Ort. sipariş"], rows: weekdays.map((w) => [WEEKDAYS_TR[w.weekday], tl(w.revenue, { decimals: "never" }), num(w.orders, 1)]) }}
        >
          <ColumnChart
            height={220}
            data={weekdays.map((w) => ({
              key: String(w.weekday),
              label: WEEKDAYS_SHORT_TR[w.weekday],
              value: Math.round(w.revenue),
              tooltip: (
                <>
                  <p className="text-[14px] font-bold">{tl(w.revenue, { decimals: "never" })}</p>
                  <p className="text-stone-300">
                    {WEEKDAYS_TR[w.weekday]} · ort. {num(w.orders, 1)} sipariş
                  </p>
                </>
              ),
            }))}
          />
        </ChartCard>
        <ChartCard className="lg:col-span-3" title="Yoğunluk haritası" description={`Haftanın günü × saat · ortalama sipariş turu (${allFrom ? `${formatDateShortTr(allFrom)}'den beri` : "son 8 hafta"})`}>
          <Heatmap matrix={matrix} hours={hours} />
        </ChartCard>
      </div>

      {/* Hazırlık listesi */}
      <Card className="mt-3">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ChefHat className="size-5 text-brand-600" /> Yarın için hazırlık listesi
            </span>
          }
          description={`${WEEKDAYS_TR[weekdayOf(tomorrow)]}, ${formatDateTr(tomorrow, { year: false })} · geçmiş ${WEEKDAYS_TR[weekdayOf(tomorrow)].toLocaleLowerCase("tr")} günleri ve son haftanın satışlarına göre beklenen adet`}
        />
        <div className="px-4 pb-4 pt-3 sm:px-5">
          {demand.length === 0 ? (
            <p className="py-4 text-center text-[14px] text-stone-500">Tahmin için yeterli ürün geçmişi yok.</p>
          ) : (
            <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {demand.slice(0, 15).map((d) => (
                <li key={d.productId} className="flex items-center justify-between border-b border-stone-100 py-1.5 text-[14px]">
                  <span className="truncate">{productNames.get(d.productId) ?? "Silinmiş ürün"}</span>
                  <span className="shrink-0 font-bold tabular-nums">~{Math.ceil(d.expected)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Menü mühendisliği (birim katkı payı maliyet ister) */}
      {showProfit && <MenuEngineering data={engineering} windowLabel={windowLabel} />}
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <dt className="text-[12px] text-stone-500">{label}</dt>
      <dd className={cn("text-[16px] font-bold", tone === "good" && "text-emerald-700", tone === "bad" && "text-red-700")}>{value}</dd>
    </div>
  );
}

function MenuEngineering({ data, windowLabel }: { data: ReturnType<typeof engineerMenu>; windowLabel: string }) {
  const [cls, setCls] = useState<MenuClass | "all">("all");
  if (data.items.length === 0) {
    return (
      <Card className="mt-3">
        <CardHeader title="Menü mühendisliği" description={`${windowLabel} · popülerlik × birim katkı payı`} />
        <EmptyState title="Analiz için maliyetli ürün satışı gerekli" description="Ürün maliyetleri girildikçe ve satış oldukça hangi ürünlerin yıldız, hangilerinin zayıf olduğu burada görünür." />
      </Card>
    );
  }

  const topNames = new Set([...data.items].sort((a, b) => b.qty - a.qty).slice(0, 4).map((i) => i.productId ?? i.name));
  const filtered = cls === "all" ? data.items : data.items.filter((i) => i.cls === cls);

  return (
    <ChartCard
      className="mt-3"
      title="Menü mühendisliği"
      description={`${windowLabel} · yatay: satış payı, dikey: ürün başına katkı payı (fiyat − maliyet)`}
      table={{
        columns: ["Ürün", "Sınıf", "Adet", "Pay", "Birim katkı", "Toplam katkı"],
        rows: data.items.map((i) => [i.name, MENU_CLASS[i.cls].label, i.qty, pct(i.share), tl(i.unitMargin, { decimals: "never" }), tl(i.totalMargin, { decimals: "never" })]),
      }}
    >
      <ScatterChart
        height={320}
        points={data.items.map((i) => ({
          key: i.productId ?? i.name,
          x: i.share,
          y: i.unitMargin,
          label: i.name,
          emphasize: topNames.has(i.productId ?? i.name),
          tooltip: (
            <>
              <p className="text-[14px] font-bold">{i.name}</p>
              <p className="text-stone-300">
                {MENU_CLASS[i.cls].label} · {num(i.qty, 0)} adet ({pct(i.share)})
              </p>
              <p className="text-stone-300">Birim katkı {tl(i.unitMargin, { decimals: "never" })}</p>
            </>
          ),
        }))}
        xThreshold={data.popularityThreshold}
        yThreshold={data.avgMargin}
        formatX={(v) => pct(v, 0)}
        formatY={(v) => compactNumber(v)}
        quadrantLabels={{ tl: "Bilmece", tr: "Yıldız", bl: "Zayıf", br: "İş atı" }}
        xLabel="Satış payı"
        yLabel={`Birim katkı (${currencySymbol()})`}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "star", "plowhorse", "puzzle", "dog"] as const).map((c) => {
          const count = c === "all" ? data.items.length : data.items.filter((i) => i.cls === c).length;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCls(c)}
              className={cn(
                "h-9 rounded-full border px-3 text-[13px] font-semibold",
                cls === c ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-600",
              )}
            >
              {c === "all" ? "Tümü" : MENU_CLASS[c].label} · {count}
            </button>
          );
        })}
      </div>
      {cls !== "all" && <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-[13px] text-brand-900">{MENU_CLASS[cls].advice}</p>}
      <ul className="mt-3 divide-y divide-stone-100">
        {filtered.slice(0, 12).map((i) => (
          <li key={i.productId ?? i.name} className="flex items-center gap-3 py-2 text-[14px]">
            <span className="min-w-0 flex-1 truncate font-medium">{i.name}</span>
            <Badge tone={i.cls === "star" ? "green" : i.cls === "dog" ? "red" : i.cls === "plowhorse" ? "amber" : "brand"}>{MENU_CLASS[i.cls].label}</Badge>
            <span className="w-16 text-right tabular-nums text-stone-600">{num(i.qty, 0)} ad.</span>
            <span className="w-24 text-right font-semibold tabular-nums">{tl(i.totalMargin, { decimals: "never" })}</span>
          </li>
        ))}
      </ul>
      {data.unknownCost.length > 0 && (
        <p className="mt-3 text-[12px] text-stone-500">Maliyeti girilmemiş {data.unknownCost.length} ürün analize dahil edilmedi: {data.unknownCost.map((u) => u.name).join(", ")}</p>
      )}
    </ChartCard>
  );
}

function AccuracyCard({ result, fmt }: { result: ReturnType<typeof backtest>; fmt: (v: number) => string }) {
  const last = [...result.points].reverse().slice(0, 7);
  return (
    <Card className="p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-500">
        <Target className="size-4" /> Tahmin ne kadar tuttu?
      </p>
      {result.points.length === 0 ? (
        <p className="mt-3 text-[14px] text-stone-500">Ölçmek için en az 2 haftalık satış gerekli.</p>
      ) : (
        <>
          <p className="mt-1 text-[13px] text-stone-500">
            Son {result.points.length} günde her gün, yalnızca o güne kadarki veriyle (sonucu bilmeden) yapılan tahmin gerçekleşenle karşılaştırıldı.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Metric label="Ortalama sapma (1 gün önce)" value={result.mape === null ? "—" : `%${Math.round(result.mape * 100)}`} />
            <Metric label="1 hafta önceden" value={result.mapeWeek === null ? "—" : `%${Math.round(result.mapeWeek * 100)}`} />
            <Metric label="%80 aralığında kalan" value={result.coverage === null ? "—" : `%${Math.round(result.coverage * 100)}`} />
            <Metric
              label="Eğilim"
              value={
                result.bias === null
                  ? "—"
                  : Math.abs(result.bias) < 0.03
                    ? "Dengeli"
                    : `%${Math.round(Math.abs(result.bias) * 100)} ${result.bias > 0 ? "yüksek" : "düşük"}`
              }
            />
          </dl>
          <table className="mt-4 w-full text-[13px] tabular-nums">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                <th className="py-1">Gün</th>
                <th className="py-1 text-right">Tahmin</th>
                <th className="py-1 text-right">Gerçek</th>
                <th className="py-1 text-right">Fark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {last.map((p) => {
                const diff = (p.actual - p.predicted) / p.predicted;
                const inBand = p.actual >= p.low && p.actual <= p.high;
                return (
                  <tr key={p.date}>
                    <td className="py-1.5">
                      {WEEKDAYS_SHORT_TR[weekdayOf(p.date)]} {formatDateShortTr(p.date)}
                    </td>
                    <td className="py-1.5 text-right text-stone-500">{fmt(p.predicted)}</td>
                    <td className="py-1.5 text-right font-semibold">{fmt(p.actual)}</td>
                    <td className={cn("py-1.5 text-right font-semibold", inBand ? "text-stone-600" : diff > 0 ? "text-emerald-700" : "text-red-700")}>
                      {diff >= 0 ? "+" : "−"}%{Math.round(Math.abs(diff) * 100)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-stone-400">Renkli fark: gerçekleşen %80 aralığının dışında kaldı.</p>
        </>
      )}
    </Card>
  );
}

function WeatherCard({
  impact,
  favorites,
  loaded,
}: {
  impact: ReturnType<typeof weatherImpact>;
  favorites: ReturnType<typeof rainyDayFavorites>;
  loaded: boolean;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-[13px] font-semibold text-stone-500">Hava durumu ve ciro</p>
      {!loaded ? (
        <p className="mt-3 text-[14px] text-stone-500">Hava verisi yükleniyor…</p>
      ) : impact.length === 0 ? (
        <p className="mt-3 text-[14px] text-stone-500">Karşılaştırma için en az 1 haftalık satış gerekli.</p>
      ) : (
        <>
          <p className="mt-1 text-[13px] text-stone-500">
            Her gün, haftanın aynı gününün ortalamasıyla karşılaştırıldı (hafta sonu etkisi ayıklandı). Gün sayısı arttıkça sonuç güçlenir.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {impact.map((r) => {
              const pctRev = Math.round((r.revenueRatio - 1) * 100);
              const pctOrd = Math.round((r.ordersRatio - 1) * 100);
              return (
                <li key={r.cls} className="flex items-center gap-3 rounded-xl bg-stone-50 px-3 py-2 text-[13px]">
                  <span className="w-32 shrink-0 font-semibold">
                    {WEATHER_CLASS[r.cls].emoji} {WEATHER_CLASS[r.cls].label}
                  </span>
                  <span className="w-14 shrink-0 text-stone-500">{r.days} gün</span>
                  <span className={cn("flex-1 font-bold tabular-nums", pctRev > 2 ? "text-emerald-700" : pctRev < -2 ? "text-red-700" : "text-stone-600")}>
                    Ciro {pctRev >= 0 ? "+" : "−"}%{Math.abs(pctRev)}
                  </span>
                  <span className="shrink-0 tabular-nums text-stone-500">
                    sipariş {pctOrd >= 0 ? "+" : "−"}%{Math.abs(pctOrd)}
                  </span>
                </li>
              );
            })}
          </ul>
          {favorites.items.length > 0 && (
            <div className="mt-4">
              <p className="text-[13px] font-semibold text-stone-700">Yağışlı günlerde öne çıkanlar ({favorites.wetDays} gün)</p>
              <p className="mt-1 text-[13px] text-stone-600">
                {favorites.items.map((i) => `${i.name}${i.lift ? ` ×${i.lift.toFixed(1).replace(".", ",")}` : ""}`).join(" · ")}
              </p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
