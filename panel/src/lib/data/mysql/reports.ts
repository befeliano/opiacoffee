// Raporlar (report_*). Toplamlar SQL'de (DECIMAL) yapılır; iş günü ve yerel saat
// hesapları tzOffsetSql ile SQL'e gömülür.

import type { Ctx, Row } from "./db";
import {
  bit,
  can,
  bizDate,
  bizDateSql,
  bizRange,
  cafeTimezone,
  cents,
  daysBetween,
  fail,
  fromCents,
  iso,
  localSql,
  parseJson,
  requirePerm,
  requireRole,
  round,
  tzOffsetSql,
  unitCostSql,
  uuid,
  validDate,
  addDays,
  totalsSql,
} from "./helpers";
import { dayJson } from "./day";

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const nOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const SEP = "0x1f";
/** Gruptaki en son değer (array_agg(x order by …)[1]) */
const latest = (col: string, order: string) => `SUBSTRING_INDEX(GROUP_CONCAT(${col} ORDER BY ${order} SEPARATOR ${SEP}), ${SEP}, 1)`;

async function range(ctx: Ctx, a: Row, key: string, maxDays: number) {
  const cafe = uuid(a.p_cafe);
  const from = validDate(a.p_from);
  const to = validDate(a.p_to);
  await requirePerm(ctx, cafe, key);
  if (from === null || to === null || to < from || daysBetween(from, to) > maxDays) fail("E_INVALID_RANGE");
  const tz = await cafeTimezone(ctx, cafe);
  const [start] = bizRange(from, tz);
  const [end] = bizRange(addDays(to, 1), tz);
  return { cafe, from, to, tz, start, end };
}

/** Ödenmiş adisyonların sipariş bazında tam satırı (report_range/report_series'teki order_full) */
function orderFullSql(tz: string, from: string, to: string) {
  const off = tzOffsetSql("o.closed_at", tz, from, to);
  return `SELECT x.*,
      LEAST(x.discount_amount, x.subtotal) AS discount,
      x.subtotal - LEAST(x.discount_amount, x.subtotal) AS revenue
    FROM (
      SELECT o.id, o.table_id, o.table_name, o.is_takeaway, o.opened_at, o.closed_at, o.guests, o.discount_amount,
        ${bizDateSql("o.closed_at", off)} AS d,
        TIMESTAMPDIFF(MICROSECOND, o.opened_at, o.closed_at) AS micros,
        (SELECT COALESCE(SUM(CASE WHEN i.is_comp = 0 THEN i.quantity * i.unit_price ELSE 0 END), 0) FROM order_items i WHERE i.order_id = o.id) AS subtotal,
        (SELECT COALESCE(SUM(CASE WHEN i.is_comp = 1 THEN i.quantity * i.unit_price ELSE 0 END), 0) FROM order_items i WHERE i.order_id = o.id) AS comp_value,
        (SELECT COALESCE(SUM(i.quantity * i.unit_cost), 0) FROM order_items i WHERE i.order_id = o.id) AS cost,
        (SELECT COALESCE(SUM(i.quantity), 0) FROM order_items i WHERE i.order_id = o.id) AS qty,
        (SELECT COALESCE(SUM(CASE WHEN p.method = 'card' THEN p.amount ELSE 0 END), 0) FROM payments p WHERE p.order_id = o.id) AS card,
        (SELECT COALESCE(SUM(CASE WHEN p.method = 'cash' THEN p.amount ELSE 0 END), 0) FROM payments p WHERE p.order_id = o.id) AS cash,
        (SELECT COALESCE(SUM(CASE WHEN p.method = 'ticket' THEN p.amount ELSE 0 END), 0) FROM payments p WHERE p.order_id = o.id) AS ticket,
        (SELECT COALESCE(SUM(p.commission_amount), 0) FROM payments p WHERE p.order_id = o.id) AS commission
      FROM orders o
      WHERE o.cafe_id = ? AND o.status = 'paid' AND o.closed_at >= ? AND o.closed_at < ?
    ) x`;
}

