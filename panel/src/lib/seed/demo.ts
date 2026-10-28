// Yerel demo modu için gerçekçi, tekrarlanabilir satış geçmişi üretir.
// Hafta içi/sonu ve saatlik yoğunluk desenleri, masa çakışması olmadan
// oturma süreleri, çok turlu siparişler, parçalı ödeme, ikram ve iptal içerir.

import type { CafeDef, SeedIds } from "./menus";
import { addDays, todayIn, weekdayOf, zonedToUtc } from "../domain/time";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEEKDAY_FACTOR = [0.82, 0.86, 0.9, 0.96, 1.12, 1.38, 1.3]; // Pzt … Paz
const HOUR_WEIGHT: Record<number, number> = {
  10: 0.45, 11: 0.75, 12: 1.0, 13: 1.15, 14: 1.3, 15: 1.45, 16: 1.55,
  17: 1.3, 18: 1.05, 19: 1.15, 20: 1.3, 21: 1.1, 22: 0.75, 23: 0.35,
};
const FOOD_CATEGORIES = new Set(["Tatlılar", "Atıştırmalık", "Atıştırmalıklar"]);

// Sepet büyüklüğü ayarları (hedef: günde ~26 adisyon, ~7–9 bin ₺ ciro)
const PARTY_WEIGHTS = [0.72, 0.2, 0.06, 0.02]; // 1–4 kişi
const TAKEAWAY_RATIO = 0.28;
const FOOD_CHANCE_FIRST = 0.12;
const FOOD_CHANCE_LATER = 0.3;
const SECOND_ROUND = [0.9, 0.09, 0.01]; // 1, 2, 3 tur

interface DemoOrder {
  id: string;
  is_demo: true;
  table_id: string;
  table_name: string;
  is_takeaway: boolean;
  status: "open" | "paid" | "cancelled";
  opened_at: string;
  closed_at: string | null;
  discount_amount: number;
  cancel_reason: string;
  /** Kişi sayısı: masada çoğu zaman girilir, gel-al siparişlerinde boş */
  guests: number | null;
}
interface DemoItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  category_name: string;
  option_ids: string[];
  options_label: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  is_comp: boolean;
  created_at: string;
}
interface DemoPayment {
  id: string;
  order_id: string;
  method: "cash" | "card";
  amount: number;
  commission_rate: number;
  commission_amount: number;
  created_at: string;
}

