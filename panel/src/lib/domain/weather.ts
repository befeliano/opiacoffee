// Hava durumu: Open-Meteo yanıtının tipleri, WMO kodları ve hava–ciro analizi.
// Saf hesaplama (ağ yok); test edilebilir.

import type { DailyRow, ProductDailyRow } from "@/lib/api/types";
import { weekdayOf } from "./time";

export interface WeatherDay {
  date: string;
  code: number;
  tmax: number | null;
  tmin: number | null;
  /** mm */
  precip: number;
  /** % (gelecek günler için anlamlı) */
  precipProb: number | null;
  /** km/s */
  wind: number | null;
  /** % */
  cloud: number | null;
}

export interface WeatherHour {
  time: string; // "2026-10-29T14:00" (kafe saati)
  code: number;
  temp: number | null;
  precipProb: number | null;
}

export interface WeatherData {
  fetchedAt: number;
  current: { time: string; temp: number; code: number; wind: number; precip: number } | null;
  daily: WeatherDay[];
  hourly: WeatherHour[];
}

/** Open-Meteo yanıtını sadeleştirir */
export function parseOpenMeteo(json: Record<string, unknown>, fetchedAt = Date.now()): WeatherData {
  const d = (json.daily ?? {}) as Record<string, unknown[]>;
  const h = (json.hourly ?? {}) as Record<string, unknown[]>;
  const c = json.current as Record<string, number | string> | undefined;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    fetchedAt,
    current: c
      ? { time: String(c.time), temp: Number(c.temperature_2m), code: Number(c.weather_code), wind: Number(c.wind_speed_10m), precip: Number(c.precipitation) }
      : null,
    daily: ((d.time ?? []) as string[]).map((date, i) => ({
      date,
      code: num(d.weather_code?.[i]) ?? 0,
      tmax: num(d.temperature_2m_max?.[i]),
      tmin: num(d.temperature_2m_min?.[i]),
      precip: num(d.precipitation_sum?.[i]) ?? 0,
      precipProb: num(d.precipitation_probability_max?.[i]),
      wind: num(d.wind_speed_10m_max?.[i]),
      cloud: num(d.cloud_cover_mean?.[i]),
    })),
    hourly: ((h.time ?? []) as string[]).map((time, i) => ({
      time,
      code: num(h.weather_code?.[i]) ?? 0,
      temp: num(h.temperature_2m?.[i]),
      precipProb: num(h.precipitation_probability?.[i]),
    })),
  };
}

/** WMO hava kodu → kısa Türkçe açıklama */
export function weatherLabel(code: number): string {
  if (code === 0) return "Açık";
  if (code === 1) return "Az bulutlu";
  if (code === 2) return "Parçalı bulutlu";
  if (code === 3) return "Kapalı";
  if (code === 45 || code === 48) return "Sisli";
  if (code >= 51 && code <= 57) return "Çisenti";
  if (code === 61 || code === 80) return "Hafif yağmur";
  if (code === 63 || code === 81) return "Yağmurlu";
  if (code === 65 || code === 82) return "Sağanak";
  if (code === 66 || code === 67) return "Dondurucu yağmur";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Karlı";
  if (code >= 95) return "Gök gürültülü";
  return "Bulutlu";
}

export type WeatherIcon = "sun" | "cloud-sun" | "cloud" | "fog" | "drizzle" | "rain" | "storm" | "snow";

export function weatherIcon(code: number): WeatherIcon {
  if (code <= 1) return "sun";
  if (code === 2) return "cloud-sun";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if (code >= 61) return "rain";
  return "cloud";
}

// ---------------------------------------------------------------------
// Günü hava tipine göre sınıflandırma
// ---------------------------------------------------------------------
export type WeatherClass = "sunny" | "cloudy" | "rainy" | "heavy" | "windy" | "snow";

export const WEATHER_CLASS: Record<WeatherClass, { label: string; emoji: string }> = {
  sunny: { label: "Güneşli", emoji: "☀️" },
  cloudy: { label: "Bulutlu", emoji: "☁️" },
  rainy: { label: "Yağmurlu", emoji: "🌧️" },
  heavy: { label: "Çok yağmurlu", emoji: "⛈️" },
  windy: { label: "Rüzgârlı", emoji: "💨" },
  snow: { label: "Karlı", emoji: "❄️" },
};