const DAILY_SELECT = `SELECT d,
    COUNT(*) AS orders,
    ROUND(SUM(revenue), 2) AS revenue,
    ROUND(SUM(cost), 2) AS cost,
    ROUND(SUM(commission), 2) AS commission,
    ROUND(SUM(card), 2) AS card,
    ROUND(SUM(cash), 2) AS cash,
    ROUND(SUM(ticket), 2) AS ticket,
    ROUND(SUM(discount), 2) AS discount,
    ROUND(SUM(comp_value), 2) AS comp_value,
    SUM(qty) AS items,
    SUM(is_takeaway = 0) AS table_sessions,
    ROUND(COALESCE(SUM(CASE WHEN is_takeaway = 0 THEN micros END), 0) / 60000000, 1) AS occupancy_minutes,
    SUM(is_takeaway = 1) AS takeaway_orders,
    COALESCE(SUM(guests), 0) AS guests,
    SUM(guests IS NOT NULL) AS guest_orders,
    ROUND(COALESCE(SUM(CASE WHEN guests IS NOT NULL THEN revenue END), 0), 2) AS guest_revenue`;

function dailyJson(r: Row, cancelled: number) {
  return {
    date: r.d,
    orders: n(r.orders),
    revenue: n(r.revenue),
    cost: n(r.cost),
    commission: n(r.commission),
    card: n(r.card),
    cash: n(r.cash),
    ticket: n(r.ticket),
    discount: n(r.discount),
    comp_value: n(r.comp_value),
    items: n(r.items),
    table_sessions: n(r.table_sessions),
    occupancy_minutes: n(r.occupancy_minutes),
    takeaway_orders: n(r.takeaway_orders),
    guests: n(r.guests),
    guest_orders: n(r.guest_orders),
    guest_revenue: n(r.guest_revenue),
    cancelled,
  };
}

/** Saatlik tur/adet/ciro: aynı adisyonda 5 dakikadan uzun aradan sonra eklenen satır yeni turdur */
async function hourly(ctx: Ctx, cafe: string, tz: string, from: string, to: string, start: Date, end: Date, withId: boolean, onlyRange: boolean) {
  const off = tzOffsetSql("i.created_at", tz, from, to);
  const rows = await ctx.all(
    `SELECT d, h, SUM(new_round) AS rounds, SUM(quantity) AS items, ROUND(SUM(line_revenue), 2) AS revenue FROM (
       SELECT ${bizDateSql("i.created_at", off)} AS d, HOUR(${localSql("i.created_at", off)}) AS h, i.quantity,
         CASE WHEN i.is_comp = 1 THEN 0 ELSE i.quantity * i.unit_price END AS line_revenue,
         CASE WHEN LAG(i.created_at) OVER w IS NULL
           OR TIMESTAMPDIFF(MICROSECOND, LAG(i.created_at) OVER w, i.created_at) > 300000000 THEN 1 ELSE 0 END AS new_round
       FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.cafe_id = ? AND o.status = 'paid' AND o.closed_at >= ? AND o.closed_at < ?
       WINDOW w AS (PARTITION BY i.order_id ORDER BY i.created_at${withId ? ", i.id" : ""})
     ) r
     ${onlyRange ? "WHERE d BETWEEN ? AND ?" : ""}
     GROUP BY d, h ORDER BY d, h`,
    onlyRange ? [cafe, start, end, from, to] : [cafe, start, end],
  );
  return rows.map((r) => ({ date: r.d, hour: n(r.h), rounds: n(r.rounds), items: n(r.items), revenue: n(r.revenue) }));
}

