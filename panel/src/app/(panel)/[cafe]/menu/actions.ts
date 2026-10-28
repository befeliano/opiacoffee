"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { rpc } from "@/lib/data/server";
import { fail, type ActionResult } from "@/lib/errors";

const id = z.uuid();
const money = z.number().min(0).max(999_999);
const recipe = z
  .array(z.object({ ingredient_id: z.uuid(), quantity: z.number().gt(-1_000_000).lt(1_000_000) }))
  .max(40);

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    refresh();
    return { ok: true, data };
  } catch (error) {
    return fail(error);
  }
}

const categorySchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1).max(40),
  subtitle: z.string().trim().max(60),
});

export async function saveCategoryAction(cafeId: string, input: z.input<typeof categorySchema>) {
  return run(async () => {
    const data = categorySchema.parse(input);
    return rpc<{ id: string }>("menu_save_category", { p_cafe: id.parse(cafeId), p_category: data });
  });
}

export async function deleteCategoryAction(cafeId: string, categoryId: string) {
  return run(() => rpc<void>("menu_delete_category", { p_cafe: id.parse(cafeId), p_id: id.parse(categoryId) }));
}

export async function reorderAction(cafeId: string, kind: "categories" | "products" | "groups" | "areas" | "tables", ids: string[]) {
  return run(async () => {
    const parsed = z.object({ kind: z.enum(["categories", "products", "groups", "areas", "tables"]), ids: z.array(id).max(500) }).parse({ kind, ids });
    return rpc<void>("menu_reorder", { p_cafe: id.parse(cafeId), p_kind: parsed.kind, p_ids: parsed.ids });
  });
}

const productSchema = z.object({
  id: z.uuid().nullable(),
  category_id: z.uuid().nullable(),
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200),
  price: money,
  cost_mode: z.enum(["recipe", "fixed"]),
  fixed_cost: money,
  tags: z.array(z.enum(["vegan", "milk", "gluten", "nuts", "egg"])).max(5),
  is_active: z.boolean(),
  recipe: recipe.refine((lines) => lines.every((l) => l.quantity > 0), "Reçete miktarları pozitif olmalı"),
  group_ids: z.array(id).max(20),
});

export async function saveProductAction(cafeId: string, input: z.input<typeof productSchema>) {
  return run(async () => {
    const data = productSchema.parse(input);
    return rpc<{ id: string }>("menu_save_product", { p_cafe: id.parse(cafeId), p_product: data });
  });
}

export async function setProductActiveAction(cafeId: string, productId: string, isActive: boolean) {
  return run(() =>
    rpc<void>("menu_set_product_active", { p_cafe: id.parse(cafeId), p_id: id.parse(productId), p_is_active: z.boolean().parse(isActive) }),
  );
}

export async function deleteProductAction(cafeId: string, productId: string) {
  return run(() => rpc<void>("menu_delete_product", { p_cafe: id.parse(cafeId), p_id: id.parse(productId) }));
}

const ingredientSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1).max(60),
  unit: z.enum(["g", "ml", "adet"]),
  package_size: z.number().positive().max(9_999_999),
  package_price: z.number().min(0).max(99_999_999),
});

export async function saveIngredientAction(cafeId: string, input: z.input<typeof ingredientSchema>) {
  return run(async () => {
    const data = ingredientSchema.parse(input);
    return rpc<{ id: string }>("menu_save_ingredient", { p_cafe: id.parse(cafeId), p_ingredient: data });
  });
}

export async function deleteIngredientAction(cafeId: string, ingredientId: string) {
  return run(() => rpc<void>("menu_delete_ingredient", { p_cafe: id.parse(cafeId), p_id: id.parse(ingredientId) }));
}

const groupSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1).max(40),
  selection: z.enum(["single", "multi"]),
  is_required: z.boolean(),
  options: z
    .array(
      z.object({
        id: z.uuid().nullable(),
        name: z.string().trim().min(1).max(40),
        price_delta: z.number().gt(-1_000_000).lt(1_000_000),
        cost_mode: z.enum(["recipe", "fixed"]),
        fixed_cost: z.number().gt(-1_000_000).lt(1_000_000),
        is_default: z.boolean(),
        is_active: z.boolean(),
        recipe,
      }),
    )
    .max(50),
});

export async function saveGroupAction(cafeId: string, input: z.input<typeof groupSchema>) {
  return run(async () => {
    const data = groupSchema.parse(input);
    return rpc<{ id: string }>("menu_save_group", { p_cafe: id.parse(cafeId), p_group: data });
  });
}

export async function deleteGroupAction(cafeId: string, groupId: string) {
  return run(() => rpc<void>("menu_delete_group", { p_cafe: id.parse(cafeId), p_id: id.parse(groupId) }));
}

export async function recalculateCostsAction(cafeId: string, from: string, to: string) {
  return run(async () => {
    const dates = z.object({ from: z.iso.date(), to: z.iso.date() }).parse({ from, to });
    return rpc<{ updated: number }>("menu_recalculate_costs", { p_cafe: id.parse(cafeId), p_from: dates.from, p_to: dates.to });
  });
}

/** Ürünü favorilere ekler / çıkarır (Favoriler sekmesi en başta görünür) */
export async function setFavoriteAction(cafeId: string, productId: string, favorite: boolean) {
  return run(() =>
    rpc<void>("menu_set_favorite", { p_cafe: id.parse(cafeId), p_product: id.parse(productId), p_favorite: z.boolean().parse(favorite) }),
  );
}

export async function reorderFavoritesAction(cafeId: string, ids: string[]) {
  return run(() => rpc<void>("menu_reorder_favorites", { p_cafe: id.parse(cafeId), p_ids: z.array(id).max(200).parse(ids) }));
}
