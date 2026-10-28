// Postgres'teki private.* yardımcı fonksiyonlarının TypeScript karşılıkları.
// Para hesapları ya SQL'de (DECIMAL, kesin) ya da kuruş cinsinden tam sayıyla yapılır.

import { randomUUID } from "node:crypto";
import type { Ctx, Row } from "./db";

// ---------------------------------------------------------------------
// Hata ve doğrulama
// ---------------------------------------------------------------------
export function fail(code: string): never {
  throw new Error(code);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const newId = () => randomUUID();

/** uuid parametresi (Postgres'te geçersiz uuid 22P02 → E_INVALID_INPUT) */
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) fail("E_INVALID_INPUT");
  return value.toLowerCase();
}

export function uuidOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return uuid(value);
}

export function uuidList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) fail("E_INVALID_INPUT");
  return value.map(uuid);
}

/** private.normalize_uuids: tekil ve sıralı */
export function normalizeUuids(ids: string[]): string[] {
  return [...new Set(ids.map((x) => x.toLowerCase()))].sort();
}

/** Sayı parametresi; boşsa null. Sayı değilse E_INVALID_INPUT */
export function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) fail("E_INVALID_INPUT");
  return n;
}

export function int(value: unknown): number | null {
  const n = num(value);
  if (n === null) return null;
  if (!Number.isInteger(n)) fail("E_INVALID_INPUT");
  return n;
}

export function bool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "t" || value === 1 || value === "1") return true;
  if (value === "false" || value === "f" || value === 0 || value === "0") return false;
  fail("E_INVALID_INPUT");
}

export function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  fail("E_INVALID_INPUT");
}

/** jsonb parametresi: nesne ya da JSON metni */
export function obj(value: unknown): Row | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return obj(JSON.parse(value));
    } catch {
      fail("E_INVALID_INPUT");
    }
  }
  if (typeof value !== "object") fail("E_INVALID_INPUT");
  return value as Row;
}

/** jsonb içinden alan okur (->>): metne çevirir, yoksa null */
export function field(o: Row | null | undefined, key: string): string | null {
  if (!o || !(key in o)) return null;
  const v = o[key];
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** private.clean_text: kontrol karakterlerini ve fazla boşlukları temizler, kırpar */
export function cleanText(value: unknown, max: number): string {
  const text = (value === null || value === undefined ? "" : String(value))
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...text].slice(0, max).join("");
}

export function left(text: string, max: number): string {
  return [...text].slice(0, max).join("");
}

// ---------------------------------------------------------------------
// Sayısal yardımcılar (Postgres round: yarımı sıfırdan uzağa yuvarlar)
// ---------------------------------------------------------------------
export function round(value: number, digits = 0): number {
  const sign = value < 0 ? -1 : 1;
  const shifted = Number(`${Math.abs(value)}e${digits}`);
  return (sign * Math.round(shifted)) / 10 ** digits || 0;
}

export function roundOrNull(value: number | null, digits = 0): number | null {
  return value === null ? null : round(value, digits);
}

/** Kuruşa çevirir (2 basamaklı tutarlar için kesin) */
export const cents = (value: number) => Math.round(Number(`${value}e2`));
export const fromCents = (value: number) => value / 100;

/** Tam sayı bölmesi, yarımı sıfırdan uzağa yuvarlar */
export function divRound(n: number, d: number): number {
  const sign = (n < 0) !== (d < 0) ? -1 : 1;
  const a = Math.abs(n);
  const b = Math.abs(d);
  return sign * Math.floor((2 * a + b) / (2 * b));
}

export const bit = (v: unknown) => v === 1 || v === true || v === "1";

// ---------------------------------------------------------------------
// Zaman: iş günü sabah 05:00'te döner (private.day_cutoff)
// ---------------------------------------------------------------------
export const DAY_CUTOFF_HOURS = 5;
export const ROUND_GAP_MS = 5 * 60 * 1000;

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function wallParts(date: Date, tz: string) {
  let fmt = dtfCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(tz, fmt);
  }
  const p: Record<string, number> = {};
  for (const part of fmt.formatToParts(date)) if (part.type !== "literal") p[part.type] = Number(part.value);
  return p;
}