async function report_range_raw(ctx: Ctx, a: Row) {
  const { cafe, from, to, tz, start, end } = await range(ctx, a, "reports", 400);
  const full = orderFullSql(tz, from, to);
  const params = [cafe, start, end];

  const daily = await ctx.all(`${DAILY_SELECT} FROM (${full}) f GROUP BY d`, params);
  const offClosed = tzOffsetSql("o.closed_at", tz, from, to);
  const cancelled = await ctx.all(
    `SELECT ${bizDateSql("o.closed_at", offClosed)} AS d, COUNT(*) AS cancelled FROM orders o
     WHERE o.cafe_id = ? AND o.status = 'cancelled' AND o.closed_at >= ? AND o.closed_at < ? GROUP BY d`,
    params,
  );
  const byDay = new Map<string, Row>(daily.map((r) => [r.d, r]));
  const cancelledBy = new Map<string, number>(cancelled.map((r) => [r.d, n(r.cancelled)]));
  const days = [...new Set([...byDay.keys(), ...cancelledBy.keys()])].sort();

  const products = await ctx.all(
    `SELECT pa.*, COALESCE(pr.name, pa.snapshot_name) AS name, COALESCE(c.name, pa.snapshot_category) AS category
     FROM (
       SELECT i.product_id,
         ${latest("i.product_name", "i.created_at DESC")} AS snapshot_name,
         ${latest("i.category_name", "i.created_at DESC")} AS snapshot_category,
         SUM(i.quantity) AS qty,
         ROUND(COALESCE(SUM(CASE WHEN i.is_comp = 0 THEN i.quantity * (i.unit_price - i.unit_discount) END), 0), 2) AS revenue,
         ROUND(SUM(i.quantity * i.unit_cost), 2) AS cost,
         COALESCE(SUM(CASE WHEN i.is_comp = 1 THEN i.quantity END), 0) AS comp_qty
       FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.cafe_id = ? AND o.status = 'paid' AND o.closed_at >= ? AND o.closed_at < ?
       GROUP BY i.product_id, CASE WHEN i.product_id IS NULL THEN i.product_name END
     ) pa
     LEFT JOIN products pr ON pr.id = pa.product_id
     LEFT JOIN categories c ON c.id = pr.category_id
     ORDER BY pa.qty DESC, pa.revenue DESC`,
    params,
  );

  const tables = await ctx.all(
    `SELECT table_id, ${latest("table_name", "closed_at DESC")} AS name, COUNT(*) AS sessions,
       ROUND(SUM(micros) / 60000000, 1) AS minutes, ROUND(MAX(micros) / 60000000, 1) AS max_minutes,
       ROUND(SUM(revenue), 2) AS revenue
     FROM (${full}) f WHERE is_takeaway = 0
     GROUP BY table_id, CASE WHEN table_id IS NULL THEN table_name END
     ORDER BY SUM(micros) DESC`,
    params,
  );

  const longest = await ctx.all(
    `SELECT table_name, opened_at, closed_at, ROUND(micros / 60000000, 1) AS minutes, ROUND(revenue, 2) AS revenue
     FROM (${full}) f WHERE is_takeaway = 0 ORDER BY micros DESC LIMIT 5`,
    params,
  );

  // Seçenekler: kombinasyon başına adet SQL'de, kombinasyonun açılımı burada
  const combos = await ctx.all(
    `SELECT i.option_ids, SUM(i.quantity) AS qty FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE o.cafe_id = ? AND o.status = 'paid' AND o.closed_at >= ? AND o.closed_at < ? AND i.option_ids <> '[]'
     GROUP BY i.option_ids`,
    params,
  );
  const optionQty = new Map<string, number>();
  for (const c of combos) for (const id of parseJson<string[]>(c.option_ids, [])) optionQty.set(id, (optionQty.get(id) ?? 0) + n(c.qty));
  const optionRows = optionQty.size
    ? await ctx.all(
        `SELECT o.id, o.name, g.name AS group_name FROM options o JOIN option_groups g ON g.id = o.group_id
         WHERE o.id IN (${[...optionQty.keys()].map(() => "?").join(",")})`,
        [...optionQty.keys()],
      )
    : [];

  const menu = await ctx.all(
    `SELECT p.id, p.name, COALESCE(c.name, '') AS category, p.price, p.is_active, ${unitCostSql("p", "product_id")} AS unit_cost
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.cafe_id = ? ORDER BY c.sort_order IS NULL, c.sort_order, p.sort_order, p.name`,
    [cafe],
  );

  return {
    range: { from, to, timezone: tz },
    generated_at: iso(ctx.now),
    daily: days.map((d) => dailyJson(byDay.get(d) ?? { d }, cancelledBy.get(d) ?? 0)),
    hourly: await hourly(ctx, cafe, tz, from, to, start, end, true, false),
    products: products.map((p) => ({
      product_id: p.product_id,
      name: p.name,
      category: p.category,
      qty: n(p.qty),
      revenue: n(p.revenue),
      cost: n(p.cost),
      comp_qty: n(p.comp_qty),
    })),
    tables: tables.map((t) => ({
      table_id: t.table_id,
      name: t.name,
      sessions: n(t.sessions),
      minutes: n(t.minutes),
      max_minutes: n(t.max_minutes),
      revenue: n(t.revenue),
    })),
    longest: longest.map((l) => ({
      table_name: l.table_name,
      opened_at: iso(l.opened_at),
      closed_at: iso(l.closed_at),
      minutes: n(l.minutes),
      revenue: n(l.revenue),
    })),
    options: optionRows
      .map((o) => ({ id: o.id, name: o.name, group_name: o.group_name, qty: optionQty.get(o.id) ?? 0 }))
      .sort((x, y) => y.qty - x.qty),
    menu: menu.map((p) => ({
      product_id: p.id,
      name: p.name,
      category: p.category,
      price: n(p.price),
      unit_cost: round(n(p.unit_cost), 4),
      is_active: bit(p.is_active),
    })),
  };
}

