// Adisyon ekranı (pos_*) fonksiyonları.

import type { Ctx, Row } from "./db";
import {
  ROUND_GAP_MS,
  addDays,
  bit,
  bizDate,
  bizRange,
  cafeTimezone,
  can,
  cents,
  cleanText,
  divRound,
  fail,
  figuresScope,
  fromCents,
  groupBy,
  idsJson,
  int,
  iso,
  itemPaidQty,
  left,
  newId,
  normalizeUuids,
  num,
  orderJson,
  orderTotals,
  ordersJson,
  parseJson,
  paymentMethod,
  requireOpenDay,
  requirePerm,
  requireRole,
  resolveLine,
  round,
  roleRank,
  syncDiscount,
  totalsOf,
  totalsSql,
  touchOrder,
  uuid,
  uuidList,
  validDate,
  insertPayment,
  type Line,
} from "./helpers";

const SIXTY_MIN = 60 * 60 * 1000;

/** private.day_totals: iş gününün kapanmış (ödenmiş) satış özeti */
export async function dayTotals(ctx: Ctx, cafe: string, date: string, tz: string) {
  const [from, to] = bizRange(date, tz);
  const row = await ctx.one(
    `SELECT COUNT(*) AS orders,
       COALESCE(ROUND(SUM(x.total), 2), 0) AS revenue,
       COALESCE(ROUND(SUM(x.cost), 2), 0) AS cost,
       COALESCE(ROUND(SUM(x.commission), 2), 0) AS commission,
       COALESCE(SUM(x.items), 0) AS items
     FROM (${totalsSql(
       "o.cafe_id = ? AND o.status = 'paid' AND o.closed_at >= ? AND o.closed_at < ?",
       ", (SELECT COALESCE(SUM(p.commission_amount), 0) FROM payments p WHERE p.order_id = o.id) AS commission",
     )}) x`,
    [cafe, from, to],
  );
  return {
    orders: Number(row?.orders ?? 0),
    revenue: Number(row?.revenue ?? 0),
    cost: Number(row?.cost ?? 0),
    commission: Number(row?.commission ?? 0),
    items: Number(row?.items ?? 0),
  };
}

export async function pos_floor(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "staff");
  const tz = await cafeTimezone(ctx, cafe);
  const today = bizDate(ctx.now, tz);
  const day = await ctx.one("SELECT id, business_date, opened_at FROM cafe_days WHERE cafe_id = ? AND closed_at IS NULL LIMIT 1", [cafe]);
  const totals = await dayTotals(ctx, cafe, today, tz);

  const areas = await ctx.all("SELECT id, name FROM areas WHERE cafe_id = ? ORDER BY sort_order, name", [cafe]);
  const tables = await ctx.all(
    `SELECT t.id, t.name, t.area_id, t.is_takeaway, o.id AS order_id, o.opened_at
     FROM dining_tables t
     LEFT JOIN orders o ON o.table_id = t.id AND o.status = 'open'
     WHERE t.cafe_id = ? AND t.is_active = 1
     ORDER BY t.sort_order, t.name`,
    [cafe],
  );
  const open = new Map(
    (await ctx.all(totalsSql("o.cafe_id = ? AND o.status = 'open'"), [cafe])).map((r) => [r.id, totalsOf(r)]),
  );
  const scope = await figuresScope(ctx, cafe);
  const profit = await can(ctx, cafe, "profit");

  return {
    now: iso(ctx.now),
    business_date: today,
    day: day ? { id: day.id, business_date: day.business_date, opened_at: iso(day.opened_at) } : null,
    areas: areas.map((r) => ({ id: r.id, name: r.name })),
    tables: tables.map((t) => {
      const ot = t.order_id ? open.get(t.order_id) : null;
      return {
        id: t.id,
        name: t.name,
        area_id: t.area_id,
        is_takeaway: bit(t.is_takeaway),
        order: t.order_id
          ? { id: t.order_id, opened_at: iso(t.opened_at), total: ot?.total ?? 0, paid: ot?.paid ?? 0, items: ot?.items ?? 0 }
          : null,
      };
    }),
    today:
      scope === "none"
        ? null
        : {
            date: today,
            orders: totals.orders,
            items: totals.items,
            revenue: totals.revenue,
            cost: profit ? totals.cost : null,
            commission: totals.commission,
            profit: profit ? fromCents(cents(totals.revenue) - cents(totals.cost) - cents(totals.commission)) : null,
          },
  };
}