export function generateDemoOrders(
  def: CafeDef,
  ids: SeedIds,
  opts: { days: number; now: Date; tz: string; seed: number; commissionRate: number; uuid: () => string },
) {
  const rand = mulberry32(opts.seed);
  const { uuid, tz, now } = opts;
  const pick = <T,>(items: T[], weight: (t: T) => number): T => {
    const total = items.reduce((s, t) => s + weight(t), 0);
    let r = rand() * total;
    for (const t of items) {
      r -= weight(t);
      if (r <= 0) return t;
    }
    return items[items.length - 1];
  };
  const between = (min: number, max: number) => min + rand() * (max - min);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Fiyatı satışta girilen (joker) ürün test verisine girmez
  const sellable = ids.products.filter((p) => p.price > 0);
  const drinks = sellable.filter((p) => !FOOD_CATEGORIES.has(p.category));
  const foods = sellable.filter((p) => FOOD_CATEGORIES.has(p.category));
  const groupById = new Map(ids.groups.map((g) => [g.id, g]));
  const dineTables = ids.tables.filter((t) => !t.isTakeaway);
  const takeaway = ids.tables.find((t) => t.isTakeaway);

  const orders: DemoOrder[] = [];
  const items: DemoItem[] = [];
  const payments: DemoPayment[] = [];

  const today = todayIn(tz, now);
  const nowMs = now.getTime();
  const hours = Object.keys(HOUR_WEIGHT).map(Number).filter((h) => h >= def.openHour && h < def.closeHour);

  const chooseOptions = (groupIds: string[]) => {
    const chosen: { id: string; name: string; priceDelta: number; isDefault: boolean; unitCost: number }[] = [];
    for (const gid of groupIds) {
      const g = groupById.get(gid);
      if (!g || g.options.length === 0) continue;
      if (g.selection === "single") {
        // Zorunlu olmayan, varsayılanı da olmayan grup (ör. ekstra shot): payların toplamı kadar seçilir
        const total = g.options.reduce((s, o) => s + o.share, 0);
        if (!g.isRequired && !g.options.some((o) => o.isDefault) && total < 1 && rand() >= total) continue;
        chosen.push(pick(g.options, (o) => o.share || 0.0001));
      } else {
        for (const o of g.options) if (rand() < o.share) chosen.push(o);
      }
    }
    return chosen;
  };

  for (let offset = opts.days; offset >= 0; offset--) {
    const date = addDays(today, -offset);
    const progress = 1 - offset / Math.max(opts.days, 1);
    const trend = 0.86 + 0.2 * progress; // dönem boyunca hafif büyüme
    const noise = between(0.88, 1.12);
    const count = Math.round(def.demoDailyOrders * WEEKDAY_FACTOR[weekdayOf(date)] * trend * noise);

    const starts = Array.from({ length: count }, () => {
      const hour = pick(hours, (h) => HOUR_WEIGHT[h]);
      return zonedToUtc(date, hour, Math.floor(rand() * 60), Math.floor(rand() * 60), tz).getTime();
    }).sort((a, b) => a - b);

    const tableFreeAt = new Map<string, number>();
    const closeMs = zonedToUtc(date, 0, 0, 0, tz).getTime() + def.closeHour * 3_600_000 - 60_000;

    for (const start of starts) {
      if (start >= nowMs - 60_000) continue;

      let isTakeaway = rand() < TAKEAWAY_RATIO;
      let table = takeaway;
      let duration = between(2, 6);
      if (!isTakeaway) {
        const free = dineTables.filter((t) => (tableFreeAt.get(t.id) ?? 0) <= start);
        if (free.length === 0) {
          isTakeaway = true;
        } else {
          table = free[Math.floor(rand() * free.length)];
          // Oturma süresi: çoğunluk 30–75 dk, uzun kuyruk 2 saate kadar
          duration = Math.min(150, 18 + Math.exp(between(2.6, 4.4)));
        }
      }
      if (!table) continue;

      const end = Math.min(start + duration * 60_000, closeMs);
      if (!isTakeaway) tableFreeAt.set(table.id, end + between(2, 10) * 60_000);

      const orderId = uuid();
      const party = isTakeaway ? pick([1, 2], (n) => (n === 1 ? 0.85 : 0.15)) : pick([1, 2, 3, 4], (n) => PARTY_WEIGHTS[n - 1]);
      const roundsCount = isTakeaway ? 1 : pick([1, 2, 3], (n) => SECOND_ROUND[n - 1]);

      let subtotal = 0;
      const orderItems: DemoItem[] = [];
      for (let r = 0; r < roundsCount; r++) {
        const roundAt = start + (r === 0 ? 0 : ((end - start) * r) / (roundsCount + 0.3));
        if (roundAt >= nowMs) break;
        const lines = new Map<string, DemoItem>();
        const people = r === 0 ? party : Math.max(1, Math.round(party * between(0.3, 0.8)));
        for (let p = 0; p < people; p++) {
          const wantsFood = r === 0 ? rand() < FOOD_CHANCE_FIRST : rand() < FOOD_CHANCE_LATER;
          const wantsDrink = r === 0 || rand() < 0.65;
          const picks = [
            ...(wantsDrink ? [pick(drinks, (d) => d.weight)] : []),
            ...(wantsFood && foods.length ? [pick(foods, (f) => f.weight)] : []),
          ];
          for (const product of picks) {
            const opts2 = chooseOptions(product.groupIds);
            const optionIds = opts2.map((o) => o.id).sort();
            const key = `${product.id}|${optionIds.join(",")}`;
            const existing = lines.get(key);
            if (existing) {
              existing.quantity += 1;
              continue;
            }
            const unitPrice = Math.max(0, product.price + opts2.reduce((s, o) => s + o.priceDelta, 0));
            const unitCost = Math.max(0, product.unitCost + opts2.reduce((s, o) => s + o.unitCost, 0));
            const item: DemoItem = {
              id: uuid(),
              order_id: orderId,
              product_id: product.id,
              product_name: product.name,
              category_name: product.category,
              option_ids: optionIds,
              options_label: opts2.filter((o) => !o.isDefault).map((o) => o.name).join(" · "),
              quantity: 1,
              unit_price: unitPrice,
              unit_cost: Math.round(unitCost * 10000) / 10000,
              is_comp: rand() < 0.015,
              created_at: new Date(roundAt + p * 9_000 + between(0, 20_000)).toISOString(),
            };
            lines.set(key, item);
          }
        }
        orderItems.push(...lines.values());
      }
      if (orderItems.length === 0) continue;

      for (const i of orderItems) if (!i.is_comp) subtotal += i.quantity * i.unit_price;
      items.push(...orderItems);

      const isOpen = end > nowMs && date === today;
      const cancelled = !isOpen && rand() < 0.008;
      const discount = !isOpen && !cancelled && rand() < 0.03 ? round2(Math.round(subtotal * 0.1)) : 0;
      const total = round2(subtotal - discount);

      orders.push({
        id: orderId,
        is_demo: true,
        table_id: table.id,
        table_name: table.name,
        is_takeaway: isTakeaway,
        status: isOpen ? "open" : cancelled ? "cancelled" : "paid",
        opened_at: new Date(start).toISOString(),
        closed_at: isOpen ? null : new Date(end).toISOString(),
        discount_amount: discount,
        cancel_reason: cancelled ? "Müşteri vazgeçti" : "",
        guests: !isTakeaway && rand() < 0.8 ? party : null,
      });

      if (isOpen || cancelled || total <= 0) continue;
      const paidAt = new Date(end).toISOString();
      const addPayment = (method: "cash" | "card", amount: number) => {
        const rate = method === "card" ? opts.commissionRate : 0;
        payments.push({
          id: uuid(),
          order_id: orderId,
          method,
          amount: round2(amount),
          commission_rate: rate,
          commission_amount: round2(amount * rate),
          created_at: paidAt,
        });
      };
      if (!isTakeaway && party > 1 && rand() < 0.05) {
        const part = round2(Math.floor(total / 2));
        addPayment("card", part);
        addPayment("cash", round2(total - part));
      } else {
        addPayment(rand() < 0.72 ? "card" : "cash", total);
      }
    }
  }

  // Aynı masada birden fazla açık adisyon olmasın (gel-al dahil)
  const openByTable = new Set<string>();
  for (const o of [...orders].reverse()) {
    if (o.status !== "open") continue;
    if (openByTable.has(o.table_id)) {
      o.status = "paid";
      o.closed_at = new Date(nowMs - 60_000).toISOString();
      const subtotal = items
        .filter((i) => i.order_id === o.id && !i.is_comp)
        .reduce((s, i) => s + i.quantity * i.unit_price, 0);
      if (subtotal > 0) {
        payments.push({
          id: uuid(), order_id: o.id, method: "card", amount: round2(subtotal),
          commission_rate: opts.commissionRate, commission_amount: round2(subtotal * opts.commissionRate),
          created_at: o.closed_at,
        });
      }
    } else {
      openByTable.add(o.table_id);
    }
  }

  return { orders, items, payments };
}