/** Saat diliminin o andaki farkı (ms) */
function tzOffset(date: Date, tz: string): number {
  const p = wallParts(date, tz);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(date.getTime() / 1000) * 1000;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Yerel duvar saati (tarih + saat) → UTC an ((date + h)::timestamp at time zone tz) */
export function localToUtc(date: string, hours: number, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hours);
  let result = guess - tzOffset(new Date(guess), tz);
  result = guess - tzOffset(new Date(result), tz);
  return new Date(result);
}

export function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return isoDate(Date.UTC(y, m - 1, d + days));
}

/** Yerel duvar saati, "YYYY-MM-DD" ve saat */
export function localDate(ts: Date, tz: string): string {
  const p = wallParts(ts, tz);
  return isoDate(Date.UTC(p.year, p.month - 1, p.day));
}

/** private.biz_date: yerel saat − 5 saat */
export function bizDate(ts: Date, tz: string): string {
  const p = wallParts(ts, tz);
  return isoDate(Date.UTC(p.year, p.month - 1, p.day, p.hour - DAY_CUTOFF_HOURS, p.minute, p.second));
}

/** İş gününün UTC aralığı [başlangıç, bitiş) */
export function bizRange(date: string, tz: string): [Date, Date] {
  return [localToUtc(date, DAY_CUTOFF_HOURS, tz), localToUtc(addDays(date, 1), DAY_CUTOFF_HOURS, tz)];
}

export function validDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("E_INVALID_INPUT");
  const [y, m, d] = value.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) fail("E_INVALID_INPUT");
  return value;
}

/** Tarihler arası gün farkı (b − a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

export function parseJson<T>(text: unknown, fallback: T): T {
  if (text === null || text === undefined) return fallback;
  if (typeof text !== "string") return text as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------
// Yetki
// ---------------------------------------------------------------------
export type MemberRole = "owner" | "manager" | "staff";
export const roleRank = (role: string) => (role === "owner" ? 3 : role === "manager" ? 2 : 1);

const PERM_KEYS = ["figures", "profit", "reports", "void", "payments", "discounts", "menu"];

export function permDefaults(role: string): Row {
  return role === "staff"
    ? { figures: "two_days", profit: false, reports: false, void: true, payments: true, discounts: true, menu: false }
    : { figures: "all", profit: true, reports: true, void: true, payments: true, discounts: true, menu: true };
}

/** private.member_perms */
export function memberPerms(role: string, custom: unknown): Row {
  if (role === "owner") return permDefaults("owner");
  const result = permDefaults(role);
  const extra = parseJson<Row>(custom, {});
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    for (const key of Object.keys(extra).sort()) if (PERM_KEYS.includes(key)) result[key] = extra[key];
  }
  return result;
}

export function requireAuth(ctx: Ctx): string {
  if (!ctx.uid) fail("E_NOT_AUTHENTICATED");
  return ctx.uid;
}

async function member(ctx: Ctx, cafe: string) {
  if (!ctx.uid) return null;
  return ctx.one<{ role: MemberRole; permissions: string }>(
    "SELECT role, permissions FROM cafe_members WHERE cafe_id = ? AND user_id = ?",
    [cafe, ctx.uid],
  );
}

/** private.require_role: rolü döndürür */
export async function requireRole(ctx: Ctx, cafe: string, min: MemberRole): Promise<MemberRole> {
  requireAuth(ctx);
  const m = await member(ctx, cafe);
  if (!m || roleRank(m.role) < roleRank(min)) fail("E_FORBIDDEN");
  return m.role;
}

export async function myPerms(ctx: Ctx, cafe: string): Promise<Row | null> {
  const m = await member(ctx, cafe);
  return m ? memberPerms(m.role, m.permissions) : null;
}

/** private.can: izin değeri tam olarak true mu */
export async function can(ctx: Ctx, cafe: string, key: string): Promise<boolean> {
  const perms = await myPerms(ctx, cafe);
  return perms ? field(perms, key) === "true" : false;
}

export async function figuresScope(ctx: Ctx, cafe: string): Promise<string> {
  const perms = await myPerms(ctx, cafe);
  return (perms && field(perms, "figures")) ?? "none";
}

