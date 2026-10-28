// Rapor verisinden türetilen metrikler (saf fonksiyonlar, test edilebilir)

import type { DailyRow, HourlyRow, ProductRow, ReportData, TableRow } from "@/lib/api/types";
import { eachDay, weekdayOf } from "./time";

export interface Totals {
  days: number;
  orders: number;
  revenue: number;
  cost: number;
  commission: number;
  card: number;
  cash: number;
  ticket: number;
  discount: number;
  compValue: number;
  items: number;
  tableSessions: number;
  occupancyMinutes: number;
  takeawayOrders: number;
  cancelled: number;
  /** Kişi sayısı girilmiş adisyonlardaki toplam kişi */
  guests: number;
  guestOrders: number;
  guestRevenue: number;
  /** Kişi başı harcama (yalnızca kişi sayısı girilmiş adisyonlardan) */
  perGuest: number | null;
  /** Adisyon başına ortalama kişi */
  guestsPerOrder: number | null;
  /** Ciro − maliyet − kart komisyonu */
  grossProfit: number;
  avgBasket: number | null;
  avgOccupancy: number | null;
  costRatio: number | null;
  marginRatio: number | null;
}

export function totalsOf(daily: DailyRow[], days = daily.length): Totals {
  const sum = (k: keyof DailyRow) => daily.reduce((s, d) => s + Number(d[k] ?? 0), 0);
  const revenue = round2(sum("revenue"));
  const cost = round2(sum("cost"));
  const commission = round2(sum("commission"));
  const orders = sum("orders");
  const tableSessions = sum("table_sessions");
  const occupancyMinutes = sum("occupancy_minutes");
  const grossProfit = round2(revenue - cost - commission);
  return {
    days,
    orders,
    revenue,
    cost,
    commission,
    card: round2(sum("card")),
    cash: round2(sum("cash")),
    ticket: round2(sum("ticket")),
    discount: round2(sum("discount")),
    compValue: round2(sum("comp_value")),
    items: sum("items"),
    tableSessions,
    occupancyMinutes,
    takeawayOrders: sum("takeaway_orders"),
    cancelled: sum("cancelled"),
    guests: sum("guests"),
    guestOrders: sum("guest_orders"),
    guestRevenue: round2(sum("guest_revenue")),
    perGuest: sum("guests") > 0 ? round2(sum("guest_revenue") / sum("guests")) : null,
    guestsPerOrder: sum("guest_orders") > 0 ? Math.round((sum("guests") / sum("guest_orders")) * 10) / 10 : null,
    grossProfit,
    avgBasket: orders > 0 ? round2(revenue / orders) : null,
    avgOccupancy: tableSessions > 0 ? occupancyMinutes / tableSessions : null,
    costRatio: revenue > 0 ? cost / revenue : null,
    marginRatio: revenue > 0 ? grossProfit / revenue : null,
  };
}

