// QR masa siparişinin personel tarafı (yalnızca MySQL sürümü): bar bildirimleri ve masa QR kodları.
// Misafir tarafı src/site/guest.ts içindedir.

import { randomBytes } from "node:crypto";
import type { Ctx, Row } from "./db";
import { bit, fail, iso, requirePerm, requireRole, uuid } from "./helpers";

// Yalnızca harf ve rakam (menu.js bu biçimi bekler)
const newToken = () => randomBytes(8).toString("hex");

/** Bar ekranı: açık QR siparişleri, garson çağrıları ve hesap istekleri (son 12 saat) */
export async function pos_guest_requests(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "staff");
  const rows = await ctx.all(
    `SELECT id, table_id, table_name, kind, summary, note, total, status, created_at FROM guest_requests
     WHERE cafe_id = ? AND status IN ('yeni', 'hazirlaniyor') AND created_at > ?
     ORDER BY created_at`,
    [cafe, new Date(ctx.now.getTime() - 12 * 3600_000)],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    table_id: r.table_id,
    table_name: r.table_name,
    kind: r.kind,
    summary: r.summary,
    note: r.note,
    total: Number(r.total),
    status: r.status,
    created_at: iso(r.created_at),
  }));
}

/** Bildirimi ilerletir: sipariş yeni → hazırlanıyor → teslim; çağrı ve hesap isteği doğrudan teslim (kapandı) */
export async function pos_guest_update(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "staff");
  const status = String(a.p_status ?? "");
  if (!["hazirlaniyor", "teslim", "iptal"].includes(status)) fail("E_INVALID_INPUT");
  const res = await ctx.run("UPDATE guest_requests SET status = ?, updated_at = ? WHERE id = ? AND cafe_id = ?", [
    status,
    ctx.now,
    Number(a.p_id),
    cafe,
  ]);
  if (res.affectedRows === 0) fail("E_NOT_FOUND");
  return pos_guest_requests(ctx, a);
}

/** Masa QR kodları (eksik kodlar üretilir) ve QR siparişin açık olup olmadığı */
export async function tables_qr(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requirePerm(ctx, cafe, "menu");
  const missing = await ctx.all("SELECT id FROM dining_tables WHERE cafe_id = ? AND qr_token IS NULL", [cafe]);
  for (const t of missing) await ctx.run("UPDATE dining_tables SET qr_token = ? WHERE id = ?", [newToken(), t.id]);
  const tables = await ctx.all(
    "SELECT id, name, qr_token, is_active, is_takeaway FROM dining_tables WHERE cafe_id = ? ORDER BY sort_order, name",
    [cafe],
  );
  const on = await ctx.val("SELECT qr_ordering FROM cafes WHERE id = ?", [cafe]);
  return {
    ordering: bit(on),
    tables: tables.map((t) => ({ id: t.id, name: t.name, token: t.qr_token, is_active: bit(t.is_active), is_takeaway: bit(t.is_takeaway) })),
  };
}

/** Masanın QR kodunu yeniler (eski basılı kod artık çalışmaz) */
export async function tables_qr_reset(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requirePerm(ctx, cafe, "menu");
  const res = await ctx.run("UPDATE dining_tables SET qr_token = ? WHERE id = ? AND cafe_id = ?", [newToken(), uuid(a.p_table), cafe]);
  if (res.affectedRows === 0) fail("E_NOT_FOUND");
  return tables_qr(ctx, a);
}

/** QR siparişi tüm masalarda açar/kapatır (kapalıyken QR düz menüyü açar) */
export async function cafe_set_qr_ordering(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requirePerm(ctx, cafe, "menu");
  await ctx.run("UPDATE cafes SET qr_ordering = ? WHERE id = ?", [a.p_on === true || a.p_on === "true" ? 1 : 0, cafe]);
  return tables_qr(ctx, a);
}