export async function requirePerm(ctx: Ctx, cafe: string, key: string) {
  await requireRole(ctx, cafe, "staff");
  if (!(await can(ctx, cafe, key))) fail("E_FORBIDDEN");
}

export function requireService(ctx: Ctx) {
  if (ctx.role !== "service_role") fail("E_FORBIDDEN");
}

export async function assertOwnerRemains(ctx: Ctx, cafe: string, user: string) {
  const other = await ctx.val(
    "SELECT 1 FROM cafe_members WHERE cafe_id = ? AND role = 'owner' AND user_id <> ? LIMIT 1",
    [cafe, user],
  );
  if (!other) fail("E_LAST_OWNER");
}

export async function cafeTimezone(ctx: Ctx, cafe: string): Promise<string> {
  return (await ctx.val<string>("SELECT timezone FROM cafes WHERE id = ?", [cafe])) ?? "Europe/Istanbul";
}

/** private.require_open_day: kasa sayımı açıksa gün açılmış olmalı */
export async function requireOpenDay(ctx: Ctx, cafe: string) {
  const row = await ctx.one(
    `SELECT c.cash_count,
       EXISTS (SELECT 1 FROM cafe_days d WHERE d.cafe_id = c.id AND d.closed_at IS NULL) AS has_open
     FROM cafes c WHERE c.id = ?`,
    [cafe],
  );
  if (row && bit(row.cash_count) && !bit(row.has_open)) fail("E_DAY_CLOSED");
}

// ---------------------------------------------------------------------
// Maliyet
// ---------------------------------------------------------------------
/** Reçeteli maliyet ifadesi (alias: ürün ya da seçenek tablosu, kolon: product_id/option_id) */
export function unitCostSql(alias: string, column: "product_id" | "option_id") {
  return `CASE WHEN ${alias}.cost_mode = 'fixed' THEN ${alias}.fixed_cost ELSE COALESCE((
    SELECT SUM(ri.quantity * ing.package_price / ing.package_size)
    FROM recipe_items ri JOIN ingredients ing ON ing.id = ri.ingredient_id
    WHERE ri.${column} = ${alias}.id), 0) END`;
}

// ---------------------------------------------------------------------
// Adisyon toplamları (private.order_totals)
// ---------------------------------------------------------------------
export interface Totals {
  subtotal: number;
  comp_total: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
  items: number;
  cost: number;
}

/** Siparişler için toplam satırları üreten sorgu; filter "o" takma adıyla yazılır */
export function totalsSql(filter: string, extraColumns = "") {
  return `SELECT t.*,
      LEAST(t.discount_amount, t.subtotal) AS discount,
      t.subtotal - LEAST(t.discount_amount, t.subtotal) AS total,
      GREATEST(t.subtotal - LEAST(t.discount_amount, t.subtotal) - t.paid, 0) AS remaining
    FROM (
      SELECT o.id, o.discount_amount${extraColumns},
        (SELECT COALESCE(SUM(CASE WHEN i.is_comp = 0 THEN i.quantity * i.unit_price ELSE 0 END), 0) FROM order_items i WHERE i.order_id = o.id) AS subtotal,
        (SELECT COALESCE(SUM(CASE WHEN i.is_comp = 1 THEN i.quantity * i.unit_price ELSE 0 END), 0) FROM order_items i WHERE i.order_id = o.id) AS comp_total,
        (SELECT COALESCE(SUM(i.quantity), 0) FROM order_items i WHERE i.order_id = o.id) AS items,
        (SELECT COALESCE(SUM(i.quantity * i.unit_cost), 0) FROM order_items i WHERE i.order_id = o.id) AS cost,
        (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.order_id = o.id) AS paid
      FROM orders o
      WHERE ${filter}
    ) t`;
}

export async function orderTotals(ctx: Ctx, order: string): Promise<Totals> {
  const row = await ctx.one(totalsSql("o.id = ?"), [order]);
  if (!row) return { subtotal: 0, comp_total: 0, discount: 0, total: 0, paid: 0, remaining: 0, items: 0, cost: 0 };
  return totalsOf(row);
}

export function totalsOf(row: Row): Totals {
  return {
    subtotal: Number(row.subtotal),
    comp_total: Number(row.comp_total),
    discount: Number(row.discount),
    total: Number(row.total),
    paid: Number(row.paid),
    remaining: Number(row.remaining),
    items: Number(row.items),
    cost: Number(row.cost),
  };
}