async function report_series_raw(ctx: Ctx, a: Row) {
  const { cafe, from, to, tz, start, end } = await range(ctx, a, "reports", 400);
  const daily = await ctx.all(`${DAILY_SELECT} FROM (${orderFullSql(tz, from, to)}) f GROUP BY d ORDER BY d`, [cafe, start, end]);
  return {
    range: { from, to, timezone: tz },
    daily: daily.map((r) => dailyJson(r, 0)),
    hourly: await hourly(ctx, cafe, tz, from, to, start, end, false, true),
  };
}

async function report_products_raw(ctx: Ctx, a: Row) {
  const { cafe, from, to, tz, start, end } = await range(ctx, a, "reports", 7300);
  const off = tzOffsetSql("o.closed_at", tz, from, to);
  const params = [cafe, start, end];

  const agg = await ctx.all(
    `SELECT a.*, COALESCE(pr.name, a.snapshot_name) AS name, COALESCE(c.name, a.snapshot_category) AS category,
       COALESCE(pr.is_active, 0) AS is_active, pr.price
     FROM (
       SELECT i.product_id,
         ${latest("i.product_name", "o.closed_at DESC")} AS snapshot_name,
         ${latest("i.category_name", "o.closed_at DESC")} AS snapshot_category,
         SUM(i.quantity) AS qty,
         COALESCE(SUM(CASE WHEN i.is_comp = 0 THEN i.quantity * i.unit_price END), 0) AS revenue,
         SUM(i.quantity * i.unit_cost) AS cost,
         COALESCE(SUM(CASE WHEN i.is_comp = 1 THEN i.quantity END), 0) AS comp_qty,
         COUNT(DISTINCT ${bizDateSql("o.closed_at", off)}) AS days_sold
       FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.cafe_id = ? AND o.status = 'paid' AND o.closed_at >= ? AND o.closed_at < ?
       GROUP BY i.product_id, CASE WHEN i.product_id IS NULL THEN i.product_name END
     ) a
     LEFT JOIN products pr ON pr.id = a.product_id
     LEFT JOIN categories c ON c.id = pr.category_id
     ORDER BY a.qty DESC, a.revenue DESC`,
    params,
  );
  const paid = await ctx.one(
    `SELECT COUNT(*) AS orders, COUNT(DISTINCT ${bizDateSql("o.closed_at", off)}) AS days
     FROM orders o WHERE o.cafe_id = ? AND o.status = 'paid' AND o.closed_at >= ? AND o.closed_at < ?`,
    params,
  );
  const firstSale = await ctx.val<Date>("SELECT MIN(closed_at) FROM orders WHERE cafe_id = ? AND status = 'paid'", [cafe]);
  const sold = new Set(agg.map((r) => r.product_id).filter(Boolean));
  const unsold = (
    await ctx.all(
      `SELECT p.id, p.name, COALESCE(c.name, '') AS category, p.price FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.cafe_id = ? AND p.is_active = 1 ORDER BY c.sort_order IS NULL, c.sort_order, p.sort_order`,
      [cafe],
    )
  ).filter((p) => !sold.has(p.id));

  // Toplamlar ürün satırlarından (Postgres'teki totals CTE'si)
  const sum4 = (key: string) => agg.reduce((s, r) => s + Math.round(n(r[key]) * 10000), 0) / 10000;
  return {
    range: { from, to, timezone: tz },
    first_sale: firstSale ? bizDate(new Date(firstSale), tz) : null,
    days: n(paid?.days),
    totals: {
      orders: n(paid?.orders),
      items: agg.reduce((s, r) => s + n(r.qty), 0),
      revenue: round(sum4("revenue"), 2),
      cost: round(sum4("cost"), 2),
    },
    products: agg.map((r) => ({
      product_id: r.product_id,
      name: r.name,
      category: r.category,
      qty: n(r.qty),
      revenue: round(n(r.revenue), 2),
      cost: round(n(r.cost), 2),
      comp_qty: n(r.comp_qty),
      days_sold: n(r.days_sold),
      is_active: bit(r.is_active),
      price: nOrNull(r.price),
    })),
    unsold: unsold.map((p) => ({ product_id: p.id, name: p.name, category: p.category, price: n(p.price) })),
  };
}