/** Öncelik: kar > çok yağmur > yağmur > rüzgâr > güneş > bulut */
export function classifyDay(w: WeatherDay): WeatherClass {
  const c = w.code;
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
  if (w.precip >= 10 || c === 65 || c === 82 || c >= 95) return "heavy";
  if (w.precip >= 1 || (c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return "rainy";
  if ((w.wind ?? 0) >= 35) return "windy";
  if (c <= 1 || (w.cloud !== null && w.cloud < 35)) return "sunny";
  return "cloudy";
}

// ---------------------------------------------------------------------
// Havanın ciroya etkisi
// ---------------------------------------------------------------------
export interface WeatherImpactRow {
  cls: WeatherClass;
  days: number;
  /** Haftanın aynı günü ortalamasına göre ciro oranı (1 = etkisiz) */
  revenueRatio: number;
  ordersRatio: number;
  /** Ciro tahminine uygulanacak katsayı: az günlük veride 1'e doğru küçültülür */
  factor: number;
  /** Sipariş tahmini için aynı katsayı */
  ordersFactor: number;
  avgRevenue: number;
}

/** Az veride aşırı tepki vermesin: n gün → oranın n/(n+K)'si kadar etki */
const SHRINK_K = 4;

/**
 * Günlük ciroyu "haftanın aynı günü ortalamasına" bölerek hafta içi/sonu
 * etkisini ayıklar; kalan farkı hava tipine göre toplar.
 */
export function weatherImpact(days: DailyRow[], weather: Map<string, WeatherDay>): WeatherImpactRow[] {
  const open = days.filter((d) => d.orders > 0);
  if (open.length < 7) return [];
  const byWeekday = Array.from({ length: 7 }, () => ({ revenue: 0, orders: 0, n: 0 }));
  for (const d of open) {
    const w = byWeekday[weekdayOf(d.date)];
    w.revenue += d.revenue;
    w.orders += d.orders;
    w.n += 1;
  }
  const groups = new Map<WeatherClass, { rr: number[]; or: number[]; rev: number[] }>();
  for (const d of open) {
    const wd = weather.get(d.date);
    const base = byWeekday[weekdayOf(d.date)];
    if (!wd || base.n < 2 || base.revenue <= 0) continue;
    const cls = classifyDay(wd);
    const g = groups.get(cls) ?? { rr: [], or: [], rev: [] };
    g.rr.push(d.revenue / (base.revenue / base.n));
    g.or.push(d.orders / (base.orders / base.n));
    g.rev.push(d.revenue);
    groups.set(cls, g);
  }
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return [...groups.entries()]
    .map(([cls, g]) => {
      const n = g.rr.length;
      const revenueRatio = avg(g.rr);
      const ordersRatio = avg(g.or);
      const weight = n / (n + SHRINK_K);
      return {
        cls,
        days: n,
        revenueRatio,
        ordersRatio,
        factor: 1 + (revenueRatio - 1) * weight,
        ordersFactor: 1 + (ordersRatio - 1) * weight,
        avgRevenue: avg(g.rev),
      };
    })
    .sort((a, b) => b.days - a.days);
}

/** Yağmurlu günlerde payı artan ürünler (satış adedi payına göre) */
export function rainyDayFavorites(rows: ProductDailyRow[], weather: Map<string, WeatherDay>, names: Map<string, string>, n = 5) {
  const wet = new Map<string, number>();
  const dry = new Map<string, number>();
  let wetTotal = 0;
  let dryTotal = 0;
  const wetDays = new Set<string>();
  for (const r of rows) {
    const w = weather.get(r.d);
    if (!w) continue;
    const cls = classifyDay(w);
    const isWet = cls === "rainy" || cls === "heavy" || cls === "snow";
    const target = isWet ? wet : dry;
    target.set(r.p, (target.get(r.p) ?? 0) + r.q);
    if (isWet) {
      wetTotal += r.q;
      wetDays.add(r.d);
    } else dryTotal += r.q;
  }
  if (wetTotal === 0 || dryTotal === 0) return { wetDays: wetDays.size, items: [] };
  const items = [...wet.entries()]
    .filter(([, q]) => q >= 3)
    .map(([p, q]) => {
      const wetShare = q / wetTotal;
      const dryShare = (dry.get(p) ?? 0) / dryTotal;
      return { productId: p, name: names.get(p) ?? "Ürün", wetQty: q, lift: dryShare > 0 ? wetShare / dryShare : null };
    })
    .filter((i) => i.lift === null || i.lift > 1.15)
    .sort((a, b) => (b.lift ?? 9) - (a.lift ?? 9))
    .slice(0, n);
  return { wetDays: wetDays.size, items };
}