export async function pos_menu(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "staff");
  const categories = await ctx.all("SELECT id, name, subtitle FROM categories WHERE cafe_id = ? ORDER BY sort_order, name", [cafe]);
  const products = await ctx.all(
    "SELECT * FROM products WHERE cafe_id = ? AND is_active = 1 ORDER BY sort_order, name",
    [cafe],
  );
  const links = groupBy(
    await ctx.all("SELECT product_id, group_id FROM product_option_groups WHERE cafe_id = ? ORDER BY sort_order", [cafe]),
    "product_id",
  );
  const groups = await ctx.all("SELECT * FROM option_groups WHERE cafe_id = ? ORDER BY sort_order, name", [cafe]);
  const options = groupBy(
    await ctx.all("SELECT * FROM options WHERE cafe_id = ? AND is_active = 1 ORDER BY sort_order, name", [cafe]),
    "group_id",
  );
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name, subtitle: c.subtitle })),
    products: products.map((p) => ({
      id: p.id,
      category_id: p.category_id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      is_open_price: bit(p.is_open_price),
      favorite_rank: p.favorite_rank,
      tags: parseJson<string[]>(p.tags, []),
      group_ids: bit(p.is_open_price) ? [] : (links.get(p.id) ?? []).map((l) => l.group_id),
    })),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      selection: g.selection,
      is_required: bit(g.is_required),
      options: (options.get(g.id) ?? []).map((o) => ({
        id: o.id,
        name: o.name,
        price_delta: Number(o.price_delta),
        is_default: bit(o.is_default),
      })),
    })),
  };
}

export async function tableOrder(ctx: Ctx, cafe: string, table: string | null) {
  const t = table
    ? await ctx.one(
        `SELECT t.*, (SELECT a.name FROM areas a WHERE a.id = t.area_id) AS area_name
         FROM dining_tables t WHERE t.id = ? AND t.cafe_id = ?`,
        [table, cafe],
      )
    : null;
  if (!t) fail("E_TABLE_NOT_FOUND");
  const order = await ctx.val<string>("SELECT id FROM orders WHERE table_id = ? AND status = 'open'", [table]);
  return {
    now: iso(ctx.now),
    table: {
      id: t.id,
      name: t.name,
      is_takeaway: bit(t.is_takeaway),
      is_active: bit(t.is_active),
      area_name: t.area_name ?? null,
    },
    order: order ? await orderJson(ctx, order) : null,
  };
}

export async function pos_table_order(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "staff");
  return tableOrder(ctx, cafe, uuid(a.p_table));
}

async function lockOrder(ctx: Ctx, id: string) {
  return ctx.one("SELECT * FROM orders WHERE id = ? FOR UPDATE", [id]);
}

async function findItem(ctx: Ctx, cafe: string, item: string) {
  const row = await ctx.one("SELECT * FROM order_items WHERE id = ? AND cafe_id = ?", [item, cafe]);
  if (!row) fail("E_ITEM_NOT_FOUND");
  return row;
}

