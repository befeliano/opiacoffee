import "server-only";
import { randomUUID } from "node:crypto";
import { serviceRpc } from "@/lib/data/server";
import { generateDemoOrders } from "./demo";
import { demoExpenses } from "./expenses";
import { CAFES, DEFAULT_CAFE, type SeedIds } from "./menus";

/**
 * Test verisini bugüne göre yeniden üretir: son `days` gün + bugün şu ana
 * kadarki satışlar ve şu an dolu masalar. Var olan test verisi önceden
 * silinmiş olmalıdır (demo_purge). Gerçek satışlara dokunmaz.
 * Çağıran, kullanıcının kafe sahibi olduğunu doğrulamış olmalıdır.
 */
export async function generateDemoData(
  cafe: { id: string; slug: string; timezone: string; card_commission_rate: number; open_hour: number; close_hour: number },
  opts: { busyTableIds?: string[]; days?: number } = {},
) {
  const base = CAFES.find((c) => c.slug === cafe.slug) ?? DEFAULT_CAFE;
  const def = { ...base, openHour: cafe.open_hour, closeHour: cafe.close_hour };

  // Veritabanındaki gerçek kimlik ve maliyetler + tohum verisindeki satış ağırlıkları
  const ids = await serviceRpc<SeedIds>("admin_cafe_seed_ids", { p_cafe: cafe.id });
  const weights = new Map(def.categories.flatMap((c) => c.products.map((p) => [p.name, p.demoWeight ?? 1] as const)));
  const shares = new Map(def.groups.flatMap((g) => g.options.map((o) => [o.name, o.demoShare ?? 0] as const)));
  const busy = new Set(opts.busyTableIds ?? []);
  const withWeights: SeedIds = {
    ...ids,
    // Şu an gerçekten dolu olan masalara açık test adisyonu açılmasın
    tables: ids.tables.filter((t) => !busy.has(t.id)),
    products: ids.products.map((p) => ({ ...p, weight: weights.get(p.name) ?? 1 })),
    groups: ids.groups.map((g) => ({
      ...g,
      options: g.options.map((o) => ({ ...o, share: shares.get(o.name) ?? (o.isDefault ? 1 : 0.1) })),
    })),
  };

  const demo = generateDemoOrders(def, withWeights, {
    days: opts.days ?? 60,
    now: new Date(),
    tz: cafe.timezone,
    seed: Math.floor(Math.random() * 2 ** 31),
    commissionRate: cafe.card_commission_rate,
    uuid: randomUUID,
  });

  const chunk = 250;
  for (let i = 0; i < demo.orders.length; i += chunk) {
    const orders = demo.orders.slice(i, i + chunk);
    const orderIds = new Set(orders.map((o) => o.id));
    await serviceRpc("admin_import_orders", {
      p_cafe: cafe.id,
      p_payload: {
        orders,
        items: demo.items.filter((it) => orderIds.has(it.order_id)),
        payments: demo.payments.filter((p) => orderIds.has(p.order_id)),
      },
    });
  }
  const expenses = demoExpenses();
  await serviceRpc("admin_import_expenses", { p_cafe: cafe.id, p_payload: { expenses } });
  return { orders: demo.orders.length, expenses: expenses.length };
}
