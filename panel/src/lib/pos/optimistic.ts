// İyimser adisyon güncellemeleri: kullanıcı dokunduğu anda ekranda görünür,
// sunucu yanıtı gelince gerçek veriyle değiştirilir. Buradaki fiyatlar
// yalnızca gösterim içindir; kesin hesap veritabanında yapılır.

import type { MenuGroup, MenuProduct, Order, OrderItem, PosMenu } from "@/lib/api/types";

export const ROUND_GAP_MS = 5 * 60 * 1000;

export type PendingOp =
  | { kind: "add"; id: number; at: number; productId: string; optionIds: string[]; quantity: number; note: string; price?: number | null }
  | { kind: "delta"; id: number; at: number; itemId: string; delta: number }
  | { kind: "update"; id: number; at: number; itemId: string; optionIds: string[]; quantity: number; note: string; isComp: boolean }
  | { kind: "remove"; id: number; at: number; itemId: string }
  | { kind: "price"; id: number; at: number; itemId: string; unitPrice: number; unitDiscount: number }
  | { kind: "guests"; id: number; at: number; guests: number | null };

export interface MenuIndex {
  products: Map<string, MenuProduct>;
  /** inLabel: adisyon etiketinde yazılır mı (varsayılanlar yazılmaz; zorunlu gruptaki seçim her zaman yazılır) */
  options: Map<string, { name: string; price_delta: number; is_default: boolean; inLabel: boolean; groupOrder: number; optionOrder: number }>;
  groups: Map<string, MenuGroup>;
}

export function indexMenu(menu: PosMenu): MenuIndex {
  const options: MenuIndex["options"] = new Map();
  menu.groups.forEach((g, gi) =>
    g.options.forEach((o, oi) =>
      options.set(o.id, {
        name: o.name,
        price_delta: o.price_delta,
        is_default: o.is_default,
        inLabel: !o.is_default || g.is_required,
        groupOrder: gi,
        optionOrder: oi,
      }),
    ),
  );
  return {
    products: new Map(menu.products.map((p) => [p.id, p])),
    options,
    groups: new Map(menu.groups.map((g) => [g.id, g])),
  };
}

export function sortIds(ids: string[]) {
  return [...new Set(ids)].sort();
}

export function linePrice(index: MenuIndex, productId: string | null, optionIds: string[], fallback = 0) {
  const product = productId ? index.products.get(productId) : undefined;
  if (!product) return fallback;
  const delta = optionIds.reduce((sum, id) => sum + (index.options.get(id)?.price_delta ?? 0), 0);
  return Math.max(0, Math.round((product.price + delta) * 100) / 100);
}

export function optionsLabel(index: MenuIndex, optionIds: string[]) {
  return optionIds
    .map((id) => index.options.get(id))
    .filter((o): o is NonNullable<typeof o> => !!o && o.inLabel)
    .sort((a, b) => a.groupOrder - b.groupOrder || a.optionOrder - b.optionOrder)
    .map((o) => o.name)
    .join(" · ");
}

/** Ürünün varsayılan seçenekleri (tek seçimli gruplarda varsayılan olan) */
export function defaultOptionIds(index: MenuIndex, product: MenuProduct): string[] {
  const out: string[] = [];
  for (const gid of product.group_ids) {
    const g = index.groups.get(gid);
    if (!g) continue;
    for (const o of g.options) if (o.is_default) out.push(o.id);
  }
  return sortIds(out);
}

/** Ürün eklenirken seçim penceresi açılmalı mı? (zorunlu grupta varsayılan yoksa) */
export function needsChoice(index: MenuIndex, product: MenuProduct): boolean {
  return product.group_ids.some((gid) => {
    const g = index.groups.get(gid);
    return !!g && g.is_required && g.options.length > 0 && !g.options.some((o) => o.is_default);
  });
}

