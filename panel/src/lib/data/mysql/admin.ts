// Kurulum (admin_*, yalnızca servis rolü), giderler (finance_*) ve örnek veri (demo_*).

import type { Ctx, Row } from "./db";
import {
  bit,
  cleanText,
  fail,
  field,
  idsJson,
  newId,
  normalizeUuids,
  num,
  obj,
  requireRole,
  requireService,
  round,
  str,
  unitCostSql,
  uuid,
  uuidOrNull,
  validDate,
  groupBy,
} from "./helpers";

/** Çok satırlı INSERT (parçalara bölerek) */
export async function bulkInsert(ctx: Ctx, table: string, columns: string[], rows: unknown[][]) {
  const size = 500;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const marks = chunk.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
    await ctx.run(`INSERT INTO ${table} (${columns.join(",")}) VALUES ${marks}`, chunk.flat());
  }
}

const list = (payload: Row | null, key: string): Row[] => {
  const v = payload?.[key];
  if (v === null || v === undefined) return [];
  if (!Array.isArray(v)) fail("E_INVALID_INPUT");
  return v as Row[];
};

const ts = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) fail("E_INVALID_INPUT");
  return d;
};

const enumOf = <T extends string>(v: unknown, values: readonly T[], fallback?: T): T => {
  if ((v === null || v === undefined) && fallback !== undefined) return fallback;
  if (typeof v === "string" && (values as readonly string[]).includes(v)) return v as T;
  fail("E_INVALID_INPUT");
};

const b = (v: unknown, fallback = false) => (v === null || v === undefined ? fallback : v === true || v === "true");

/** private.ensure_joker: her kafede fiyatı satışta girilen bir "Joker" ürün bulunur */
export async function ensureJoker(ctx: Ctx, cafe: string) {
  if (await ctx.val("SELECT 1 FROM products WHERE cafe_id = ? AND is_open_price = 1 LIMIT 1", [cafe])) return;
  let category = await ctx.val<string>("SELECT id FROM categories WHERE cafe_id = ? AND name = 'Diğer' LIMIT 1", [cafe]);
  if (!category) {
    category = newId();
    await ctx.run("INSERT INTO categories (id, cafe_id, name, subtitle, sort_order, created_at) VALUES (?, ?, 'Diğer', 'Menü dışı', 1000, ?)", [
      category,
      cafe,
      ctx.now,
    ]);
  }
  await ctx.run(
    `INSERT INTO products (id, cafe_id, category_id, name, description, price, cost_mode, fixed_cost, tags, is_open_price, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, 'Joker', 'Menü dışı ürün · fiyatı satışta girilir', 0, 'fixed', 0, '[]', 1, 0, ?, ?)`,
    [newId(), cafe, category, ctx.now, ctx.now],
  );
}

export async function admin_cafe_by_slug(ctx: Ctx, a: Row) {
  requireService(ctx);
  return (await ctx.val<string>("SELECT id FROM cafes WHERE slug = ?", [str(a.p_slug)])) ?? null;
}

export async function admin_add_member(ctx: Ctx, a: Row) {
  requireService(ctx);
  await ctx.run(
    `INSERT INTO cafe_members (cafe_id, user_id, role, display_name, created_at, permissions) VALUES (?, ?, ?, ?, ?, '{}')
     ON DUPLICATE KEY UPDATE role = VALUES(role), display_name = VALUES(display_name)`,
    [uuid(a.p_cafe), uuid(a.p_user), enumOf(a.p_role, ["owner", "manager", "staff"] as const), cleanText(a.p_display_name, 60), ctx.now],
  );
  return null;
}

