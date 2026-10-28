// Tahmin motoru: haftanın günü mevsimselliği + sönümlü Holt (seviye/eğilim)
// Kafe verisi günlük ve güçlü haftalık desenlidir (hafta sonu yoğun). Yöntem:
//  1) Haftanın her günü için mevsimsel katsayı (az veride 1'e doğru küçültülür)
//  2) Seri mevsimsellikten arındırılır, sönümlü Holt ile seviye+eğilim bulunur
//  3) Tahmin = (seviye + sönümlü eğilim) × gün katsayısı
//  4) Belirsizlik bandı: bir adım önceki tahmin hatalarının RMSE'si, ufukla genişler

import type { DailyRow, ProductDailyRow } from "@/lib/api/types";
import { addDays, diffDays, weekdayOf } from "./time";

const ALPHA = 0.35;
const BETA = 0.08;
const PHI = 0.9;
const Z80 = 1.2816;

export type Confidence = "high" | "medium" | "low";

export interface SeriesModel {
  weekdayIndex: number[];
  level: number;
  trend: number;
  rmse: number;
  /** Son 14 günlük bir-adım tahmin hatası (MAPE), yeterli veri yoksa null */
  mape: number | null;
  historyDays: number;
}

export interface ForecastPoint {
  date: string;
  value: number;
  low: number;
  high: number;
}

export function fitSeries(values: { date: string; value: number }[]): SeriesModel | null {
  // İlk satış gününden öncesini at
  const firstIdx = values.findIndex((v) => v.value > 0);
  const series = firstIdx < 0 ? [] : values.slice(firstIdx);
  if (series.length < 7) return null;

  const overallMean = mean(series.map((s) => s.value));
  if (overallMean <= 0) return null;

  // Mevsimsel katsayılar (son 8 hafta), k=1 ile 1'e doğru küçültme
  const recent = series.slice(-56);
  const recentMean = mean(recent.map((s) => s.value)) || overallMean;
  const sums = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (const s of recent) {
    const w = weekdayOf(s.date);
    sums[w] += s.value;
    counts[w] += 1;
  }
  const k = 1;
  let index = sums.map((sum, w) => (sum + k * recentMean) / ((counts[w] + k) * recentMean));
  const idxMean = mean(index);
  index = index.map((v) => (idxMean > 0 ? v / idxMean : 1));

  // Holt (mevsimsellikten arındırılmış)
  const des = series.map((s) => {
    const idx = index[weekdayOf(s.date)];
    return idx > 0.05 ? s.value / idx : s.value;
  });
  let level = mean(des.slice(0, 7));
  let trend = des.length >= 14 ? (mean(des.slice(7, 14)) - mean(des.slice(0, 7))) / 7 : 0;

  const errors: { actual: number; predicted: number }[] = [];
  for (let t = 7; t < des.length; t++) {
    const idx = index[weekdayOf(series[t].date)];
    const predicted = Math.max(0, (level + PHI * trend) * idx);
    errors.push({ actual: series[t].value, predicted });
    const prevLevel = level;
    level = ALPHA * des[t] + (1 - ALPHA) * (level + PHI * trend);
    trend = BETA * (level - prevLevel) + (1 - BETA) * PHI * trend;
  }

  const lastErrors = errors.slice(-28);
  const rmse = lastErrors.length ? Math.sqrt(mean(lastErrors.map((e) => (e.actual - e.predicted) ** 2))) : overallMean * 0.25;
  const mapeSet = errors.slice(-14).filter((e) => e.actual > 0);
  const mape = mapeSet.length >= 7 ? mean(mapeSet.map((e) => Math.abs(e.actual - e.predicted) / e.actual)) : null;

  return { weekdayIndex: index, level, trend, rmse: Math.max(rmse, overallMean * 0.05), mape, historyDays: series.length };
}

export function forecastSeries(model: SeriesModel, lastDate: string, horizon: number): ForecastPoint[] {
  const out: ForecastPoint[] = [];
  let damp = 0;
  for (let h = 1; h <= horizon; h++) {
    damp += PHI ** h;
    const date = addDays(lastDate, h);
    const idx = model.weekdayIndex[weekdayOf(date)];
    const value = Math.max(0, (model.level + model.trend * damp) * idx);
    const spread = Z80 * model.rmse * Math.sqrt(1 + (h - 1) * 0.15);
    out.push({ date, value, low: Math.max(0, value - spread), high: value + spread });
  }
  return out;
}