async function insertItem(ctx: Ctx, v: Row) {
  await ctx.run(
    `INSERT INTO order_items (id, cafe_id, order_id, product_id, product_name, category_name, option_ids, options_label,
       quantity, unit_price, list_price, unit_discount, split_parts, unit_cost, is_comp, note, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(), v.cafe_id, v.order_id, v.product_id, v.product_name, v.category_name, v.option_ids, v.options_label,
      v.quantity, v.unit_price, v.list_price, v.unit_discount ?? 0, v.split_parts ?? 1, v.unit_cost, v.is_comp ? 1 : 0,
      v.note, ctx.now, ctx.uid,
    ],
  );
}

export async function pos_add_item(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const tableId = uuid(a.p_table);
  const productId = uuid(a.p_product);
  const optionIds = uuidList(a.p_option_ids);
  const quantity = a.p_quantity === undefined ? 1 : int(a.p_quantity);
  const price = num(a.p_price);
  const note = cleanText(a.p_note ?? "", 120);

  await requireRole(ctx, cafe, "staff");
  await requireOpenDay(ctx, cafe);
  if (quantity === null || quantity < 1 || quantity > 99) fail("E_INVALID_QUANTITY");

  // Masa satırını kilitle: aynı masaya eşzamanlı eklemeler sıraya girer
  const table = await ctx.one("SELECT * FROM dining_tables WHERE id = ? AND cafe_id = ? FOR UPDATE", [tableId, cafe]);
  if (!table) fail("E_TABLE_NOT_FOUND");
  if (!bit(table.is_active)) fail("E_TABLE_INACTIVE");

  const product = await ctx.one(
    `SELECT p.*, COALESCE((SELECT c.name FROM categories c WHERE c.id = p.category_id), '') AS category_name
     FROM products p WHERE p.id = ? AND p.cafe_id = ? AND p.is_active = 1`,
    [productId, cafe],
  );
  if (!product) fail("E_PRODUCT_NOT_FOUND");

  let line: Line;
  if (bit(product.is_open_price)) {
    // Joker: fiyat satışta girilir, maliyet 0
    if (price === null || price <= 0 || price >= 100000) fail("E_INVALID_PRICE");
    line = {
      product_id: product.id,
      product_name: product.name,
      category_name: product.category_name,
      option_ids: [],
      options_label: "",
      unit_price: round(price, 2),
      unit_cost: 0,
    };
  } else {
    line = await resolveLine(ctx, cafe, productId, optionIds);
  }

  let order = await ctx.val<string>("SELECT id FROM orders WHERE table_id = ? AND status = 'open'", [tableId]);
  if (!order) {
    order = newId();
    await ctx.run(
      `INSERT INTO orders (id, cafe_id, table_id, table_name, is_takeaway, opened_by, opened_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [order, cafe, tableId, table.name, table.is_takeaway, ctx.uid, ctx.now, ctx.now],
    );
  }

  // Aynı turda eklenmiş özdeş satır varsa adedini artır
  const same = await ctx.val<string>(
    `SELECT id FROM order_items
     WHERE order_id = ? AND product_id = ? AND option_ids = ? AND note = ? AND is_comp = 0
       AND unit_price = ? AND unit_discount = 0 AND split_parts = 1 AND created_at > ?
     ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
    [order, line.product_id, idsJson(line.option_ids), note, line.unit_price, new Date(ctx.now.getTime() - ROUND_GAP_MS)],
  );
  if (same) {
    await ctx.run("UPDATE order_items SET quantity = LEAST(quantity + ?, 999) WHERE id = ?", [quantity, same]);
  } else {
    await insertItem(ctx, {
      cafe_id: cafe,
      order_id: order,
      product_id: line.product_id,
      product_name: line.product_name,
      category_name: line.category_name,
      option_ids: idsJson(line.option_ids),
      options_label: line.options_label,
      quantity,
      unit_price: line.unit_price,
      list_price: line.unit_price,
      unit_cost: line.unit_cost,
      note,
    });
  }

  await touchOrder(ctx, order);
  return tableOrder(ctx, cafe, tableId);
}

export async function pos_update_item(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const itemId = uuid(a.p_item);
  const ids = normalizeUuids(uuidList(a.p_option_ids));
  const quantity = int(a.p_quantity);
  const isComp = a.p_is_comp === true || a.p_is_comp === "true";
  await requireRole(ctx, cafe, "staff");
  if (quantity === null || quantity < 1 || quantity > 999) fail("E_INVALID_QUANTITY");

  const item = await findItem(ctx, cafe, itemId);
  const order = await lockOrder(ctx, item.order_id);
  if (!order || order.status !== "open") fail("E_ORDER_CLOSED");

  const optionsChanged = idsJson(ids) !== item.option_ids;
  const paid = await itemPaidQty(ctx, item.id);
  if (paid > 0 && (quantity * item.split_parts < paid || optionsChanged || isComp !== bit(item.is_comp))) fail("E_ITEM_PAID");

  if (optionsChanged) {
    if (!item.product_id) fail("E_PRODUCT_NOT_FOUND");
    const line = await resolveLine(ctx, cafe, item.product_id, ids);
    await ctx.run(
      `UPDATE order_items SET option_ids = ?, options_label = ?, unit_price = ?, list_price = ?,
         unit_discount = LEAST(unit_discount, ?), unit_cost = ? WHERE id = ?`,
      [idsJson(line.option_ids), line.options_label, line.unit_price, line.unit_price, line.unit_price, line.unit_cost, item.id],
    );
  }

  // İkram yetki ister (ikramı geri almak serbest)
  if (isComp && !bit(item.is_comp)) await requirePerm(ctx, cafe, "discounts");

  await ctx.run("UPDATE order_items SET quantity = ?, note = ?, is_comp = ? WHERE id = ?", [
    quantity,
    cleanText(a.p_note, 120),
    isComp ? 1 : 0,
    item.id,
  ]);
  await touchOrder(ctx, order.id);
  return tableOrder(ctx, cafe, order.table_id);
}

export async function pos_remove_item(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const itemId = uuid(a.p_item);
  await requireRole(ctx, cafe, "staff");
  const item = await findItem(ctx, cafe, itemId);
  const order = await lockOrder(ctx, item.order_id);
  if (!order || order.status !== "open") fail("E_ORDER_CLOSED");
  if ((await itemPaidQty(ctx, item.id)) > 0) fail("E_ITEM_PAID");
  await ctx.run("DELETE FROM order_items WHERE id = ?", [item.id]);
  await touchOrder(ctx, order.id);
  return tableOrder(ctx, cafe, order.table_id);
}

export async function pos_change_quantity(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const itemId = uuid(a.p_item);
  const delta = int(a.p_delta);
  await requireRole(ctx, cafe, "staff");
  if (delta === null || delta === 0 || Math.abs(delta) > 99) fail("E_INVALID_QUANTITY");

  const found = await findItem(ctx, cafe, itemId);
  const order = await lockOrder(ctx, found.order_id);
  if (!order || order.status !== "open") fail("E_ORDER_CLOSED");
  const item = await ctx.one("SELECT * FROM order_items WHERE id = ? FOR UPDATE", [itemId]);
  if (!item) fail("E_ITEM_NOT_FOUND");

  const since = new Date(ctx.now.getTime() - ROUND_GAP_MS);
  if (delta < 0) {
    if ((item.quantity + delta) * item.split_parts < (await itemPaidQty(ctx, item.id))) fail("E_ITEM_PAID");
    if (item.quantity + delta <= 0) await ctx.run("DELETE FROM order_items WHERE id = ?", [item.id]);
    else await ctx.run("UPDATE order_items SET quantity = quantity + ? WHERE id = ?", [delta, item.id]);
  } else if (new Date(item.created_at) > since) {
    await ctx.run("UPDATE order_items SET quantity = LEAST(quantity + ?, 999) WHERE id = ?", [delta, item.id]);
  } else {
    // Aynı ürünün bu turdaki kopyası zaten açıldıysa ona ekle
    const recent = await ctx.val<string>(
      `SELECT id FROM order_items
       WHERE order_id = ? AND id <> ? AND product_id <=> ? AND product_name = ? AND option_ids = ? AND note = ?
         AND is_comp = ? AND unit_price = ? AND unit_discount = ? AND split_parts = ? AND created_at > ?
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [
        item.order_id, item.id, item.product_id, item.product_name, item.option_ids, item.note,
        item.is_comp, item.unit_price, item.unit_discount, item.split_parts, since,
      ],
    );
    if (recent) {
      await ctx.run("UPDATE order_items SET quantity = LEAST(quantity + ?, 999) WHERE id = ?", [delta, recent]);
    } else {
      await insertItem(ctx, { ...item, quantity: delta, is_comp: bit(item.is_comp) });
    }
  }

  await touchOrder(ctx, order.id);
  return tableOrder(ctx, cafe, order.table_id);
}

