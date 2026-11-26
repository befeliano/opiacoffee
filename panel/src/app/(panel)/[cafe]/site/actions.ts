"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { rpc } from "@/lib/data/server";
import { fail, type ActionResult } from "@/lib/errors";
import { normalizeSiteSettings, type SiteSettings } from "@/lib/site-settings";
import { clearSiteExtrasCache } from "@/site/site-data";

const id = z.uuid();

function done<T>(data: T): ActionResult<T> {
  clearSiteExtrasCache();
  refresh();
  return { ok: true, data };
}

export async function saveSiteSettingsAction(cafeId: string, settings: SiteSettings): Promise<ActionResult<SiteSettings>> {
  try {
    const data = await rpc<SiteSettings>("site_save_settings", { p_cafe: id.parse(cafeId), p_data: normalizeSiteSettings(settings) });
    return done(data);
  } catch (error) {
    return fail(error);
  }
}

const productSchema = z.object({
  name_en: z.string().trim().max(60),
  description_en: z.string().trim().max(300),
  allergens: z.array(z.string().regex(/^[a-z-]{1,24}$/)).max(16),
  allergen_unknown: z.boolean(),
  featured: z.boolean(),
  seasonal: z.boolean(),
});

export async function saveSiteProductAction(cafeId: string, productId: string, input: z.input<typeof productSchema>): Promise<ActionResult<void>> {
  try {
    await rpc("site_save_product", { p_cafe: id.parse(cafeId), p_product: id.parse(productId), p_data: productSchema.parse(input) });
    return done(undefined);
  } catch (error) {
    return fail(error);
  }
}

/** Fotoğrafı kaldır: "default" menü dosyasındaki fotoğrafa döner, "none" fotoğrafsız gösterir */
export async function resetProductImageAction(cafeId: string, productId: string, mode: "default" | "none"): Promise<ActionResult<void>> {
  try {
    await rpc("site_product_image", { p_cafe: id.parse(cafeId), p_product: id.parse(productId), p_data: null, p_mode: z.enum(["default", "none"]).parse(mode) });
    return done(undefined);
  } catch (error) {
    return fail(error);
  }
}

const shopSchema = z.object({
  id: id.nullable(),
  name: z.string().trim().min(1).max(80),
  name_en: z.string().trim().max(80),
  origin: z.string().trim().max(80),
  notes: z.string().trim().max(160),
  notes_en: z.string().trim().max(160),
  description: z.string().trim().max(600),
  description_en: z.string().trim().max(600),
  weight: z.string().trim().max(20),
  price: z.number().min(0).max(999_999).nullable(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
});

export async function saveShopItemAction(cafeId: string, input: z.input<typeof shopSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const saved = await rpc<string>("shop_save", { p_cafe: id.parse(cafeId), p_item: shopSchema.parse(input) });
    return done({ id: saved });
  } catch (error) {
    return fail(error);
  }
}

export async function deleteShopItemAction(cafeId: string, itemId: string): Promise<ActionResult<void>> {
  try {
    await rpc("shop_delete", { p_cafe: id.parse(cafeId), p_id: id.parse(itemId) });
    return done(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function removeShopImageAction(cafeId: string, itemId: string): Promise<ActionResult<void>> {
  try {
    await rpc("shop_image", { p_cafe: id.parse(cafeId), p_id: id.parse(itemId), p_data: null });
    return done(undefined);
  } catch (error) {
    return fail(error);
  }
}

/** Fotoğraf yerini dosyadaki varsayılana döndürür */
export async function resetSlotImageAction(cafeId: string, slot: string): Promise<ActionResult<void>> {
  try {
    await rpc("site_slot_image", { p_cafe: id.parse(cafeId), p_slot: z.string().regex(/^[a-z0-9-]{1,100}$/).parse(slot), p_data: null });
    return done(undefined);
  } catch (error) {
    return fail(error);
  }
}

const postSchema = z.object({
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,88}[a-z0-9])?$/),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(200),
  lead: z.string().trim().max(600),
  body: z.string().max(60000),
  published: z.boolean(),
  date: z.iso.date(),
});

export async function saveSitePostAction(cafeId: string, input: z.input<typeof postSchema>): Promise<ActionResult<void>> {
  try {
    await rpc("site_post_save", { p_cafe: id.parse(cafeId), p_post: { ...postSchema.parse(input), hidden: false } });
    return done(undefined);
  } catch (error) {
    return fail(error);
  }
}

/** Panelde yazılan yazıyı siler; hazır yazıysa ilk hâline döner */
export async function deleteSitePostAction(cafeId: string, slug: string): Promise<ActionResult<void>> {
  try {
    await rpc("site_post_delete", { p_cafe: id.parse(cafeId), p_slug: z.string().max(90).parse(slug) });
    return done(undefined);
  } catch (error) {
    return fail(error);
  }
}