/** private.item_paid_qty */
export async function itemPaidQty(ctx: Ctx, item: string): Promise<number> {
  return Number((await ctx.val("SELECT COALESCE(SUM(quantity), 0) FROM payment_items WHERE item_id = ?", [item])) ?? 0);
}

/** private.sync_discount: adisyon indirimi = ek indirim + satır indirimleri */
export async function syncDiscount(ctx: Ctx, order: string) {
  await ctx.run(
    `UPDATE orders o SET discount_amount = o.extra_discount + COALESCE((
       SELECT SUM(i.quantity * i.unit_discount) FROM order_items i WHERE i.order_id = o.id AND i.is_comp = 0
     ), 0) WHERE o.id = ?`,
    [order],
  );
}

/** private.touch_order: boş açık adisyonu siler, değilse indirimi ve zamanı günceller */
export async function touchOrder(ctx: Ctx, order: string) {
  const res = await ctx.run(
    `DELETE FROM orders WHERE id = ? AND status = 'open'
       AND NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = ?)
       AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = ?)`,
    [order, order, order],
  );
  if (res.affectedRows === 0) {
    await syncDiscount(ctx, order);
    await ctx.run("UPDATE orders SET updated_at = ? WHERE id = ?", [ctx.now, order]);
  }
}

/** Ödeme ekler; komisyon ve KDV (private.method_rate + payments_vat) SQL'de hesaplanır */
export async function insertPayment(
  ctx: Ctx,
  p: { id?: string; cafe: string; order: string; method: string; amount: number; createdAt?: Date; createdBy?: string | null },
): Promise<string> {
  const id = p.id ?? newId();
  await ctx.run(
    `INSERT INTO payments (id, cafe_id, order_id, method, amount, commission_rate, commission_amount, created_at, created_by, vat_rate, vat_amount)
     SELECT ?, c.id, ?, ?, ?, r.rate, ROUND(? * r.rate, 2), ?, ?, c.vat_rate, ROUND(? * c.vat_rate / (1 + c.vat_rate), 2)
     FROM cafes c
     JOIN (SELECT id, CASE ? WHEN 'card' THEN card_commission_rate WHEN 'ticket' THEN ticket_commission_rate ELSE 0 END AS rate FROM cafes) r ON r.id = c.id
     WHERE c.id = ?`,
    [id, p.order, p.method, p.amount, p.amount, p.createdAt ?? ctx.now, p.createdBy ?? null, p.amount, p.method, p.cafe],
  );
  return id;
}

export function paymentMethod(value: unknown): "cash" | "card" | "ticket" {
  if (value === "cash" || value === "card" || value === "ticket") return value;
  fail("E_INVALID_INPUT");
}

// ---------------------------------------------------------------------
// private.order_json
// ---------------------------------------------------------------------
export async function orderJson(ctx: Ctx, order: string): Promise<Row | null> {
  return (await ordersJson(ctx, [order]))[0] ?? null;
}

/** Birden çok adisyonun JSON'u (verilen sırayla) */
export async function ordersJson(ctx: Ctx, ids: string[]): Promise<Row[]> {
  if (ids.length === 0) return [];
  const out: Row[] = [];
  for (let i = 0; i < ids.length; i += 500) out.push(...(await ordersJsonChunk(ctx, ids.slice(i, i + 500))));
  return out;
}