async function closeOrPay(ctx: Ctx, orderId: string, remainingCents: number, amountCents: number) {
  if (remainingCents - amountCents <= 0) {
    await ctx.run("UPDATE orders SET status = 'paid', closed_at = ?, closed_by = ?, updated_at = ? WHERE id = ?", [
      ctx.now,
      ctx.uid,
      ctx.now,
      orderId,
    ]);
    return { closed: true, order: await orderJson(ctx, orderId) };
  }
  await ctx.run("UPDATE orders SET updated_at = ? WHERE id = ?", [ctx.now, orderId]);
  return { closed: false, order: await orderJson(ctx, orderId) };
}

async function lockOpenOrder(ctx: Ctx, cafe: string, orderId: string) {
  const order = await ctx.one("SELECT * FROM orders WHERE id = ? AND cafe_id = ? FOR UPDATE", [orderId, cafe]);
  if (!order) fail("E_ORDER_NOT_FOUND");
  if (order.status !== "open") fail("E_ORDER_CLOSED");
  return order;
}

export async function pos_pay(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const orderId = uuid(a.p_order);
  const method = paymentMethod(a.p_method);
  const requested = num(a.p_amount);
  await requireRole(ctx, cafe, "staff");
  const order = await lockOpenOrder(ctx, cafe, orderId);

  const tot = await orderTotals(ctx, order.id);
  if (tot.items === 0) fail("E_ORDER_EMPTY");
  const remaining = cents(tot.remaining);
  const amount = requested === null ? remaining : cents(round(requested, 2));
  if (amount < 0 || (amount === 0 && remaining > 0)) fail("E_INVALID_AMOUNT");
  if (amount > remaining) fail("E_AMOUNT_EXCEEDS");

  if (amount > 0) {
    await insertPayment(ctx, { cafe, order: order.id, method, amount: fromCents(amount), createdBy: ctx.uid });
  }
  return closeOrPay(ctx, order.id, remaining, amount);
}