/** Yüzde değişim; önceki değer 0 ise null */
export function change(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || !Number.isFinite(previous) || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

// ---------------------------------------------------------------------
// Saatlik yoğunluk
// ---------------------------------------------------------------------
export type Tier = "busy" | "medium" | "calm";

export interface HourStat {
  hour: number;
  rounds: number;
  items: number;
  revenue: number;
  /** Aralıktaki gün sayısına bölünmüş ortalama sipariş turu */
  avgRounds: number;
  tier: Tier;
}

export interface HourlySummary {
  hours: HourStat[];
  busiest: HourStat | null;
  medium: HourStat | null;
  calmest: HourStat | null;
}

/**
 * Açılış–kapanış saatleri arasındaki her saat için sipariş turlarını toplar ve
 * üçe böler (en yoğun / orta / en sakin). Hiç sipariş olmayan açık saatler de
 * "sakin" sayılır.
 */
export function hourlySummary(rows: HourlyRow[], openHour: number, closeHour: number, days: number): HourlySummary {
  const byHour = new Map<number, { rounds: number; items: number; revenue: number }>();
  for (const r of rows) {
    const e = byHour.get(r.hour) ?? { rounds: 0, items: 0, revenue: 0 };
    e.rounds += r.rounds;
    e.items += r.items;
    e.revenue += r.revenue;
    byHour.set(r.hour, e);
  }
  const hoursWithData = [...byHour.keys()];
  const start = Math.min(openHour, ...hoursWithData.filter((h) => h < openHour));
  const end = Math.max(closeHour - 1, ...hoursWithData.filter((h) => h >= closeHour));
  const divisor = Math.max(days, 1);

  const hours: HourStat[] = [];
  for (let h = start; h <= end; h++) {
    const e = byHour.get(h) ?? { rounds: 0, items: 0, revenue: 0 };
    hours.push({ hour: h, rounds: e.rounds, items: e.items, revenue: round2(e.revenue), avgRounds: e.rounds / divisor, tier: "calm" });
  }
  if (hours.every((h) => h.rounds === 0)) return { hours, busiest: null, medium: null, calmest: null };

  // Sıralama: tur sayısı, eşitlikte ürün adedi
  const ranked = [...hours].sort((a, b) => b.rounds - a.rounds || b.items - a.items || a.hour - b.hour);
  const third = Math.ceil(ranked.length / 3);
  ranked.forEach((h, i) => {
    h.tier = i < third ? "busy" : i < third * 2 ? "medium" : "calm";
  });

  const calmest = [...hours].sort((a, b) => a.rounds - b.rounds || a.items - b.items || a.hour - b.hour)[0];
  const medium = ranked[Math.floor((ranked.length - 1) / 2)];
  return { hours, busiest: ranked[0], medium, calmest };
}

// ---------------------------------------------------------------------
// Ürünler, masalar
// ---------------------------------------------------------------------
export function topProducts(products: ProductRow[], n = 5) {
  return [...products].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, n);
}

/** En az satanlar (satılanlar arasından) ve hiç satılmayan aktif ürünler */
export function leastProducts(report: Pick<ReportData, "products" | "menu">, n = 5) {
  const sold = [...report.products].filter((p) => p.qty > 0).sort((a, b) => a.qty - b.qty || a.revenue - b.revenue);
  const soldIds = new Set(report.products.map((p) => p.product_id));
  const unsold = report.menu.filter((m) => m.is_active && !soldIds.has(m.product_id));
  return { least: sold.slice(0, n), unsold };
}

export function categoryBreakdown(products: ProductRow[]) {
  const map = new Map<string, { category: string; qty: number; revenue: number; cost: number }>();
  for (const p of products) {
    const key = p.category || "Diğer";
    const e = map.get(key) ?? { category: key, qty: 0, revenue: 0, cost: 0 };
    e.qty += p.qty;
    e.revenue += p.revenue;
    e.cost += p.cost;
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

export function tableStats(tables: TableRow[]) {
  return [...tables]
    .map((t) => ({ ...t, avg: t.sessions > 0 ? t.minutes / t.sessions : 0 }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Aralıktaki her gün için satır (satış olmayan günler sıfırla doldurulur) */
export function fillDays(daily: DailyRow[], from: string, to: string): DailyRow[] {
  const map = new Map(daily.map((d) => [d.date, d]));
  return eachDay(from, to).map(
    (date) =>
      map.get(date) ?? {
        date,
        orders: 0,
        revenue: 0,
        cost: 0,
        commission: 0,
        card: 0,
        cash: 0,
        ticket: 0,
        discount: 0,
        comp_value: 0,
        items: 0,
        table_sessions: 0,
        occupancy_minutes: 0,
        takeaway_orders: 0,
        cancelled: 0,
      },
  );
}

export function weekdayAverages(daily: DailyRow[]) {
  const acc = Array.from({ length: 7 }, () => ({ revenue: 0, orders: 0, n: 0 }));
  for (const d of daily) {
    const w = weekdayOf(d.date);
    acc[w].revenue += d.revenue;
    acc[w].orders += d.orders;
    acc[w].n += 1;
  }
  return acc.map((a, weekday) => ({
    weekday,
    revenue: a.n ? a.revenue / a.n : 0,
    orders: a.n ? a.orders / a.n : 0,
    days: a.n,
  }));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