async function ordersJsonChunk(ctx: Ctx, ids: string[]): Promise<Row[]> {
  const marks = ids.map(() => "?").join(",");
  const orders = await ctx.all(
    totalsSql(
      `o.id IN (${marks})`,
      `, o.status, o.table_id, o.table_name, o.is_takeaway, o.opened_at, o.closed_at, o.note, o.guests, o.cancel_reason, o.extra_discount`,
    ),
    ids,
  );
  const items = await ctx.all(
    `SELECT i.*, (SELECT SUM(pi.quantity) FROM payment_items pi WHERE pi.item_id = i.id) AS paid_qty
     FROM order_items i WHERE i.order_id IN (${marks}) ORDER BY i.created_at, i.id`,
    ids,
  );
  const payments = await ctx.all(
    `SELECT p.* FROM payments p WHERE p.order_id IN (${marks}) ORDER BY p.created_at, p.id`,
    ids,
  );
  const lines = payments.length
    ? await ctx.all(
        `SELECT pi.payment_id, pi.quantity, i.split_parts, i.product_name
         FROM payment_items pi JOIN order_items i ON i.id = pi.item_id
         WHERE pi.payment_id IN (${payments.map(() => "?").join(",")})
         ORDER BY i.created_at`,
        payments.map((p) => p.id),
      )
    : [];

  const itemsBy = groupBy(items, "order_id");
  const paymentsBy = groupBy(payments, "order_id");
  const linesBy = groupBy(lines, "payment_id");
  const byId = new Map(orders.map((o) => [o.id, o]));

  return ids
    .map((id) => byId.get(id))
    .filter((o): o is Row => Boolean(o))
    .map((o) => {
      const t = totalsOf(o);
      return {
        id: o.id,
        status: o.status,
        table_id: o.table_id,
        table_name: o.table_name,
        is_takeaway: bit(o.is_takeaway),
        opened_at: iso(o.opened_at),
        closed_at: iso(o.closed_at),
        note: o.note,
        guests: o.guests,
        cancel_reason: o.cancel_reason,
        extra_discount: Number(o.extra_discount),
        discount: t.discount,
        subtotal: t.subtotal,
        comp_total: t.comp_total,
        total: t.total,
        paid: t.paid,
        remaining: t.remaining,
        items_count: t.items,
        items: (itemsBy.get(o.id) ?? []).map((i) => {
          const paid = Number(i.paid_qty ?? 0);
          return {
            id: i.id,
            product_id: i.product_id,
            name: i.product_name,
            options_label: i.options_label,
            option_ids: parseJson<string[]>(i.option_ids, []),
            quantity: i.quantity,
            unit_price: Number(i.unit_price),
            list_price: Number(i.list_price ?? i.unit_price),
            unit_discount: Number(i.unit_discount),
            split_parts: i.split_parts,
            paid_parts: paid,
            paid_quantity: Math.trunc(paid / i.split_parts),
            is_comp: bit(i.is_comp),
            note: i.note,
            created_at: iso(i.created_at),
          };
        }),
        payments: (paymentsBy.get(o.id) ?? []).map((p) => ({
          id: p.id,
          method: p.method,
          amount: Number(p.amount),
          commission: Number(p.commission_amount),
          created_at: iso(p.created_at),
          lines: (linesBy.get(p.id) ?? [])
            .map((l) => (l.split_parts > 1 ? `${l.quantity}/${l.split_parts} ` : `${l.quantity}× `) + l.product_name)
            .join(", "),
        })),
      };
    });
}

export function groupBy<T extends Row>(rows: T[], key: string): Map<unknown, T[]> {
  const map = new Map<unknown, T[]>();
  for (const row of rows) {
    const list = map.get(row[key]);
    if (list) list.push(row);
    else map.set(row[key], [row]);
  }
  return map;
}

// ---------------------------------------------------------------------
// private.resolve_line: ürün + seçenekler → satır fiyatı, maliyeti, etiketi
// ---------------------------------------------------------------------
export interface Line {
  product_id: string;
  product_name: string;
  category_name: string;
  option_ids: string[];
  options_label: string;
  unit_price: number;
  unit_cost: number;
}