export async function pos_pay_items(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const orderId = uuid(a.p_order);
  const method = paymentMethod(a.p_method);
  await requireRole(ctx, cafe, "staff");

  let lines = a.p_lines;
  if (typeof lines === "string") {
    try {
      lines = JSON.parse(lines);
    } catch {
      fail("E_INVALID_INPUT");
    }
  }
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 200) fail("E_INVALID_INPUT");
  const grouped = new Map<string, number | null>();
  for (const x of lines as Row[]) {
    const id = uuid(x?.item_id);
    const q = x?.quantity === null || x?.quantity === undefined ? null : int(x.quantity);
    const prev = grouped.has(id) ? grouped.get(id)! : null;
    grouped.set(id, q === null ? prev : (prev ?? 0) + q);
  }

  const order = await lockOpenOrder(ctx, cafe, orderId);
  const ids = [...grouped.keys()];
  const found = new Map(
    (
      await ctx.all(
        `SELECT i.*,
           (SELECT COALESCE(SUM(pi.quantity), 0) FROM payment_items pi WHERE pi.item_id = i.id) AS paid_qty,
           (SELECT COALESCE(SUM(pi.amount), 0) FROM payment_items pi WHERE pi.item_id = i.id) AS paid_amount
         FROM order_items i WHERE i.order_id = ? AND i.id IN (${ids.map(() => "?").join(",")})`,
        [order.id, ...ids],
      )
    ).map((r) => [r.id, r]),
  );

  const parts: { id: string; qty: number; amount: number }[] = [];
  let total = 0;
  for (const [id, qty] of grouped) {
    const r = found.get(id);
    if (!r) fail("E_ITEM_NOT_FOUND");
    const open = r.quantity * r.split_parts - Number(r.paid_qty);
    if (bit(r.is_comp) || qty === null || qty < 1 || qty > open) fail("E_INVALID_QUANTITY");
    const net = cents(Number(r.unit_price)) - cents(Number(r.unit_discount));
    const line = qty === open ? Math.max(r.quantity * net - cents(Number(r.paid_amount)), 0) : divRound(qty * net, r.split_parts);
    parts.push({ id, qty, amount: line });
    total += line;
  }

  const tot = await orderTotals(ctx, order.id);
  // Adisyon indirimi ya da tutarla alınmış ödeme varsa kalanı aşma
  const remaining = cents(tot.remaining);
  const amount = Math.min(total, remaining);
  if (amount <= 0 && remaining > 0) fail("E_INVALID_AMOUNT");

  if (amount > 0) {
    const payment = await insertPayment(ctx, { cafe, order: order.id, method, amount: fromCents(amount), createdBy: ctx.uid });
    for (const p of parts) {
      await ctx.run("INSERT INTO payment_items (payment_id, item_id, cafe_id, quantity, amount) VALUES (?, ?, ?, ?, ?)", [
        payment,
        p.id,
        cafe,
        p.qty,
        fromCents(p.amount),
      ]);
    }
  }
  return closeOrPay(ctx, order.id, remaining, amount);
}

export async function pos_delete_payment(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const paymentId = uuid(a.p_payment);
  await requirePerm(ctx, cafe, "payments");
  const payment = await ctx.one("SELECT * FROM payments WHERE id = ? AND cafe_id = ?", [paymentId, cafe]);
  if (!payment) fail("E_PAYMENT_NOT_FOUND");
  const order = await lockOrder(ctx, payment.order_id);
  if (!order || order.status !== "open") fail("E_ORDER_CLOSED");
  await ctx.run("DELETE FROM payments WHERE id = ?", [payment.id]);
  await touchOrder(ctx, order.id);
  return tableOrder(ctx, cafe, order.table_id);
}