export async function admin_create_cafe(ctx: Ctx, a: Row) {
  requireService(ctx);
  const payload = obj(a.p_payload);
  const c = obj(payload?.cafe) ?? fail("E_INVALID_INPUT");
  const cafe = uuid(c.id);
  const owner = uuidOrNull(a.p_owner);

  await ctx.run(
    `INSERT INTO cafes (id, slug, name, timezone, card_commission_rate, open_hour, close_hour, theme, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cafe,
      str(c.slug),
      str(c.name),
      str(c.timezone) ?? "Europe/Istanbul",
      num(c.card_commission_rate) ?? 0.03,
      num(c.open_hour) ?? 10,
      num(c.close_hour) ?? 24,
      str(c.theme) ?? "coffee",
      ctx.now,
    ],
  );
  // Postgres'te kafe eklenince tetikleyici çalışır (cafes_after_insert)
  await ensureJoker(ctx, cafe);

  if (owner) {
    await ctx.run(
      `INSERT INTO cafe_members (cafe_id, user_id, role, display_name, created_at, permissions) VALUES (?, ?, 'owner', ?, ?, '{}')
       ON DUPLICATE KEY UPDATE role = 'owner'`,
      [cafe, owner, cleanText(a.p_owner_name, 60), ctx.now],
    );
  }

  await bulkInsert(
    ctx,
    "areas",
    ["id", "cafe_id", "name", "sort_order", "created_at"],
    list(payload, "areas").map((x) => [uuid(x.id), cafe, x.name, x.sort_order ?? 0, ctx.now]),
  );
  await bulkInsert(
    ctx,
    "dining_tables",
    ["id", "cafe_id", "area_id", "name", "is_takeaway", "sort_order", "created_at"],
    list(payload, "tables").map((x) => [uuid(x.id), cafe, uuidOrNull(x.area_id), x.name, b(x.is_takeaway) ? 1 : 0, x.sort_order ?? 0, ctx.now]),
  );
  await bulkInsert(
    ctx,
    "categories",
    ["id", "cafe_id", "name", "subtitle", "sort_order", "created_at"],
    list(payload, "categories").map((x) => [uuid(x.id), cafe, x.name, x.subtitle ?? "", x.sort_order ?? 0, ctx.now]),
  );
  await bulkInsert(
    ctx,
    "ingredients",
    ["id", "cafe_id", "name", "unit", "package_size", "package_price", "created_at", "updated_at"],
    list(payload, "ingredients").map((x) => [
      uuid(x.id), cafe, x.name, enumOf(x.unit, ["g", "ml", "adet"] as const), num(x.package_size), num(x.package_price) ?? 0, ctx.now, ctx.now,
    ]),
  );
  await bulkInsert(
    ctx,
    "option_groups",
    ["id", "cafe_id", "name", "selection", "is_required", "sort_order", "created_at"],
    list(payload, "groups").map((x) => [
      uuid(x.id), cafe, x.name, enumOf(x.selection, ["single", "multi"] as const), b(x.is_required) ? 1 : 0, x.sort_order ?? 0, ctx.now,
    ]),
  );
  await bulkInsert(
    ctx,
    "options",
    ["id", "cafe_id", "group_id", "name", "price_delta", "cost_mode", "fixed_cost", "is_default", "sort_order", "created_at"],
    list(payload, "options").map((x) => [
      uuid(x.id), cafe, uuid(x.group_id), x.name, num(x.price_delta) ?? 0, enumOf(x.cost_mode, ["recipe", "fixed"] as const, "fixed"),
      num(x.fixed_cost) ?? 0, b(x.is_default) ? 1 : 0, x.sort_order ?? 0, ctx.now,
    ]),
  );
  await bulkInsert(
    ctx,
    "products",
    ["id", "cafe_id", "category_id", "name", "description", "price", "cost_mode", "fixed_cost", "tags", "sort_order", "favorite_rank", "created_at", "updated_at"],
    list(payload, "products").map((x) => [
      uuid(x.id), cafe, uuidOrNull(x.category_id), x.name, x.description ?? "", num(x.price),
      enumOf(x.cost_mode, ["recipe", "fixed"] as const, "recipe"), num(x.fixed_cost) ?? 0,
      JSON.stringify(Array.isArray(x.tags) ? x.tags : []), x.sort_order ?? 0, x.favorite_rank ?? null, ctx.now, ctx.now,
    ]),
  );
  await bulkInsert(
    ctx,
    "product_option_groups",
    ["cafe_id", "product_id", "group_id", "sort_order"],
    list(payload, "product_groups").map((x) => [cafe, uuid(x.product_id), uuid(x.group_id), x.sort_order ?? 0]),
  );
  await bulkInsert(
    ctx,
    "recipe_items",
    ["id", "cafe_id", "product_id", "option_id", "ingredient_id", "quantity"],
    list(payload, "recipes").map((x) => [newId(), cafe, uuidOrNull(x.product_id), uuidOrNull(x.option_id), uuid(x.ingredient_id), num(x.quantity)]),
  );
  return { cafe_id: cafe };
}

export async function admin_import_orders(ctx: Ctx, a: Row) {
  requireService(ctx);
  const cafe = uuid(a.p_cafe);
  const payload = obj(a.p_payload);
  const orders = list(payload, "orders");
  await bulkInsert(
    ctx,
    "orders",
    ["id", "cafe_id", "table_id", "table_name", "is_takeaway", "status", "note", "discount_amount", "cancel_reason", "opened_at", "closed_at", "updated_at", "is_demo", "guests"],
    orders.map((x) => {
      const opened = ts(x.opened_at);
      const closed = ts(x.closed_at);
      return [
        uuid(x.id), cafe, uuidOrNull(x.table_id), x.table_name, b(x.is_takeaway) ? 1 : 0,
        enumOf(x.status, ["open", "paid", "cancelled"] as const), x.note ?? "", num(x.discount_amount) ?? 0, x.cancel_reason ?? "",
        opened, closed, closed ?? opened, b(x.is_demo) ? 1 : 0, x.guests ?? null,
      ];
    }),
  );
  await bulkInsert(
    ctx,
    "order_items",
    ["id", "cafe_id", "order_id", "product_id", "product_name", "category_name", "option_ids", "options_label", "quantity", "unit_price", "unit_cost", "is_comp", "note", "created_at"],
    list(payload, "items").map((x) => [
      uuid(x.id), cafe, uuid(x.order_id), uuidOrNull(x.product_id), x.product_name, x.category_name ?? "",
      idsJson(normalizeUuids(Array.isArray(x.option_ids) ? x.option_ids.map(uuid) : [])), x.options_label ?? "",
      x.quantity, num(x.unit_price), num(x.unit_cost) ?? 0, b(x.is_comp) ? 1 : 0, x.note ?? "", ts(x.created_at) ?? ctx.now,
    ]),
  );
  // KDV (Postgres'te payments_vat tetikleyicisi) kafe oranından hesaplanır
  const vat = Number((await ctx.val("SELECT vat_rate FROM cafes WHERE id = ?", [cafe])) ?? 0);
  await bulkInsert(
    ctx,
    "payments",
    ["id", "cafe_id", "order_id", "method", "amount", "commission_rate", "commission_amount", "created_at", "vat_rate", "vat_amount"],
    list(payload, "payments").map((x) => {
      const amount = num(x.amount) ?? 0;
      return [
        uuid(x.id), cafe, uuid(x.order_id), enumOf(x.method, ["cash", "card", "ticket"] as const), amount,
        num(x.commission_rate) ?? 0, num(x.commission_amount) ?? 0, ts(x.created_at) ?? ctx.now, vat, round((amount * vat) / (1 + vat), 2),
      ];
    }),
  );
  return { orders: orders.length };
}

export async function admin_import_expenses(ctx: Ctx, a: Row) {
  requireService(ctx);
  const cafe = uuid(a.p_cafe);
  const rows = list(obj(a.p_payload), "expenses");
  await bulkInsert(
    ctx,
    "expenses",
    ["id", "cafe_id", "kind", "category", "name", "amount", "starts_on", "ends_on", "note", "is_demo", "created_at", "updated_at"],
    rows.map((x) => [
      newId(), cafe, enumOf(x.kind, ["monthly", "one_time"] as const), x.category, x.name, num(x.amount),
      validDate(x.starts_on), validDate(x.ends_on), x.note ?? "", 1, ctx.now, ctx.now,
    ]),
  );
  return { expenses: rows.length };
}

export async function admin_apply_prices(ctx: Ctx, a: Row) {
  requireService(ctx);
  const cafe = uuid(a.p_cafe);
  const payload = obj(a.p_payload);
  let ingredients = 0;
  for (const x of list(payload, "ingredients")) {
    const res = await ctx.run("UPDATE ingredients SET package_price = ?, updated_at = ? WHERE cafe_id = ? AND name = ?", [
      num(x.package_price), ctx.now, cafe, x.name,
    ]);
    ingredients += res.affectedRows;
  }
  let products = 0;
  for (const x of list(payload, "products")) {
    const res = await ctx.run("UPDATE products SET fixed_cost = ?, cost_mode = 'fixed', updated_at = ? WHERE cafe_id = ? AND name = ?", [
      num(x.fixed_cost), ctx.now, cafe, x.name,
    ]);
    products += res.affectedRows;
  }
  return { ingredients, products };
}

export async function admin_cafe_seed_ids(ctx: Ctx, a: Row) {
  requireService(ctx);
  const cafe = uuid(a.p_cafe);
  const demoOrders = await ctx.val("SELECT COUNT(*) FROM orders WHERE cafe_id = ? AND is_demo = 1", [cafe]);
  const tables = await ctx.all("SELECT id, name, is_takeaway FROM dining_tables WHERE cafe_id = ? AND is_active = 1 ORDER BY sort_order", [cafe]);
  const products = await ctx.all(
    `SELECT p.id, p.name, COALESCE(c.name, '') AS category, p.price, ${unitCostSql("p", "product_id")} AS unit_cost
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.cafe_id = ? AND p.is_active = 1 ORDER BY p.sort_order`,
    [cafe],
  );
  const links = groupBy(
    await ctx.all("SELECT product_id, group_id FROM product_option_groups WHERE cafe_id = ? ORDER BY sort_order", [cafe]),
    "product_id",
  );
  const groups = await ctx.all("SELECT * FROM option_groups WHERE cafe_id = ? ORDER BY sort_order", [cafe]);
  const options = groupBy(
    await ctx.all(
      `SELECT o.*, ${unitCostSql("o", "option_id")} AS unit_cost FROM options o WHERE o.cafe_id = ? AND o.is_active = 1 ORDER BY o.sort_order`,
      [cafe],
    ),
    "group_id",
  );
  return {
    cafeId: cafe,
    demoOrders: Number(demoOrders ?? 0),
    tables: tables.map((t) => ({ id: t.id, name: t.name, isTakeaway: bit(t.is_takeaway) })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: Number(p.price),
      unitCost: round(Number(p.unit_cost ?? 0), 4),
      weight: 1,
      groupIds: (links.get(p.id) ?? []).map((l) => l.group_id),
    })),
    groups: groups.map((g) => ({
      id: g.id,
      key: g.name,
      selection: g.selection,
      isRequired: bit(g.is_required),
      options: (options.get(g.id) ?? []).map((o) => ({
        id: o.id,
        name: o.name,
        priceDelta: Number(o.price_delta),
        isDefault: bit(o.is_default),
        unitCost: round(Number(o.unit_cost ?? 0), 4),
        share: 0,
      })),
    })),
  };
}

// ---------------------------------------------------------------------
// Giderler
// ---------------------------------------------------------------------
const EXPENSE_CATEGORIES = ["kira", "fatura", "personel", "banka", "vergi", "ekipman", "pazarlama", "diger"];

export async function finance_expenses(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "owner");
  const rows = await ctx.all("SELECT * FROM expenses WHERE cafe_id = ? ORDER BY kind, category, name", [cafe]);
  return rows.map((e) => ({
    id: e.id,
    kind: e.kind,
    category: e.category,
    name: e.name,
    amount: Number(e.amount),
    starts_on: e.starts_on,
    ends_on: e.ends_on,
    note: e.note,
  }));
}

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function monthEnd(date: string) {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export async function finance_save_expense(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const e = obj(a.p_expense) ?? {};
  let id = uuidOrNull(field(e, "id"));
  const kind = enumOf(field(e, "kind") || "monthly", ["monthly", "one_time"] as const);
  const name = cleanText(field(e, "name"), 60);
  const rawAmount = num(field(e, "amount"));
  const amount = rawAmount === null ? null : round(rawAmount, 2);
  let starts = validDate(field(e, "starts_on"));
  let ends = validDate(field(e, "ends_on") || null);
  const category = field(e, "category") || "diger";
  const note = cleanText(field(e, "note"), 200);

  await requireRole(ctx, cafe, "owner");
  if (name === "") fail("E_NAME_REQUIRED");
  if (amount === null || amount < 0 || starts === null) fail("E_INVALID_INPUT");
  if (!EXPENSE_CATEGORIES.includes(category) || amount >= 100000000) fail("E_INVALID_INPUT");
  if (kind === "monthly") {
    // Aylık giderler ay başından ay sonuna geçerlidir
    starts = monthStart(starts);
    if (ends !== null) ends = monthEnd(ends);
    if (ends !== null && ends < starts) fail("E_INVALID_INPUT");
  } else {
    ends = null;
  }

  if (!id) {
    id = newId();
    await ctx.run(
      `INSERT INTO expenses (id, cafe_id, kind, category, name, amount, starts_on, ends_on, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, cafe, kind, category, name, amount, starts, ends, note, ctx.now, ctx.now],
    );
  } else {
    const exists = await ctx.val("SELECT 1 FROM expenses WHERE id = ? AND cafe_id = ?", [id, cafe]);
    if (!exists) fail("E_NOT_FOUND");
    await ctx.run(
      `UPDATE expenses SET kind = ?, category = ?, name = ?, amount = ?, starts_on = ?, ends_on = ?, note = ?, updated_at = ?
       WHERE id = ?`,
      [kind, category, name, amount, starts, ends, note, ctx.now, id],
    );
  }
  return { id };
}

