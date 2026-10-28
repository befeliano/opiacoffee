// Masa ve bölge yönetimi (tables_*) fonksiyonları.

import type { Ctx, Row } from "./db";
import { bit, bool, cleanText, fail, field, int, newId, obj, requirePerm, uuid, uuidOrNull } from "./helpers";

export async function tables_admin_data(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requirePerm(ctx, cafe, "menu");
  const areas = await ctx.all("SELECT id, name, sort_order FROM areas WHERE cafe_id = ? ORDER BY sort_order, name", [cafe]);
  const tables = await ctx.all(
    `SELECT t.*, EXISTS (SELECT 1 FROM orders o WHERE o.table_id = t.id AND o.status = 'open') AS has_open_order
     FROM dining_tables t WHERE t.cafe_id = ? ORDER BY t.sort_order, t.name`,
    [cafe],
  );
  return {
    areas: areas.map((r) => ({ id: r.id, name: r.name, sort_order: r.sort_order })),
    tables: tables.map((t) => ({
      id: t.id,
      name: t.name,
      area_id: t.area_id,
      is_takeaway: bit(t.is_takeaway),
      is_active: bit(t.is_active),
      sort_order: t.sort_order,
      has_open_order: bit(t.has_open_order),
    })),
  };
}

export async function tables_save_area(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const area = obj(a.p_area) ?? {};
  let id = uuidOrNull(field(area, "id"));
  const name = cleanText(field(area, "name"), 40);
  await requirePerm(ctx, cafe, "menu");
  if (name === "") fail("E_NAME_REQUIRED");

  if (!id) {
    id = newId();
    await ctx.run(
      `INSERT INTO areas (id, cafe_id, name, sort_order, created_at)
       SELECT ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM areas WHERE cafe_id = ?), 0), ?`,
      [id, cafe, name, cafe, ctx.now],
    );
  } else {
    const exists = await ctx.val("SELECT 1 FROM areas WHERE id = ? AND cafe_id = ?", [id, cafe]);
    if (!exists) fail("E_NOT_FOUND");
    await ctx.run("UPDATE areas SET name = ? WHERE id = ?", [name, id]);
  }
  return { id };
}

async function checkArea(ctx: Ctx, cafe: string, area: string | null) {
  // Postgres'te (cafe_id, area_id) bileşik anahtarı başka kafenin bölgesini reddeder
  if (area && !(await ctx.val("SELECT 1 FROM areas WHERE id = ? AND cafe_id = ?", [area, cafe]))) fail("E_INVALID_REFERENCE");
}

export async function tables_save_table(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const t = obj(a.p_table) ?? {};
  let id = uuidOrNull(field(t, "id"));
  const name = cleanText(field(t, "name"), 24);
  const area = uuidOrNull(field(t, "area_id"));
  const takeaway = bool(field(t, "is_takeaway")) ?? false;
  const active = bool(field(t, "is_active")) ?? true;
  await requirePerm(ctx, cafe, "menu");
  if (name === "") fail("E_NAME_REQUIRED");
  await checkArea(ctx, cafe, area);

  if (!id) {
    id = newId();
    await ctx.run(
      `INSERT INTO dining_tables (id, cafe_id, area_id, name, is_takeaway, is_active, sort_order, created_at)
       SELECT ?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM dining_tables WHERE cafe_id = ?), 0), ?`,
      [id, cafe, area, name, takeaway ? 1 : 0, active ? 1 : 0, cafe, ctx.now],
    );
  } else {
    if (!active && (await ctx.val("SELECT 1 FROM orders WHERE table_id = ? AND status = 'open' LIMIT 1", [id]))) {
      fail("E_TABLE_HAS_OPEN_ORDER");
    }
    const exists = await ctx.val("SELECT 1 FROM dining_tables WHERE id = ? AND cafe_id = ?", [id, cafe]);
    if (!exists) fail("E_NOT_FOUND");
    await ctx.run("UPDATE dining_tables SET area_id = ?, name = ?, is_takeaway = ?, is_active = ? WHERE id = ?", [
      area,
      name,
      takeaway ? 1 : 0,
      active ? 1 : 0,
      id,
    ]);
    // Açık adisyondaki masa adı kopyasını da güncelle
    await ctx.run("UPDATE orders SET table_name = ?, is_takeaway = ?, updated_at = ? WHERE table_id = ? AND status = 'open'", [
      name,
      takeaway ? 1 : 0,
      ctx.now,
      id,
    ]);
  }
  return { id };
}

export async function tables_bulk_create(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const area = uuidOrNull(a.p_area);
  const prefix = cleanText(a.p_prefix, 12);
  const from = int(a.p_from);
  const to = int(a.p_to);
  await requirePerm(ctx, cafe, "menu");
  if (from === null || to === null || from < 0 || to < from || to - from >= 100 || to > 9999) fail("E_INVALID_RANGE");
  if (area && !(await ctx.val("SELECT 1 FROM areas WHERE id = ? AND cafe_id = ?", [area, cafe]))) fail("E_NOT_FOUND");

  const start = Number((await ctx.val("SELECT COALESCE(MAX(sort_order) + 1, 0) FROM dining_tables WHERE cafe_id = ?", [cafe])) ?? 0);
  const existing = new Set(
    (await ctx.all("SELECT name FROM dining_tables WHERE cafe_id = ?", [cafe])).map((r) => r.name as string),
  );
  let created = 0;
  for (let n = from; n <= to; n++) {
    const name = prefix + String(n);
    if (existing.has(name)) continue;
    existing.add(name);
    await ctx.run("INSERT INTO dining_tables (id, cafe_id, area_id, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
      newId(),
      cafe,
      area,
      name,
      start + (n - from),
      ctx.now,
    ]);
    created++;
  }
  return { created };
}

export async function tables_delete_area(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const id = uuid(a.p_id);
  await requirePerm(ctx, cafe, "menu");
  const res = await ctx.run("DELETE FROM areas WHERE id = ? AND cafe_id = ?", [id, cafe]);
  if (res.affectedRows === 0) fail("E_NOT_FOUND");
  return null;
}

export async function tables_delete_table(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const id = uuid(a.p_id);
  await requirePerm(ctx, cafe, "menu");
  if (await ctx.val("SELECT 1 FROM orders WHERE table_id = ? AND status = 'open' LIMIT 1", [id])) fail("E_TABLE_HAS_OPEN_ORDER");
  const exists = await ctx.val("SELECT 1 FROM dining_tables WHERE id = ? AND cafe_id = ?", [id, cafe]);
  if (!exists) fail("E_NOT_FOUND");
  // Geçmiş adisyonlar masa adının kopyasıyla raporlarda kalır (bağ kodda koparılır, bkz. schema.ts)
  await ctx.run("UPDATE orders SET table_id = NULL WHERE table_id = ?", [id]);
  await ctx.run("DELETE FROM dining_tables WHERE id = ?", [id]);
  return null;
}