export async function pos_change_payment_method(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const paymentId = uuid(a.p_payment);
  const method = paymentMethod(a.p_method);
  const role = await requireRole(ctx, cafe, "staff");
  await requirePerm(ctx, cafe, "payments");

  const payment = await ctx.one("SELECT * FROM payments WHERE id = ? AND cafe_id = ? FOR UPDATE", [paymentId, cafe]);
  if (!payment) fail("E_PAYMENT_NOT_FOUND");
  if (roleRank(role) < roleRank("manager") && new Date(payment.created_at).getTime() < ctx.now.getTime() - SIXTY_MIN) {
    fail("E_FORBIDDEN");
  }

  await ctx.run(
    `UPDATE payments p JOIN cafes c ON c.id = p.cafe_id
     SET p.method = ?,
         p.commission_rate = CASE ? WHEN 'card' THEN c.card_commission_rate WHEN 'ticket' THEN c.ticket_commission_rate ELSE 0 END,
         p.commission_amount = ROUND(p.amount * (CASE ? WHEN 'card' THEN c.card_commission_rate WHEN 'ticket' THEN c.ticket_commission_rate ELSE 0 END), 2)
     WHERE p.id = ?`,
    [method, method, method, payment.id],
  );
  await ctx.run("UPDATE orders SET updated_at = ? WHERE id = ?", [ctx.now, payment.order_id]);
  return orderJson(ctx, payment.order_id);
}

export async function pos_cancel_order(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const orderId = uuid(a.p_order);
  await requirePerm(ctx, cafe, "void");
  const order = await lockOpenOrder(ctx, cafe, orderId);
  if (await ctx.val("SELECT 1 FROM payments WHERE order_id = ? LIMIT 1", [order.id])) fail("E_ORDER_HAS_PAYMENTS");

  if (!(await ctx.val("SELECT 1 FROM order_items WHERE order_id = ? LIMIT 1", [order.id]))) {
    await ctx.run("DELETE FROM orders WHERE id = ?", [order.id]);
  } else {
    await ctx.run(
      "UPDATE orders SET status = 'cancelled', closed_at = ?, closed_by = ?, cancel_reason = ?, updated_at = ? WHERE id = ?",
      [ctx.now, ctx.uid, cleanText(a.p_reason, 200), ctx.now, order.id],
    );
  }
  return { ok: true, table_id: order.table_id };
}

export async function pos_void_order(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const orderId = uuid(a.p_order);
  const role = await requireRole(ctx, cafe, "staff");
  await requirePerm(ctx, cafe, "void");
  const tz = await cafeTimezone(ctx, cafe);

  const order = await ctx.one("SELECT * FROM orders WHERE id = ? AND cafe_id = ? FOR UPDATE", [orderId, cafe]);
  if (!order) fail("E_ORDER_NOT_FOUND");
  if (order.status === "cancelled") fail("E_ORDER_CANCELLED");
  // Personel yalnızca bugünün (iş günü) kapanmış adisyonlarını iptal edebilir
  if (
    order.status === "paid" &&
    roleRank(role) < roleRank("manager") &&
    bizDate(new Date(order.closed_at), tz) !== bizDate(ctx.now, tz)
  ) {
    fail("E_FORBIDDEN");
  }

  await ctx.run("DELETE FROM payments WHERE order_id = ?", [order.id]);
  if (!(await ctx.val("SELECT 1 FROM order_items WHERE order_id = ? LIMIT 1", [order.id]))) {
    await ctx.run("DELETE FROM orders WHERE id = ?", [order.id]);
  } else {
    await ctx.run(
      `UPDATE orders SET status = 'cancelled', closed_at = COALESCE(closed_at, ?), closed_by = ?, cancel_reason = ?, updated_at = ?
       WHERE id = ?`,
      [ctx.now, ctx.uid, cleanText(a.p_reason, 200), ctx.now, order.id],
    );
  }
  return { ok: true, table_id: order.table_id };
}

export async function pos_reopen_order(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const orderId = uuid(a.p_order);
  const role = await requireRole(ctx, cafe, "staff");
  await requirePerm(ctx, cafe, "payments");

  let order = await ctx.one("SELECT * FROM orders WHERE id = ? AND cafe_id = ?", [orderId, cafe]);
  if (!order) fail("E_ORDER_NOT_FOUND");
  if (!order.table_id) fail("E_TABLE_NOT_FOUND");
  if (
    roleRank(role) < roleRank("manager") &&
    (!order.closed_at || new Date(order.closed_at).getTime() < ctx.now.getTime() - SIXTY_MIN)
  ) {
    fail("E_FORBIDDEN");
  }

  await ctx.one("SELECT 1 FROM dining_tables WHERE id = ? FOR UPDATE", [order.table_id]);
  order = await lockOrder(ctx, orderId);
  if (!order) fail("E_ORDER_NOT_FOUND");
  if (order.status === "open") fail("E_ORDER_OPEN");
  if (await ctx.val("SELECT 1 FROM orders WHERE table_id = ? AND status = 'open' LIMIT 1", [order.table_id])) {
    fail("E_TABLE_OCCUPIED");
  }

  await ctx.run("DELETE FROM payments WHERE order_id = ?", [order.id]);
  await ctx.run(
    "UPDATE orders SET status = 'open', closed_at = NULL, closed_by = NULL, cancel_reason = '', updated_at = ? WHERE id = ?",
    [ctx.now, order.id],
  );
  return tableOrder(ctx, cafe, order.table_id);
}