export async function resolveLine(ctx: Ctx, cafe: string, product: string, optionIds: string[]): Promise<Line> {
  const p = await ctx.one(
    `SELECT p.id, p.name, p.price, ${unitCostSql("p", "product_id")} AS unit_cost,
       COALESCE((SELECT c.name FROM categories c WHERE c.id = p.category_id), '') AS category_name
     FROM products p WHERE p.id = ? AND p.cafe_id = ?`,
    [product, cafe],
  );
  if (!p) fail("E_PRODUCT_NOT_FOUND");
  const ids = normalizeUuids(optionIds);
  if (ids.length > 20) fail("E_INVALID_OPTIONS");

  let options: Row[] = [];
  if (ids.length) {
    options = await ctx.all(
      `SELECT o.id, o.name, o.price_delta, o.is_default, g.id AS group_id, g.selection, g.is_required,
         ${unitCostSql("o", "option_id")} AS unit_cost
       FROM options o
       JOIN option_groups g ON g.id = o.group_id
       JOIN product_option_groups pog ON pog.group_id = g.id AND pog.product_id = ?
       WHERE o.id IN (${ids.map(() => "?").join(",")}) AND o.cafe_id = ?
       ORDER BY pog.sort_order, g.sort_order, o.sort_order`,
      [p.id, ...ids, cafe],
    );
  }
  if (options.length !== ids.length) fail("E_INVALID_OPTIONS");

  const perGroup = new Map<string, number>();
  for (const o of options) {
    if (o.selection === "single") perGroup.set(o.group_id, (perGroup.get(o.group_id) ?? 0) + 1);
  }
  if ([...perGroup.values()].some((n) => n > 1)) fail("E_INVALID_OPTIONS");

  const missing = await ctx.val(
    `SELECT 1 FROM product_option_groups pog
     JOIN option_groups g ON g.id = pog.group_id
     WHERE pog.product_id = ? AND g.is_required = 1
       AND EXISTS (SELECT 1 FROM options o WHERE o.group_id = g.id AND o.is_active = 1)
       AND NOT EXISTS (SELECT 1 FROM options o WHERE o.group_id = g.id AND o.id IN (${ids.length ? ids.map(() => "?").join(",") : "NULL"}))
     LIMIT 1`,
    [p.id, ...ids],
  );
  if (missing) fail("E_OPTION_REQUIRED");

  const priceCents = cents(Number(p.price)) + options.reduce((s, o) => s + cents(Number(o.price_delta)), 0);
  const cost = Number(p.unit_cost ?? 0) + options.reduce((s, o) => s + Number(o.unit_cost ?? 0), 0);

  return {
    product_id: p.id,
    product_name: p.name,
    category_name: p.category_name,
    option_ids: ids,
    options_label: options
      .filter((o) => !bit(o.is_default) || bit(o.is_required))
      .map((o) => o.name)
      .join(" · "),
    unit_price: Math.max(fromCents(priceCents), 0),
    unit_cost: Math.max(round(cost, 4), 0),
  };
}

export const idsJson = (ids: string[]) => JSON.stringify(ids);

// ---------------------------------------------------------------------
// SQL içinde yerel saat: Hostinger'da saat dilimi tabloları (CONVERT_TZ) olmayabilir.
// Aralıktaki yaz saati geçişleri burada bulunur ve CASE ifadesine gömülür.
// ---------------------------------------------------------------------
const sqlStamp = (ms: number) => new Date(ms).toISOString().replace("T", " ").replace("Z", "");

/** Kolondaki UTC zaman için saat dilimi farkını (saniye) veren SQL ifadesi */
export function tzOffsetSql(column: string, tz: string, fromDate: string, toDate: string): string {
  const day = 86400000;
  const start = Date.parse(`${addDays(fromDate, -40)}T12:00:00Z`);
  const end = Date.parse(`${addDays(toDate, 2)}T12:00:00Z`);
  const off = (ms: number) => tzOffset(new Date(ms), tz) / 1000;
  const parts: string[] = [];
  let current = off(start);
  const first = current;
  for (let t = start; t < end; t += day) {
    const next = off(t + day);
    if (next === current) continue;
    // Geçiş anını dakikaya kadar daralt
    let lo = t;
    let hi = t + day;
    while (hi - lo > 60000) {
      const mid = lo + Math.floor((hi - lo) / 120000) * 60000;
      if (off(mid) === current) lo = mid;
      else hi = mid;
    }
    parts.push(`WHEN ${column} < '${sqlStamp(hi)}' THEN ${current}`);
    current = next;
  }
  if (!parts.length) return String(first);
  return `(CASE ${parts.join(" ")} ELSE ${current} END)`;
}

/** Yerel saat ifadesi */
export function localSql(column: string, offset: string) {
  return `(${column} + INTERVAL ${offset} SECOND)`;
}

/** private.biz_date karşılığı SQL ifadesi */
export function bizDateSql(column: string, offset: string) {
  return `DATE(${column} + INTERVAL (${offset} - ${DAY_CUTOFF_HOURS * 3600}) SECOND)`;
}
