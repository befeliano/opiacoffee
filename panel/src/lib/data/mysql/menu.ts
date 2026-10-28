// Menü yönetimi (menu_*) fonksiyonları.

import type { Ctx, Row } from "./db";
import {
  bit,
  bizRange,
  bool,
  cafeTimezone,
  cleanText,
  daysBetween,
  fail,
  field,
  groupBy,
  iso,
  num,
  obj,
  parseJson,
  requirePerm,
  round,
  unitCostSql,
  uuid,
  uuidList,
  uuidOrNull,
  validDate,
  newId,
  addDays,
} from "./helpers";

const TAGS = ["vegan", "milk", "gluten", "nuts", "egg"];

function costMode(value: string | null, fallback: "recipe" | "fixed") {
  const v = value || fallback;
  if (v !== "recipe" && v !== "fixed") fail("E_INVALID_INPUT");
  return v;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) fail("E_INVALID_INPUT");
  return value;
}

export async function menu_admin_data(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requirePerm(ctx, cafe, "menu");

  const categories = await ctx.all("SELECT * FROM categories WHERE cafe_id = ? ORDER BY sort_order, name", [cafe]);
  const products = await ctx.all(
    `SELECT p.*, ${unitCostSql("p", "product_id")} AS unit_cost FROM products p WHERE p.cafe_id = ? ORDER BY p.sort_order, p.name`,
    [cafe],
  );
  const recipes = await ctx.all(
    `SELECT ri.product_id, ri.option_id, ri.ingredient_id, ri.quantity FROM recipe_items ri
     JOIN ingredients i ON i.id = ri.ingredient_id WHERE ri.cafe_id = ? ORDER BY i.name`,
    [cafe],
  );
  const byProduct = groupBy(recipes.filter((r) => r.product_id), "product_id");
  const byOption = groupBy(recipes.filter((r) => r.option_id), "option_id");
  const recipe = (rows: Row[] | undefined) =>
    (rows ?? []).map((r) => ({ ingredient_id: r.ingredient_id, quantity: Number(r.quantity) }));
  const links = groupBy(
    await ctx.all("SELECT product_id, group_id FROM product_option_groups WHERE cafe_id = ? ORDER BY sort_order", [cafe]),
    "product_id",
  );
  const ingredients = await ctx.all(
    `SELECT i.*, ROUND(i.package_price / i.package_size, 6) AS unit_cost,
       (SELECT COUNT(*) FROM recipe_items ri WHERE ri.ingredient_id = i.id) AS usage_count
     FROM ingredients i WHERE i.cafe_id = ? ORDER BY i.name`,
    [cafe],
  );
  const groups = await ctx.all(
    `SELECT g.*, (SELECT COUNT(*) FROM product_option_groups pog WHERE pog.group_id = g.id) AS product_count
     FROM option_groups g WHERE g.cafe_id = ? ORDER BY g.sort_order, g.name`,
    [cafe],
  );
  const options = groupBy(
    await ctx.all(
      `SELECT o.*, ${unitCostSql("o", "option_id")} AS unit_cost FROM options o WHERE o.cafe_id = ? ORDER BY o.sort_order, o.name`,
      [cafe],
    ),
    "group_id",
  );

  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name, subtitle: c.subtitle, sort_order: c.sort_order })),
    products: products.map((p) => ({
      id: p.id,
      category_id: p.category_id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      cost_mode: p.cost_mode,
      fixed_cost: Number(p.fixed_cost),
      unit_cost: round(Number(p.unit_cost ?? 0), 4),
      tags: parseJson<string[]>(p.tags, []),
      is_active: bit(p.is_active),
      favorite_rank: p.favorite_rank,
      sort_order: p.sort_order,
      recipe: recipe(byProduct.get(p.id)),
      group_ids: (links.get(p.id) ?? []).map((l) => l.group_id),
    })),
    ingredients: ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      package_size: Number(i.package_size),
      package_price: Number(i.package_price),
      unit_cost: Number(i.unit_cost),
      usage_count: Number(i.usage_count),
      updated_at: iso(i.updated_at),
    })),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      selection: g.selection,
      is_required: bit(g.is_required),
      sort_order: g.sort_order,
      product_count: Number(g.product_count),
      options: (options.get(g.id) ?? []).map((o) => ({
        id: o.id,
        name: o.name,
        price_delta: Number(o.price_delta),
        cost_mode: o.cost_mode,
        fixed_cost: Number(o.fixed_cost),
        unit_cost: round(Number(o.unit_cost ?? 0), 4),
        is_default: bit(o.is_default),
        is_active: bit(o.is_active),
        recipe: recipe(byOption.get(o.id)),
      })),
    })),
  };
}