export async function pos_move_order(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const orderId = uuid(a.p_order);
  const targetId = uuid(a.p_target_table);
  await requireRole(ctx, cafe, "staff");

  let order = await ctx.one("SELECT * FROM orders WHERE id = ? AND cafe_id = ?", [orderId, cafe]);
  if (!order) fail("E_ORDER_NOT_FOUND");

  // Kilitlenme olmaması için iki masayı her zaman aynı sırayla kilitle
  await ctx.all("SELECT 1 FROM dining_tables WHERE cafe_id = ? AND id IN (?, ?) ORDER BY id FOR UPDATE", [
    cafe,
    order.table_id,
    targetId,
  ]);
  order = await lockOrder(ctx, orderId);
  if (!order || order.status !== "open") fail("E_ORDER_CLOSED");
  if (order.table_id === targetId) fail("E_SAME_TABLE");

  const target = await ctx.one("SELECT * FROM dining_tables WHERE id = ? AND cafe_id = ? AND is_active = 1", [targetId, cafe]);
  if (!target) fail("E_TABLE_NOT_FOUND");
  const targetOrder = await ctx.one("SELECT * FROM orders WHERE table_id = ? AND status = 'open' FOR UPDATE", [targetId]);

  if (!targetOrder) {
    await ctx.run("UPDATE orders SET table_id = ?, table_name = ?, is_takeaway = ?, updated_at = ? WHERE id = ?", [
      target.id,
      target.name,
      target.is_takeaway,
      ctx.now,
      order.id,
    ]);
  } else {
    await ctx.run("UPDATE order_items SET order_id = ? WHERE order_id = ?", [targetOrder.id, order.id]);
    await ctx.run("UPDATE payments SET order_id = ? WHERE order_id = ?", [targetOrder.id, order.id]);
    const guests =
      targetOrder.guests === null && order.guests === null ? null : (targetOrder.guests ?? 0) + (order.guests ?? 0);
    const note = left([targetOrder.note, order.note].filter((x) => x).join(" · "), 200);
    await ctx.run(
      `UPDATE orders SET opened_at = LEAST(opened_at, ?), extra_discount = extra_discount + ?, guests = ?, note = ?, updated_at = ?
       WHERE id = ?`,
      [order.opened_at, order.extra_discount, guests, note, ctx.now, targetOrder.id],
    );
    await syncDiscount(ctx, targetOrder.id);
    await ctx.run("DELETE FROM orders WHERE id = ?", [order.id]);
  }
  return tableOrder(ctx, cafe, target.id);
}

export async function pos_split_item(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const itemId = uuid(a.p_item);
  const parts = int(a.p_parts);
  await requireRole(ctx, cafe, "staff");
  if (parts === null || parts < 1 || parts > 20) fail("E_INVALID_QUANTITY");
  const item = await findItem(ctx, cafe, itemId);
  const order = await lockOrder(ctx, item.order_id);
  if (!order || order.status !== "open") fail("E_ORDER_CLOSED");
  if ((await itemPaidQty(ctx, item.id)) > 0) fail("E_ITEM_PAID");
  await ctx.run("UPDATE order_items SET split_parts = ? WHERE id = ?", [parts, item.id]);
  await touchOrder(ctx, order.id);
  return tableOrder(ctx, cafe, order.table_id);
}