export function confidenceOf(model: SeriesModel | null): Confidence {
  if (!model) return "low";
  if (model.historyDays >= 28 && model.mape !== null && model.mape <= 0.2) return "high";
  if (model.historyDays >= 14 && (model.mape === null || model.mape <= 0.35)) return "medium";
  return "low";
}

// ---------------------------------------------------------------------
// Ay sonu projeksiyonu ve başabaş
// ---------------------------------------------------------------------
export interface MonthProjection {
  actualRevenue: number;
  projectedRevenue: number;
  projectedCost: number;
  projectedCommission: number;
  fixedExpenses: number;
  projectedNet: number;
  contributionRatio: number | null;
  breakEvenRevenue: number | null;
  breakEvenDaily: number | null;
  remainingDays: number;
}

export function projectMonth(params: {
  today: string;
  monthStart: string;
  monthEnd: string;
  daily: DailyRow[];
  model: SeriesModel | null;
  /** Son dönem maliyet ve komisyon oranları (ciroya göre) */
  costRatio: number;
  commissionRatio: number;
  fixedExpenses: number;
}): MonthProjection {
  const { today, monthStart, monthEnd, daily, model, costRatio, commissionRatio, fixedExpenses } = params;
  const inMonth = daily.filter((d) => d.date >= monthStart && d.date <= monthEnd);
  const actualRevenue = sum(inMonth.filter((d) => d.date <= today).map((d) => d.revenue));
  const actualCost = sum(inMonth.filter((d) => d.date <= today).map((d) => d.cost));
  const actualCommission = sum(inMonth.filter((d) => d.date <= today).map((d) => d.commission));

  let futureRevenue = 0;
  let remainingDays = 0;
  if (today <= monthEnd) {
    remainingDays = diffDays(today, monthEnd);
    if (model) {
      const lastDate = addDays(today, -1);
      const points = forecastSeries(model, lastDate, remainingDays + 1);
      const todayActual = inMonth.find((d) => d.date === today)?.revenue ?? 0;
      const todayForecast = points[0]?.value ?? 0;
      futureRevenue = Math.max(0, todayForecast - todayActual) + sum(points.slice(1).map((p) => p.value));
    }
  }

  const projectedRevenue = actualRevenue + futureRevenue;
  const projectedCost = actualCost + futureRevenue * costRatio;
  const projectedCommission = actualCommission + futureRevenue * commissionRatio;
  const contributionRatio = 1 - costRatio - commissionRatio;
  const breakEvenRevenue = contributionRatio > 0.02 ? fixedExpenses / contributionRatio : null;
  const daysInMonth = diffDays(monthStart, monthEnd) + 1;

  return {
    actualRevenue,
    projectedRevenue,
    projectedCost,
    projectedCommission,
    fixedExpenses,
    projectedNet: projectedRevenue - projectedCost - projectedCommission - fixedExpenses,
    contributionRatio: contributionRatio > 0 ? contributionRatio : null,
    breakEvenRevenue,
    breakEvenDaily: breakEvenRevenue !== null ? breakEvenRevenue / daysInMonth : null,
    remainingDays,
  };
}

// ---------------------------------------------------------------------
// Ürün bazında yarının talep tahmini (hazırlık listesi)
// ---------------------------------------------------------------------
export function productDemand(rows: ProductDailyRow[], targetDate: string, historyEnd: string) {
  const byProduct = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const m = byProduct.get(r.p) ?? new Map<string, number>();
    m.set(r.d, (m.get(r.d) ?? 0) + r.q);
    byProduct.set(r.p, m);
  }
  const targetWeekday = weekdayOf(targetDate);
  const out: { productId: string; expected: number; weekdayAvg: number; recentAvg: number }[] = [];

  for (const [productId, days] of byProduct) {
    // Aynı günün son 4 tekrarı, yakın olana daha çok ağırlık
    const weights = [4, 3, 2, 1];
    let wSum = 0;
    let wTotal = 0;
    for (let i = 0; i < 4; i++) {
      const date = addDays(targetDate, -7 * (i + 1));
      if (date > historyEnd) continue;
      wSum += (days.get(date) ?? 0) * weights[i];
      wTotal += weights[i];
    }
    const weekdayAvg = wTotal ? wSum / wTotal : 0;

    let recent = 0;
    for (let i = 0; i < 7; i++) recent += days.get(addDays(historyEnd, -i)) ?? 0;
    const recentAvg = recent / 7;

    const expected = wTotal ? 0.65 * weekdayAvg + 0.35 * recentAvg : recentAvg;
    if (expected >= 0.3) out.push({ productId, expected, weekdayAvg, recentAvg });
  }
  void targetWeekday;
  return out.sort((a, b) => b.expected - a.expected);
}