export async function menu_save_category(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const c = obj(a.p_category) ?? {};
  let id = uuidOrNull(field(c, "id"));
  const name = cleanText(field(c, "name"), 40);
  const subtitle = cleanText(field(c, "subtitle"), 60);
  await requirePerm(ctx, cafe, "menu");
  if (name === "") fail("E_NAME_REQUIRED");

  if (!id) {
    id = newId();
    await ctx.run(
      `INSERT INTO categories (id, cafe_id, name, subtitle, sort_order, created_at)
       SELECT ?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM categories WHERE cafe_id = ?), 0), ?`,
      [id, cafe, name, subtitle, cafe, ctx.now],
    );
  } else {
    const res = await ctx.run("UPDATE categories SET name = ?, subtitle = ? WHERE id = ? AND cafe_id = ?", [name, subtitle, id, cafe]);
    if (res.affectedRows === 0) fail("E_NOT_FOUND");
  }
  return { id };
}

/** Satırlara reçete yazar (ürün ya da seçenek) */
async function writeRecipe(ctx: Ctx, cafe: string, column: "product_id" | "option_id", id: string, list: unknown, keep: (q: number) => boolean) {
  await ctx.run(`DELETE FROM recipe_items WHERE ${column} = ?`, [id]);
  for (const r of array(list) as Row[]) {
    const q = num(field(r, "quantity")) ?? 0;
    if (!keep(q)) continue;
    const ingredient = uuid(field(r, "ingredient_id"));
    const quantity = round(q, 3);
    if (quantity === 0 || Math.abs(quantity) >= 1e9) fail("E_INVALID_INPUT");
    await ctx.run(`INSERT INTO recipe_items (id, cafe_id, ${column}, ingredient_id, quantity) VALUES (?, ?, ?, ?, ?)`, [
      newId(),
      cafe,
      id,
      ingredient,
      quantity,
    ]);
  }
}

export async function menu_save_product(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const p = obj(a.p_product) ?? {};
  let id = uuidOrNull(field(p, "id"));
  const name = cleanText(field(p, "name"), 60);
  const description = cleanText(field(p, "description"), 200);
  const category = uuidOrNull(field(p, "category_id"));
  const rawPrice = num(field(p, "price"));
  const price = rawPrice === null ? null : round(rawPrice, 2);
  const mode = costMode(field(p, "cost_mode"), "recipe");
  const fixedCost = round(num(field(p, "fixed_cost")) ?? 0, 4);
  const active = bool(field(p, "is_active")) ?? true;

  await requirePerm(ctx, cafe, "menu");
  if (name === "") fail("E_NAME_REQUIRED");
  if (price === null || price < 0) fail("E_INVALID_PRICE");
  if (price >= 1000000 || fixedCost < 0 || fixedCost >= 1000000) fail("E_INVALID_INPUT");
  if (category && !(await ctx.val("SELECT 1 FROM categories WHERE id = ? AND cafe_id = ?", [category, cafe]))) fail("E_NOT_FOUND");

  const tags = [...new Set((array(p.tags ?? []) as unknown[]).map((t) => (typeof t === "string" ? t : JSON.stringify(t))))].sort();
  if (tags.some((t) => !TAGS.includes(t))) fail("E_INVALID_INPUT");

  if (!id) {
    id = newId();
    await ctx.run(
      `INSERT INTO products (id, cafe_id, category_id, name, description, price, cost_mode, fixed_cost, tags, is_active, sort_order, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
         COALESCE((SELECT MAX(sort_order) + 1 FROM products WHERE cafe_id = ? AND category_id <=> ?), 0), ?, ?`,
      [id, cafe, category, name, description, price, mode, fixedCost, JSON.stringify(tags), active ? 1 : 0, cafe, category, ctx.now, ctx.now],
    );
  } else {
    const exists = await ctx.val("SELECT 1 FROM products WHERE id = ? AND cafe_id = ?", [id, cafe]);
    if (!exists) fail("E_NOT_FOUND");
    await ctx.run(
      `UPDATE products SET category_id = ?, name = ?, description = ?, price = ?, cost_mode = ?, fixed_cost = ?, tags = ?,
         is_active = ?, updated_at = ? WHERE id = ? AND cafe_id = ?`,
      [category, name, description, price, mode, fixedCost, JSON.stringify(tags), active ? 1 : 0, ctx.now, id, cafe],
    );
  }

  if ("recipe" in p) await writeRecipe(ctx, cafe, "product_id", id, p.recipe, (q) => q > 0);

  if ("group_ids" in p) {
    await ctx.run("DELETE FROM product_option_groups WHERE product_id = ?", [id]);
    const list = array(p.group_ids);
    for (let i = 0; i < list.length; i++) {
      await ctx.run("INSERT INTO product_option_groups (cafe_id, product_id, group_id, sort_order) VALUES (?, ?, ?, ?)", [
        cafe,
        id,
        uuid(list[i]),
        i,
      ]);
    }
  }
  return { id };
}