export async function finance_delete_expense(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const id = uuid(a.p_id);
  await requireRole(ctx, cafe, "owner");
  const res = await ctx.run("DELETE FROM expenses WHERE id = ? AND cafe_id = ?", [id, cafe]);
  if (res.affectedRows === 0) fail("E_NOT_FOUND");
  return null;
}

// ---------------------------------------------------------------------
// Örnek veri
// ---------------------------------------------------------------------
export async function demo_status(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "owner");
  const row = await ctx.one(
    `SELECT (SELECT COUNT(*) FROM orders WHERE cafe_id = ? AND is_demo = 1) AS orders,
       (SELECT COUNT(*) FROM expenses WHERE cafe_id = ? AND is_demo = 1) AS expenses,
       (SELECT COUNT(*) FROM orders WHERE cafe_id = ? AND is_demo = 0) AS real_orders`,
    [cafe, cafe, cafe],
  );
  return { orders: Number(row?.orders ?? 0), expenses: Number(row?.expenses ?? 0), real_orders: Number(row?.real_orders ?? 0) };
}

export async function demo_purge(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "owner");
  const orders = await ctx.run("DELETE FROM orders WHERE cafe_id = ? AND is_demo = 1", [cafe]);
  const expenses = await ctx.run("DELETE FROM expenses WHERE cafe_id = ? AND is_demo = 1", [cafe]);
  return { orders: orders.affectedRows, expenses: expenses.affectedRows };
}