export async function pos_price_item(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const itemId = uuid(a.p_item);
  const rawPrice = num(a.p_unit_price);
  const price = rawPrice === null ? null : round(rawPrice, 2);
  const discount = round(num(a.p_unit_discount) ?? 0, 2);
  await requireRole(ctx, cafe, "staff");
  if (price === null || price < 0 || price >= 100000) fail("E_INVALID_PRICE");
  if (discount < 0 || discount > price) fail("E_INVALID_DISCOUNT");

  const item = await findItem(ctx, cafe, itemId);
  const order = await lockOrder(ctx, item.order_id);
  if (!order || order.status !== "open") fail("E_ORDER_CLOSED");
  if ((await itemPaidQty(ctx, item.id)) > 0) fail("E_ITEM_PAID");
  // Menü fiyatına dönmek serbest; indirim ve farklı fiyat yetki ister
  if (discount > 0 || cents(price) !== cents(Number(item.list_price ?? item.unit_price))) {
    await requirePerm(ctx, cafe, "discounts");
  }
  await ctx.run("UPDATE order_items SET unit_price = ?, unit_discount = ? WHERE id = ?", [price, discount, item.id]);
  await touchOrder(ctx, order.id);
  return tableOrder(ctx, cafe, order.table_id);
}

export async function pos_set_guests(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const orderId = uuid(a.p_order);
  const guests = int(a.p_guests);
  const role = await requireRole(ctx, cafe, "staff");
  if (guests !== null && (guests < 1 || guests > 99)) fail("E_INVALID_QUANTITY");
  const tz = await cafeTimezone(ctx, cafe);

  const order = await ctx.one("SELECT * FROM orders WHERE id = ? AND cafe_id = ? FOR UPDATE", [orderId, cafe]);
  if (!order) fail("E_ORDER_NOT_FOUND");
  if (
    order.status !== "open" &&
    roleRank(role) < roleRank("manager") &&
    bizDate(new Date(order.closed_at), tz) !== bizDate(ctx.now, tz)
  ) {
    fail("E_FORBIDDEN");
  }
  await ctx.run("UPDATE orders SET guests = ?, updated_at = ? WHERE id = ?", [guests, ctx.now, order.id]);
  if (order.status === "open" && order.table_id) return tableOrder(ctx, cafe, order.table_id);
  return { order: await orderJson(ctx, order.id) };
}

export async function pos_update_order(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const orderId = uuid(a.p_order);
  const discount = cents(round(num(a.p_discount) ?? 0, 2));
  await requireRole(ctx, cafe, "staff");
  const order = await lockOpenOrder(ctx, cafe, orderId);

  const sums = await ctx.one(
    `SELECT COALESCE(SUM(CASE WHEN is_comp = 0 THEN quantity * unit_price ELSE 0 END), 0) AS subtotal,
       COALESCE(SUM(CASE WHEN is_comp = 0 THEN quantity * unit_discount ELSE 0 END), 0) AS line_discount
     FROM order_items WHERE order_id = ?`,
    [order.id],
  );
  const subtotal = cents(Number(sums?.subtotal ?? 0));
  const lineDiscount = cents(Number(sums?.line_discount ?? 0));
  const paid = cents(Number((await ctx.val("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = ?", [order.id])) ?? 0));

  if (discount < 0 || discount + lineDiscount > subtotal) fail("E_INVALID_DISCOUNT");
  if (subtotal - lineDiscount - discount < paid) fail("E_DISCOUNT_BELOW_PAID");
  // Hesaba indirim yetki ister (kaldırmak ya da azaltmak serbest)
  if (discount > cents(Number(order.extra_discount ?? 0))) await requirePerm(ctx, cafe, "discounts");

  await ctx.run("UPDATE orders SET note = ?, extra_discount = ?, updated_at = ? WHERE id = ?", [
    cleanText(a.p_note, 200),
    fromCents(discount),
    ctx.now,
    order.id,
  ]);
  await syncDiscount(ctx, order.id);
  return tableOrder(ctx, cafe, order.table_id);
}

export async function pos_history(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const date = validDate(a.p_date);
  await requireRole(ctx, cafe, "staff");
  const tz = await cafeTimezone(ctx, cafe);
  const today = bizDate(ctx.now, tz);
  if (date === null || date > today) fail("E_INVALID_DATE");
  // Ciro kapsamı: none/today → yalnızca bugün, two_days → bugün ve dün, all → hepsi
  const scope = await figuresScope(ctx, cafe);
  if (((scope === "none" || scope === "today") && date < today) || (scope === "two_days" && date < addDays(today, -1))) {
    fail("E_FORBIDDEN");
  }
  const [from, to] = bizRange(date, tz);
  const ids = (
    await ctx.all(
      `SELECT id FROM orders WHERE cafe_id = ? AND status IN ('paid', 'cancelled') AND closed_at >= ? AND closed_at < ?
       ORDER BY closed_at DESC`,
      [cafe, from, to],
    )
  ).map((r) => r.id as string);
  return { date, today, orders: await ordersJson(ctx, ids) };
}