export async function menu_save_group(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const g = obj(a.p_group) ?? {};
  let id = uuidOrNull(field(g, "id"));
  const name = cleanText(field(g, "name"), 40);
  const selection = field(g, "selection") || "single";
  if (selection !== "single" && selection !== "multi") fail("E_INVALID_INPUT");
  const required = bool(field(g, "is_required")) ?? false;
  const list = array(g.options ?? []) as Row[];

  await requirePerm(ctx, cafe, "menu");
  if (name === "") fail("E_NAME_REQUIRED");
  if (list.length > 50) fail("E_INVALID_INPUT");

  if (!id) {
    id = newId();
    await ctx.run(
      `INSERT INTO option_groups (id, cafe_id, name, selection, is_required, sort_order, created_at)
       SELECT ?, ?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM option_groups WHERE cafe_id = ?), 0), ?`,
      [id, cafe, name, selection, required ? 1 : 0, cafe, ctx.now],
    );
  } else {
    const exists = await ctx.val("SELECT 1 FROM option_groups WHERE id = ? AND cafe_id = ?", [id, cafe]);
    if (!exists) fail("E_NOT_FOUND");
    await ctx.run("UPDATE option_groups SET name = ?, selection = ?, is_required = ? WHERE id = ?", [
      name,
      selection,
      required ? 1 : 0,
      id,
    ]);
  }

  const keep: string[] = [];
  let ord = 0;
  let defaultTaken = false;
  for (const o of list) {
    const optionName = cleanText(field(o, "name"), 40);
    if (optionName === "") continue;
    let optionId = uuidOrNull(field(o, "id"));
    let isDefault = bool(field(o, "is_default")) ?? false;
    if (selection === "single" && isDefault) {
      if (defaultTaken) isDefault = false;
      defaultTaken = true;
    }
    const delta = round(num(field(o, "price_delta")) ?? 0, 2);
    const mode = costMode(field(o, "cost_mode"), "fixed");
    const fixedCost = round(num(field(o, "fixed_cost")) ?? 0, 4);
    const active = bool(field(o, "is_active")) ?? true;

    if (optionId && (await ctx.val("SELECT 1 FROM options WHERE id = ? AND group_id = ? AND cafe_id = ?", [optionId, id, cafe]))) {
      await ctx.run(
        `UPDATE options SET name = ?, price_delta = ?, cost_mode = ?, fixed_cost = ?, is_default = ?, is_active = ?, sort_order = ?
         WHERE id = ?`,
        [optionName, delta, mode, fixedCost, isDefault ? 1 : 0, active ? 1 : 0, ord, optionId],
      );
    } else {
      optionId = newId();
      await ctx.run(
        `INSERT INTO options (id, cafe_id, group_id, name, price_delta, cost_mode, fixed_cost, is_default, is_active, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [optionId, cafe, id, optionName, delta, mode, fixedCost, isDefault ? 1 : 0, active ? 1 : 0, ord, ctx.now],
      );
    }

    if ("recipe" in o) await writeRecipe(ctx, cafe, "option_id", optionId, o.recipe, (q) => q !== 0);
    keep.push(optionId);
    ord++;
  }

  if (keep.length) {
    await ctx.run(`DELETE FROM options WHERE group_id = ? AND id NOT IN (${keep.map(() => "?").join(",")})`, [id, ...keep]);
  } else {
    await ctx.run("DELETE FROM options WHERE group_id = ?", [id]);
  }
  return { id };
}

export async function menu_save_ingredient(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const i = obj(a.p_ingredient) ?? {};
  let id = uuidOrNull(field(i, "id"));
  const name = cleanText(field(i, "name"), 60);
  const unit = field(i, "unit") || "g";
  if (!["g", "ml", "adet"].includes(unit)) fail("E_INVALID_INPUT");
  const rawSize = num(field(i, "package_size"));
  const size = rawSize === null ? null : round(rawSize, 3);
  const price = round(num(field(i, "package_price")) ?? 0, 2);

  await requirePerm(ctx, cafe, "menu");
  if (name === "") fail("E_NAME_REQUIRED");
  if (size === null || size <= 0 || price < 0) fail("E_INVALID_INPUT");

  if (!id) {
    id = newId();
    await ctx.run(
      "INSERT INTO ingredients (id, cafe_id, name, unit, package_size, package_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, cafe, name, unit, size, price, ctx.now, ctx.now],
    );
  } else {
    const exists = await ctx.val("SELECT 1 FROM ingredients WHERE id = ? AND cafe_id = ?", [id, cafe]);
    if (!exists) fail("E_NOT_FOUND");
    await ctx.run(
      "UPDATE ingredients SET name = ?, unit = ?, package_size = ?, package_price = ?, updated_at = ? WHERE id = ?",
      [name, unit, size, price, ctx.now, id],
    );
  }
  return { id };
}

async function deleteIn(ctx: Ctx, table: string, a: Row, notFound = "E_NOT_FOUND") {
  const cafe = uuid(a.p_cafe);
  const id = uuid(a.p_id);
  await requirePerm(ctx, cafe, "menu");
  if (table === "ingredients" && (await ctx.val("SELECT 1 FROM recipe_items WHERE ingredient_id = ? AND cafe_id = ? LIMIT 1", [id, cafe]))) {
    fail("E_INGREDIENT_IN_USE");
  }
  const res = await ctx.run(`DELETE FROM ${table} WHERE id = ? AND cafe_id = ?`, [id, cafe]);
  if (res.affectedRows === 0) fail(notFound);
  return null;
}

export const menu_delete_category = (ctx: Ctx, a: Row) => deleteIn(ctx, "categories", a);
export const menu_delete_group = (ctx: Ctx, a: Row) => deleteIn(ctx, "option_groups", a);
// Geçmiş satışlar ürün adının kopyasıyla raporlarda kalmaya devam eder
export const menu_delete_product = (ctx: Ctx, a: Row) => deleteIn(ctx, "products", a);
export const menu_delete_ingredient = (ctx: Ctx, a: Row) => deleteIn(ctx, "ingredients", a);

export async function menu_set_product_active(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const id = uuid(a.p_id);
  const active = bool(a.p_is_active) ?? true;
  await requirePerm(ctx, cafe, "menu");
  const exists = await ctx.val("SELECT 1 FROM products WHERE id = ? AND cafe_id = ?", [id, cafe]);
  if (!exists) fail("E_NOT_FOUND");
  await ctx.run("UPDATE products SET is_active = ?, updated_at = ? WHERE id = ?", [active ? 1 : 0, ctx.now, id]);
  return null;
}

export async function menu_set_favorite(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const id = uuid(a.p_product);
  const favorite = bool(a.p_favorite) ?? false;
  await requirePerm(ctx, cafe, "menu");
  const p = await ctx.one("SELECT favorite_rank FROM products WHERE id = ? AND cafe_id = ?", [id, cafe]);
  if (!p) fail("E_PRODUCT_NOT_FOUND");
  let rank: number | null = null;
  if (favorite) {
    rank = p.favorite_rank ?? Number((await ctx.val("SELECT COALESCE(MAX(favorite_rank) + 1, 0) FROM products WHERE cafe_id = ?", [cafe])) ?? 0);
  }
  await ctx.run("UPDATE products SET favorite_rank = ?, updated_at = ? WHERE id = ?", [rank, ctx.now, id]);
  return null;
}

async function reorder(ctx: Ctx, table: string, cafe: string, ids: string[], extra = "") {
  const seen = new Set<string>();
  for (let i = 0; i < ids.length; i++) {
    // unnest with ordinality: aynı kimlik iki kez geçerse Postgres güncellemesi ilk eşleşmeyi alır
    if (seen.has(ids[i])) continue;
    seen.add(ids[i]);
    await ctx.run(`UPDATE ${table} SET ${extra || "sort_order"} = ? WHERE id = ? AND cafe_id = ?${extra ? " AND favorite_rank IS NOT NULL" : ""}`, [
      i,
      ids[i],
      cafe,
    ]);
  }
}

export async function menu_reorder_favorites(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const ids = uuidList(a.p_ids);
  await requirePerm(ctx, cafe, "menu");
  if (ids.length > 200) fail("E_INVALID_INPUT");
  await reorder(ctx, "products", cafe, ids, "favorite_rank");
  return null;
}

const REORDER: Record<string, string> = {
  categories: "categories",
  products: "products",
  groups: "option_groups",
  areas: "areas",
  tables: "dining_tables",
};

export async function menu_reorder(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const ids = uuidList(a.p_ids);
  await requirePerm(ctx, cafe, "menu");
  if (ids.length > 500) fail("E_INVALID_INPUT");
  const table = REORDER[String(a.p_kind)];
  if (!table) fail("E_INVALID_INPUT");
  await reorder(ctx, table, cafe, ids);
  return null;
}

export async function menu_recalculate_costs(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const from = validDate(a.p_from);
  const to = validDate(a.p_to);
  await requirePerm(ctx, cafe, "menu");
  if (from === null || to === null || to < from || daysBetween(from, to) > 400) fail("E_INVALID_RANGE");
  const tz = await cafeTimezone(ctx, cafe);
  const [start] = bizRange(from, tz);
  const [end] = bizRange(addDays(to, 1), tz);

  const productCost = new Map(
    (await ctx.all(`SELECT p.id, ${unitCostSql("p", "product_id")} AS c FROM products p WHERE p.cafe_id = ?`, [cafe])).map((r) => [
      r.id,
      Number(r.c ?? 0),
    ]),
  );
  const optionCost = new Map(
    (await ctx.all(`SELECT o.id, ${unitCostSql("o", "option_id")} AS c FROM options o WHERE o.cafe_id = ?`, [cafe])).map((r) => [
      r.id,
      Number(r.c ?? 0),
    ]),
  );

  const filter = `o.cafe_id = ? AND i.product_id IS NOT NULL AND (o.status = 'open' OR (o.closed_at >= ? AND o.closed_at < ?))`;
  const combos = await ctx.all(
    `SELECT i.product_id, i.option_ids, COUNT(*) AS n FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE ${filter} GROUP BY i.product_id, i.option_ids`,
    [cafe, start, end],
  );
  let updated = 0;
  for (const c of combos) {
    const optionSum = parseJson<string[]>(c.option_ids, []).reduce((s, x) => s + (optionCost.get(x) ?? 0), 0);
    const cost = Math.max(round((productCost.get(c.product_id) ?? 0) + optionSum, 4), 0);
    await ctx.run(
      `UPDATE order_items i JOIN orders o ON o.id = i.order_id SET i.unit_cost = ?
       WHERE ${filter} AND i.product_id = ? AND i.option_ids = ?`,
      [cost, cafe, start, end, c.product_id, c.option_ids],
    );
    updated += Number(c.n);
  }
  return { updated };
}