function recompute(order: Order): Order | null {
  const items = order.items;
  if (items.length === 0 && order.payments.length === 0) return null;
  const subtotal = round2(items.reduce((s, i) => s + (i.is_comp ? 0 : i.quantity * i.unit_price), 0));
  const comp = round2(items.reduce((s, i) => s + (i.is_comp ? i.quantity * i.unit_price : 0), 0));
  const lineDiscount = items.reduce((s, i) => s + (i.is_comp ? 0 : i.quantity * (i.unit_discount ?? 0)), 0);
  const discount = round2(Math.min((order.extra_discount ?? 0) + lineDiscount, subtotal));
  const total = round2(subtotal - discount);
  return {
    ...order,
    subtotal,
    comp_total: comp,
    total,
    discount,
    remaining: Math.max(0, round2(total - order.paid)),
    items_count: items.reduce((s, i) => s + i.quantity, 0),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function applyPending(
  base: Order | null,
  ops: PendingOp[],
  index: MenuIndex,
  table: { id: string; name: string; is_takeaway: boolean },
): Order | null {
  let order = base;
  for (const op of ops) {
    order = applyOne(order, op, index, table);
  }
  return order;
}

function applyOne(
  order: Order | null,
  op: PendingOp,
  index: MenuIndex,
  table: { id: string; name: string; is_takeaway: boolean },
): Order | null {
  if (op.kind === "add") {
    const product = index.products.get(op.productId);
    if (!product) return order;
    const current: Order = order ?? {
      id: `tmp-order`,
      status: "open",
      table_id: table.id,
      table_name: table.name,
      is_takeaway: table.is_takeaway,
      opened_at: new Date(op.at).toISOString(),
      closed_at: null,
      note: "",
      cancel_reason: "",
      guests: null,
      extra_discount: 0,
      discount: 0,
      subtotal: 0,
      comp_total: 0,
      total: 0,
      paid: 0,
      remaining: 0,
      items_count: 0,
      items: [],
      payments: [],
    };
    const optionIds = sortIds(op.optionIds);
    const price = product.is_open_price ? round2(op.price ?? 0) : linePrice(index, product.id, optionIds);
    const match = [...current.items]
      .reverse()
      .find(
        (i) =>
          i.product_id === product.id &&
          !i.is_comp &&
          !i.unit_discount &&
          (i.split_parts ?? 1) === 1 &&
          i.note === op.note &&
          i.unit_price === price &&
          sameIds(i.option_ids, optionIds) &&
          op.at - Date.parse(i.created_at) < ROUND_GAP_MS,
      );
    const items: OrderItem[] = match
      ? current.items.map((i) => (i === match ? { ...i, quantity: i.quantity + op.quantity } : i))
      : [
          ...current.items,
          {
            id: `tmp-${op.id}`,
            product_id: product.id,
            name: product.name,
            options_label: optionsLabel(index, optionIds),
            option_ids: optionIds,
            quantity: op.quantity,
            unit_price: price,
            list_price: price,
            unit_discount: 0,
            paid_quantity: 0,
            split_parts: 1,
            paid_parts: 0,
            is_comp: false,
            note: op.note,
            created_at: new Date(op.at).toISOString(),
          },
        ];
    return recompute({ ...current, items });
  }

  if (!order) return order;

  if (op.kind === "guests") {
    return { ...order, guests: op.guests };
  }

  if (op.kind === "price") {
    return recompute({
      ...order,
      items: order.items.map((i) =>
        i.id === op.itemId ? { ...i, unit_price: op.unitPrice, unit_discount: Math.min(op.unitDiscount, op.unitPrice) } : i,
      ),
    });
  }

  if (op.kind === "remove") {
    return recompute({ ...order, items: order.items.filter((i) => i.id !== op.itemId) });
  }

  if (op.kind === "delta") {
    const item = order.items.find((i) => i.id === op.itemId);
    if (!item) return order;
    if (op.delta < 0) {
      const quantity = item.quantity + op.delta;
      const items = quantity <= 0 ? order.items.filter((i) => i !== item) : order.items.map((i) => (i === item ? { ...i, quantity } : i));
      return recompute({ ...order, items });
    }
    if (op.at - Date.parse(item.created_at) < ROUND_GAP_MS) {
      return recompute({ ...order, items: order.items.map((i) => (i === item ? { ...i, quantity: i.quantity + op.delta } : i)) });
    }
    const recent = order.items.find(
      (i) =>
        i !== item &&
        i.product_id === item.product_id &&
        i.name === item.name &&
        sameIds(i.option_ids, item.option_ids) &&
        i.note === item.note &&
        i.is_comp === item.is_comp &&
        op.at - Date.parse(i.created_at) < ROUND_GAP_MS,
    );
    if (recent) {
      return recompute({ ...order, items: order.items.map((i) => (i === recent ? { ...i, quantity: i.quantity + op.delta } : i)) });
    }
    return recompute({
      ...order,
      items: [...order.items, { ...item, id: `tmp-${op.id}`, quantity: op.delta, paid_quantity: 0, paid_parts: 0, created_at: new Date(op.at).toISOString() }],
    });
  }

  // update
  const item = order.items.find((i) => i.id === op.itemId);
  if (!item) return order;
  const optionIds = sortIds(op.optionIds);
  const optionsChanged = !sameIds(optionIds, item.option_ids);
  const updated: OrderItem = {
    ...item,
    quantity: op.quantity,
    note: op.note,
    is_comp: op.isComp,
    ...(optionsChanged && item.product_id
      ? {
          option_ids: optionIds,
          options_label: optionsLabel(index, optionIds),
          unit_price: linePrice(index, item.product_id, optionIds, item.unit_price),
          list_price: linePrice(index, item.product_id, optionIds, item.unit_price),
        }
      : {}),
  };
  return recompute({ ...order, items: order.items.map((i) => (i === item ? updated : i)) });
}

function sameIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sa = sortIds(a);
  const sb = sortIds(b);
  return sa.every((v, i) => v === sb[i]);
}

/** Satırları sipariş turlarına ayırır (aralarında ROUND_GAP_MS'ten uzun süre olanlar yeni tur) */
export function groupRounds(items: OrderItem[]): { at: string; items: OrderItem[] }[] {
  const sorted = [...items].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const rounds: { at: string; items: OrderItem[] }[] = [];
  let lastAt = -Infinity;
  for (const item of sorted) {
    const t = Date.parse(item.created_at);
    if (rounds.length === 0 || t - lastAt > ROUND_GAP_MS) rounds.push({ at: item.created_at, items: [] });
    rounds[rounds.length - 1].items.push(item);
    lastAt = t;
  }
  return rounds;
}
