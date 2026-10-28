// Uygulama bağlamı, kafe ayarları ve gün açma/kapama (kasa sayımı).

import type { Ctx, Row } from "./db";
import {
  addDays,
  bit,
  bizDate,
  bool,
  cafeTimezone,
  cents,
  cleanText,
  fail,
  field,
  figuresScope,
  fromCents,
  iso,
  isValidTimezone,
  left,
  memberPerms,
  newId,
  num,
  obj,
  parseJson,
  requireAuth,
  requireRole,
  round,
  str,
  totalsSql,
  uuid,
} from "./helpers";

// ---------------------------------------------------------------------
// Uygulama
// ---------------------------------------------------------------------
export async function app_brand(ctx: Ctx) {
  const c = await ctx.one("SELECT name, theme, logo, language FROM cafes ORDER BY created_at, name LIMIT 1");
  return c ? { name: c.name, theme: c.theme, logo: c.logo, language: c.language } : {};
}

export async function app_my_cafes(ctx: Ctx) {
  if (!ctx.uid) return [];
  const rows = await ctx.all(
    `SELECT c.id, c.slug, c.name, m.role, c.theme FROM cafe_members m JOIN cafes c ON c.id = m.cafe_id
     WHERE m.user_id = ? ORDER BY c.created_at, c.name`,
    [ctx.uid],
  );
  return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, role: r.role, theme: r.theme }));
}

export async function app_cafe_context(ctx: Ctx, a: Row) {
  const uid = requireAuth(ctx);
  const c = await ctx.one(
    `SELECT c.*, m.role, m.permissions, m.display_name, (SELECT u.email FROM app_users u WHERE u.id = ?) AS email
     FROM cafes c JOIN cafe_members m ON m.cafe_id = c.id AND m.user_id = ?
     WHERE c.slug = ?`,
    [uid, uid, str(a.p_slug)],
  );
  if (!c) fail("E_FORBIDDEN");
  return {
    cafe: {
      id: c.id,
      slug: c.slug,
      name: c.name,
      timezone: c.timezone,
      card_commission_rate: Number(c.card_commission_rate),
      ticket_commission_rate: Number(c.ticket_commission_rate),
      vat_rate: Number(c.vat_rate),
      open_hour: c.open_hour,
      close_hour: c.close_hour,
      theme: c.theme,
      logo: c.logo,
      currency: c.currency,
      language: c.language,
      cash_count: bit(c.cash_count),
    },
    role: c.role,
    permissions: memberPerms(c.role, c.permissions),
    user: { id: uid, email: c.email, display_name: c.display_name },
    cafes: await app_my_cafes(ctx),
  };
}

export async function cafe_set_logo(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "owner");
  const logo = str(a.p_logo) || null;
  if (logo !== null && (logo.length > 200000 || !/^data:image\/(png|jpeg|webp);base64,/.test(logo))) fail("E_INVALID_INPUT");
  await ctx.run("UPDATE cafes SET logo = ? WHERE id = ?", [logo, cafe]);
  return null;
}

const THEMES = ["coffee", "forest", "ocean", "berry", "slate", "sunset"];

export async function cafe_update_settings(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const s = obj(a.p_settings) ?? {};
  const name = cleanText(field(s, "name"), 80);
  const rate = (v: string | null) => (v === null ? null : round(num(v)!, 4));
  const card = rate(field(s, "card_commission_rate"));
  const ticket = rate(field(s, "ticket_commission_rate"));
  const vat = rate(field(s, "vat_rate"));
  const smallint = (v: string | null) => {
    if (v === null) return null;
    const n = num(v)!;
    return round(n);
  };
  const open = smallint(field(s, "open_hour"));
  const close = smallint(field(s, "close_hour"));
  const tz = field(s, "timezone") || null;
  const theme = field(s, "theme") || null;
  const currency = field(s, "currency") ? field(s, "currency")!.toUpperCase() : null;
  const language = field(s, "language") || null;
  const cashCount = bool(field(s, "cash_count"));

  await requireRole(ctx, cafe, "owner");
  if ("name" in s && name === "") fail("E_NAME_REQUIRED");
  if (tz !== null && !isValidTimezone(tz)) fail("E_INVALID_INPUT");
  if (theme !== null && !THEMES.includes(theme)) fail("E_INVALID_INPUT");
  if (currency !== null && !/^[A-Z]{3}$/.test(currency)) fail("E_INVALID_INPUT");

  // Kasa sayımı kapatılırken açık gün kalmasın (kayıtlar sayımsız kapanır)
  if (cashCount === false) {
    const day = await ctx.one("SELECT * FROM cafe_days WHERE cafe_id = ? AND closed_at IS NULL", [cafe]);
    if (day) {
      const summary = await windowSummary(ctx, cafe, new Date(day.opened_at), ctx.now);
      await ctx.run(
        "UPDATE cafe_days SET closed_at = ?, summary = ?, expected_cash = ?, card_expected = ?, note = ? WHERE id = ?",
        [
          ctx.now,
          JSON.stringify(summary),
          day.opening_cash === null ? null : fromCents(cents(Number(day.opening_cash)) + cents(summary.cash)),
          summary.card,
          left([day.note, "Kasa sayımı kapatıldı"].filter((x) => x).join(" · "), 200),
          day.id,
        ],
      );
    }
  }

  await ctx.run(
    `UPDATE cafes SET
       name = COALESCE(NULLIF(?, ''), name),
       card_commission_rate = COALESCE(?, card_commission_rate),
       ticket_commission_rate = COALESCE(?, ticket_commission_rate),
       vat_rate = COALESCE(?, vat_rate),
       open_hour = COALESCE(?, open_hour),
       close_hour = COALESCE(?, close_hour),
       timezone = COALESCE(?, timezone),
       theme = COALESCE(?, theme),
       currency = COALESCE(?, currency),
       language = COALESCE(?, language),
       cash_count = COALESCE(?, cash_count)
     WHERE id = ?`,
    [name, card, ticket, vat, open, close, tz, theme, currency, language, cashCount === null ? null : cashCount ? 1 : 0, cafe],
  );
  return null;
}