export async function report_product_daily(ctx: Ctx, a: Row) {
  const { cafe, from, to, tz, start, end } = await range(ctx, a, "reports", 400);
  const off = tzOffsetSql("o.closed_at", tz, from, to);
  const rows = await ctx.all(
    `SELECT ${bizDateSql("o.closed_at", off)} AS d, i.product_id, SUM(i.quantity) AS qty
     FROM orders o JOIN order_items i ON i.order_id = o.id
     WHERE o.cafe_id = ? AND o.status = 'paid' AND o.closed_at >= ? AND o.closed_at < ? AND i.product_id IS NOT NULL
     GROUP BY d, i.product_id ORDER BY d`,
    [cafe, start, end],
  );
  return rows.map((r) => ({ d: r.d, p: r.product_id, q: n(r.qty) }));
}

// ---------------------------------------------------------------------
// Z raporu (gün sonu)
// ---------------------------------------------------------------------
export async function report_z(ctx: Ctx, a: Row) {
  const cafeId = uuid(a.p_cafe);
  const date = validDate(a.p_date);
  await requireRole(ctx, cafeId, "owner");
  const cafe = await ctx.one("SELECT * FROM cafes WHERE id = ?", [cafeId]);
  if (!cafe) fail("E_FORBIDDEN");
  if (date === null || date > bizDate(ctx.now, cafe.timezone) || date < "2000-01-01") fail("E_INVALID_DATE");

  const [from, to] = bizRange(date, cafe.timezone);
  const [y, m] = date.split("-").map(Number);
  const monthDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const zParams = [cafeId, from, to];
  const z = "o.cafe_id = ? AND o.status IN ('paid', 'cancelled') AND o.closed_at >= ? AND o.closed_at < ?";
  const zPaid = "o.cafe_id = ? AND o.status = 'paid' AND o.closed_at >= ? AND o.closed_at < ?";

  const sales = await ctx.one(
    `SELECT SUM(status = 'paid') AS orders, SUM(status = 'cancelled') AS cancelled,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN subtotal END), 0) AS gross,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN comp_total END), 0) AS comp,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN discount END), 0) AS discount,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN total END), 0) AS revenue,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN guests END), 0) AS guests,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN items END), 0) AS items
     FROM (${totalsSql(z, ", o.status, o.guests")}) t`,
    zParams,
  );
  const pay = await ctx.one(
    `SELECT
       COALESCE(SUM(CASE WHEN p.method = 'cash' THEN p.amount END), 0) AS cash,
       COALESCE(SUM(CASE WHEN p.method = 'card' THEN p.amount END), 0) AS card,
       COALESCE(SUM(p.method = 'cash'), 0) AS cash_count,
       COALESCE(SUM(p.method = 'card'), 0) AS card_count,
       COALESCE(SUM(CASE WHEN p.method = 'ticket' THEN p.amount END), 0) AS ticket,
       COALESCE(SUM(p.method = 'ticket'), 0) AS ticket_count,
       COALESCE(SUM(p.amount), 0) AS total,
       COALESCE(SUM(p.vat_amount), 0) AS vat,
       COALESCE(SUM(CASE WHEN p.method = 'cash' THEN p.vat_amount END), 0) AS vat_cash,
       COALESCE(SUM(CASE WHEN p.method = 'card' THEN p.vat_amount END), 0) AS vat_card,
       COALESCE(SUM(CASE WHEN p.method = 'ticket' THEN p.vat_amount END), 0) AS vat_ticket,
       COALESCE(SUM(p.commission_amount), 0) AS commission
     FROM payments p JOIN orders o ON o.id = p.order_id WHERE ${zPaid}`,
    zParams,
  );
  const cost = n(
    await ctx.val(
      `SELECT COALESCE(ROUND(SUM(i.quantity * i.unit_cost), 2), 0) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE ${zPaid}`,
      zParams,
    ),
  );

  // Giderler: aylık sabit giderin günlük payı + bugüne yazılmış tek seferlikler
  const expenses = (
    await ctx.all(
      `SELECT name, category, kind, amount, CASE WHEN kind = 'monthly' THEN ROUND(amount / ?, 2) ELSE amount END AS day_amount
       FROM expenses
       WHERE cafe_id = ? AND (
         (kind = 'monthly' AND starts_on <= ? AND (ends_on IS NULL OR ends_on >= ?))
         OR (kind = 'one_time' AND starts_on = ?))
       ORDER BY kind, category, name`,
      [monthDays, cafeId, date, date, date],
    )
  ).map((e) => ({
    name: e.name,
    category: e.category,
    kind: e.kind,
    monthly_amount: e.kind === "monthly" ? n(e.amount) : null,
    amount: n(e.day_amount),
  }));
  const expenseTotal = fromCents(expenses.reduce((s, e) => s + cents(e.amount), 0));

  const revenue = n(sales?.revenue);
  const vat = n(pay?.vat);
  const commission = n(pay?.commission);
  const gross = cents(revenue) - cents(vat) - cents(cost) - cents(commission);

  const products = await ctx.all(
    `SELECT * FROM (SELECT i.product_name AS name, i.category_name AS category, SUM(i.quantity) AS qty,
       SUM(CASE WHEN i.is_comp = 1 THEN i.quantity END) AS comp_qty,
       ROUND(SUM(CASE WHEN i.is_comp = 0 THEN i.quantity * (i.unit_price - i.unit_discount) END), 2) AS revenue,
       ROUND(SUM(i.quantity * i.unit_cost), 2) AS cost
     FROM order_items i JOIN orders o ON o.id = i.order_id WHERE ${zPaid}
     GROUP BY i.product_name, i.category_name) x
     ORDER BY qty DESC, revenue IS NULL DESC, revenue DESC, name`,
    zParams,
  );
  const categories = await ctx.all(
    `SELECT NULLIF(i.category_name, '') AS name, SUM(i.quantity) AS qty,
       ROUND(COALESCE(SUM(CASE WHEN i.is_comp = 0 THEN i.quantity * (i.unit_price - i.unit_discount) END), 0), 2) AS revenue
     FROM order_items i JOIN orders o ON o.id = i.order_id WHERE ${zPaid}
     GROUP BY i.category_name ORDER BY revenue DESC`,
    zParams,
  );
  const payments = await ctx.all(
    `SELECT p.created_at, o.table_name, p.method, p.amount, p.vat_amount, p.commission_amount
     FROM payments p JOIN orders o ON o.id = p.order_id WHERE ${zPaid} ORDER BY p.created_at`,
    zParams,
  );
  const days = await ctx.all("SELECT * FROM cafe_days WHERE cafe_id = ? AND business_date = ? ORDER BY opened_at", [cafeId, date]);


  return {
    cafe: { name: cafe.name, timezone: cafe.timezone },
    date,
    from: iso(from),
    to: iso(to),
    generated_at: iso(ctx.now),
    vat_rate: n(cafe.vat_rate),
    commission_rate: n(cafe.card_commission_rate),
    ticket_commission_rate: n(cafe.ticket_commission_rate),
    sales: {
      orders: n(sales?.orders),
      cancelled: n(sales?.cancelled),
      gross: n(sales?.gross),
      comp: n(sales?.comp),
      discount: n(sales?.discount),
      revenue,
      guests: n(sales?.guests),
      items: n(sales?.items),
    },
    payments: {
      cash: n(pay?.cash),
      card: n(pay?.card),
      cash_count: n(pay?.cash_count),
      card_count: n(pay?.card_count),
      ticket: n(pay?.ticket),
      ticket_count: n(pay?.ticket_count),
      total: n(pay?.total),
      vat,
      vat_cash: n(pay?.vat_cash),
      vat_card: n(pay?.vat_card),
      vat_ticket: n(pay?.vat_ticket),
      commission,
    },
    cost,
    expenses,
    summary: {
      revenue,
      vat,
      revenue_ex_vat: fromCents(cents(revenue) - cents(vat)),
      cost,
      commission,
      gross_profit: fromCents(gross),
      expenses: expenseTotal,
      net_profit: fromCents(gross - cents(expenseTotal)),
    },
    products: products.map((p) => ({
      name: p.name,
      category: p.category,
      qty: n(p.qty),
      comp_qty: nOrNull(p.comp_qty),
      revenue: nOrNull(p.revenue),
      cost: n(p.cost),
    })),
    categories: categories.map((c) => ({ name: c.name, qty: n(c.qty), revenue: n(c.revenue) })),
    payment_list: payments.map((p) => ({
      at: iso(p.created_at),
      table: p.table_name,
      method: p.method,
      amount: n(p.amount),
      vat: n(p.vat_amount),
      commission: n(p.commission_amount),
    })),
    days: await Promise.all(days.map((d) => dayJson(ctx, d, true))),
  };
}

// ---------------------------------------------------------------------
// Kâr yetkisi olmayan üyeye maliyet alanları hiç gönderilmez (private.strip_keys)
// ---------------------------------------------------------------------
function stripKeys(value: unknown, keys: string[]): unknown {
  if (Array.isArray(value)) return value.map((v) => stripKeys(v, keys));
  if (value && typeof value === "object") {
    const out: Row = {};
    for (const [k, v] of Object.entries(value)) if (!keys.includes(k)) out[k] = stripKeys(v, keys);
    return out;
  }
  return value;
}

function withProfitGuard(raw: (ctx: Ctx, a: Row) => Promise<unknown>) {
  return async (ctx: Ctx, a: Row) => {
    const result = await raw(ctx, a);
    if (await can(ctx, uuid(a.p_cafe), "profit")) return result;
    return stripKeys(result, ["cost", "unit_cost"]);
  };
}

export const report_range = withProfitGuard(report_range_raw);
export const report_series = withProfitGuard(report_series_raw);
export const report_products = withProfitGuard(report_products_raw);