// ---------------------------------------------------------------------
// Isı haritası: haftanın günü × saat ortalama sipariş turu
// ---------------------------------------------------------------------
export function weekdayHourMatrix(rows: { date: string; hour: number; rounds: number }[], from: string, to: string) {
  const dayCounts = Array(7).fill(0);
  for (let d = from; d <= to; d = addDays(d, 1)) dayCounts[weekdayOf(d)] += 1;
  const totals = Array.from({ length: 7 }, () => new Map<number, number>());
  for (const r of rows) {
    const w = weekdayOf(r.date);
    totals[w].set(r.hour, (totals[w].get(r.hour) ?? 0) + r.rounds);
  }
  return totals.map((m, w) => {
    const avg = new Map<number, number>();
    for (const [h, v] of m) avg.set(h, dayCounts[w] ? v / dayCounts[w] : 0);
    return avg;
  });
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function sum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------
// Geriye dönük test: "o gün için ne tahmin edilmişti, ne oldu?"
// ---------------------------------------------------------------------
export interface BacktestPoint {
  date: string;
  actual: number;
  /** O günden h gün önce, yalnızca o ana kadarki veriyle yapılan tahmin */
  predicted: number;
  low: number;
  high: number;
}

export interface BacktestResult {
  /** 1 gün önceden yapılan tahminler (grafikte ve tabloda) */
  points: BacktestPoint[];
  /** Ortalama mutlak yüzde sapma (1 gün önceden) */
  mape: number | null;
  /** 7 gün önceden yapılan tahminlerin ortalama sapması */
  mapeWeek: number | null;
  /** Gerçekleşenin %80 aralığında kalma oranı */
  coverage: number | null;
  /** Ortalama işaretli sapma: + tahmin yüksek kalmış, − düşük kalmış */
  bias: number | null;
}

function predictAt(series: { date: string; value: number }[], targetIndex: number, horizon: number): ForecastPoint | null {
  const originIndex = targetIndex - horizon;
  if (originIndex < 6) return null;
  const model = fitSeries(series.slice(0, originIndex + 1));
  if (!model) return null;
  return forecastSeries(model, series[originIndex].date, horizon)[horizon - 1] ?? null;
}

/**
 * Son `days` gün için geçmişe dönük tahmin: her gün, yalnızca o günden önceki
 * veriyle model kurulur (geleceği bilmeden), tahmin gerçekleşenle karşılaştırılır.
 * Satış olmayan (kapalı) günler hesaba katılmaz.
 */
export function backtest(series: { date: string; value: number }[], days = 14): BacktestResult {
  const points: BacktestPoint[] = [];
  const weekErrors: number[] = [];
  for (let i = Math.max(0, series.length - days); i < series.length; i++) {
    const actual = series[i].value;
    if (actual <= 0) continue;
    const p1 = predictAt(series, i, 1);
    if (p1) points.push({ date: series[i].date, actual, predicted: p1.value, low: p1.low, high: p1.high });
    const p7 = predictAt(series, i, 7);
    if (p7) weekErrors.push(Math.abs(actual - p7.value) / actual);
  }
  const n = points.length;
  return {
    points,
    mape: n ? mean(points.map((p) => Math.abs(p.actual - p.predicted) / p.actual)) : null,
    mapeWeek: weekErrors.length ? mean(weekErrors) : null,
    coverage: n ? points.filter((p) => p.actual >= p.low && p.actual <= p.high).length / n : null,
    bias: n ? mean(points.map((p) => (p.predicted - p.actual) / p.actual)) : null,
  };
}