// ---------------------------------------------------------------------
// private.window_summary: bir zaman aralığındaki satış ve tahsilat özeti
// ---------------------------------------------------------------------
export interface WindowSummary {
  orders: number;
  cancelled: number;
  revenue: number;
  discount: number;
  comp: number;
  cost: number;
  cash: number;
  card: number;
  ticket: number;
  commission: number;
}

export async function windowSummary(ctx: Ctx, cafe: string, from: Date, to: Date): Promise<WindowSummary> {
  const o = await ctx.one(
    `SELECT
       COALESCE(SUM(status = 'paid'), 0) AS orders,
       COALESCE(SUM(status = 'cancelled'), 0) AS cancelled,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) AS revenue,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN discount ELSE 0 END), 0) AS discount,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN comp_total ELSE 0 END), 0) AS comp,
       ROUND(COALESCE(SUM(CASE WHEN status = 'paid' THEN cost ELSE 0 END), 0), 2) AS cost
     FROM (${totalsSql("o.cafe_id = ? AND o.closed_at >= ? AND o.closed_at < ?", ", o.status")}) y`,
    [cafe, from, to],
  );
  const p = await ctx.one(
    `SELECT
       COALESCE(SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END), 0) AS cash,
       COALESCE(SUM(CASE WHEN method = 'card' THEN amount ELSE 0 END), 0) AS card,
       COALESCE(SUM(CASE WHEN method = 'ticket' THEN amount ELSE 0 END), 0) AS ticket,
       COALESCE(SUM(commission_amount), 0) AS commission
     FROM payments WHERE cafe_id = ? AND created_at >= ? AND created_at < ?`,
    [cafe, from, to],
  );
  return {
    orders: Number(o?.orders ?? 0),
    cancelled: Number(o?.cancelled ?? 0),
    revenue: Number(o?.revenue ?? 0),
    discount: Number(o?.discount ?? 0),
    comp: Number(o?.comp ?? 0),
    cost: Number(o?.cost ?? 0),
    cash: Number(p?.cash ?? 0),
    card: Number(p?.card ?? 0),
    ticket: Number(p?.ticket ?? 0),
    commission: Number(p?.commission ?? 0),
  };
}


// ---------------------------------------------------------------------
// Gün (kasa) kayıtları
// ---------------------------------------------------------------------
export async function dayJson(ctx: Ctx, d: Row | null, money: boolean) {
  if (!d) return null;
  const names = new Map(
    (
      await ctx.all("SELECT user_id, display_name FROM cafe_members WHERE cafe_id = ? AND user_id IN (?, ?)", [
        d.cafe_id,
        d.opened_by ?? "",
        d.closed_by ?? "",
      ])
    ).map((r) => [r.user_id, r.display_name]),
  );
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const out: Row = {
    id: d.id,
    business_date: d.business_date,
    opened_at: iso(d.opened_at),
    opened_by: names.get(d.opened_by) ?? "",
    opening_cash: n(d.opening_cash),
    closed_at: iso(d.closed_at),
    closed_by: names.get(d.closed_by) ?? "",
    counted_cash: n(d.counted_cash),
    cash_difference: n(d.cash_difference),
    pos_total: n(d.pos_total),
    card_difference: n(d.card_difference),
    note: d.note,
  };
  if (money) {
    out.expected_cash = n(d.expected_cash);
    out.card_expected = n(d.card_expected);
    out.summary = parseJson(d.summary, null);
  }
  return out;
}

export async function day_status(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "staff");
  const manager = (await figuresScope(ctx, cafe)) === "all";
  const tz = await cafeTimezone(ctx, cafe);
  const today = bizDate(ctx.now, tz);

  const open = await ctx.one("SELECT * FROM cafe_days WHERE cafe_id = ? AND closed_at IS NULL LIMIT 1", [cafe]);
  const last = await ctx.one(
    "SELECT * FROM cafe_days WHERE cafe_id = ? AND closed_at IS NOT NULL ORDER BY closed_at DESC LIMIT 1",
    [cafe],
  );
  let live: Row | null = null;
  if (open) {
    const summary = await windowSummary(ctx, cafe, new Date(open.opened_at), ctx.now);
    // Açılış nakdi girilmediyse beklenen nakit bilinmez
    live = {
      ...summary,
      expected_cash: open.opening_cash === null ? null : fromCents(cents(Number(open.opening_cash)) + cents(summary.cash)),
    };
  }
  const history = await ctx.all(
    `SELECT * FROM cafe_days WHERE cafe_id = ? AND closed_at IS NOT NULL AND (? OR business_date >= ?)
     ORDER BY closed_at DESC LIMIT 14`,
    [cafe, manager ? 1 : 0, addDays(today, -1)],
  );
  const openOrders = await ctx.val("SELECT COUNT(*) FROM orders WHERE cafe_id = ? AND status = 'open'", [cafe]);

  return {
    now: iso(ctx.now),
    business_date: today,
    open: await dayJson(ctx, open, true),
    live,
    last: await dayJson(ctx, last, true),
    open_orders: Number(openOrders ?? 0),
    history: await Promise.all(history.map((d) => dayJson(ctx, d, true))),
  };
}

function money(value: unknown): number | null {
  const n = num(value);
  if (n === null) return null;
  const r = round(n, 2);
  if (r < 0 || r >= 10000000) fail("E_INVALID_AMOUNT");
  return r;
}

export async function day_open(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "staff");
  const cash = a.p_opening_cash === undefined ? 0 : money(a.p_opening_cash);

  const tz = (await ctx.val<string>("SELECT timezone FROM cafes WHERE id = ? FOR UPDATE", [cafe])) ?? "Europe/Istanbul";
  if (await ctx.val("SELECT 1 FROM cafe_days WHERE cafe_id = ? AND closed_at IS NULL LIMIT 1", [cafe])) {
    fail("E_DAY_ALREADY_OPEN");
  }
  await ctx.run(
    "INSERT INTO cafe_days (id, cafe_id, business_date, opened_at, opened_by, opening_cash) VALUES (?, ?, ?, ?, ?, ?)",
    [newId(), cafe, bizDate(ctx.now, tz), ctx.now, ctx.uid, cash],
  );
  return day_status(ctx, a);
}

export async function day_close(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "staff");
  const counted = money(a.p_counted_cash);
  const pos = money(a.p_pos_total);

  const day = await ctx.one("SELECT * FROM cafe_days WHERE cafe_id = ? AND closed_at IS NULL FOR UPDATE", [cafe]);
  if (!day) fail("E_DAY_CLOSED");
  if (Number(await ctx.val("SELECT COUNT(*) FROM orders WHERE cafe_id = ? AND status = 'open'", [cafe])) > 0) {
    fail("E_DAY_OPEN_ORDERS");
  }

  const summary = await windowSummary(ctx, cafe, new Date(day.opened_at), ctx.now);
  const expected = day.opening_cash === null ? null : fromCents(cents(Number(day.opening_cash)) + cents(summary.cash));
  const card = summary.card;
  const diff = (x: number | null, y: number | null) => (x === null || y === null ? null : fromCents(cents(x) - cents(y)));

  await ctx.run(
    `UPDATE cafe_days SET closed_at = ?, closed_by = ?, expected_cash = ?, counted_cash = ?, cash_difference = ?,
       card_expected = ?, pos_total = ?, card_difference = ?, summary = ?, note = ? WHERE id = ?`,
    [
      ctx.now, ctx.uid, expected, counted, diff(counted, expected), card, pos, diff(pos, card),
      JSON.stringify(summary), cleanText(a.p_note ?? "", 200), day.id,
    ],
  );
  const updated = await ctx.one("SELECT * FROM cafe_days WHERE id = ?", [day.id]);
  return {
    day: await dayJson(ctx, updated, true),
    difference: updated?.cash_difference === null ? null : Number(updated?.cash_difference),
    card_difference: updated?.card_difference === null ? null : Number(updated?.card_difference),
  };
}
