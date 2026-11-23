// Tanıtım sitesinin panelden yönetilen kısmı (yalnızca sahip): görünüm ayarları, ürünlerin site bilgileri
// (fotoğraf, İngilizce ad, alerjenler, öne çıkan/sezonluk) ve mağaza ürünleri. Site bu tabloları doğrudan okur.

import type { Ctx, Row } from "./db";
import { bit, cleanText, fail, newId, num, obj, parseJson, requireRole, uuid } from "./helpers";
import { normalizeSiteSettings } from "@/lib/site-settings";

const IMAGE_MIMES = ["image/webp", "image/jpeg", "image/png"];
const MAX_IMAGE = 1572864; // 1,5 MB (tarayıcıda küçültülüp gönderilir)

const flag = (v: unknown) => (v === true || v === 1 || v === "1" ? 1 : 0);

function allergenList(v: unknown): string[] {
  const list = Array.isArray(v) ? v : [];
  return [...new Set(list.filter((x): x is string => typeof x === "string" && /^[a-z-]{1,24}$/.test(x)))].slice(0, 16);
}

export async function site_admin(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "owner");
  const settings = await ctx.val<string>("SELECT data FROM site_settings WHERE cafe_id = ?", [cafe]);
  const products = await ctx.all(
    `SELECT p.id, p.name, p.price, p.is_active, p.sort_order, c.name AS category, c.sort_order AS category_sort,
            sp.name_en, sp.description_en, sp.allergens, sp.allergen_unknown, sp.featured, sp.seasonal, sp.image_mode, sp.image_ver, sp.info_set,
            (sp.product_id IS NOT NULL) AS has_row
     FROM products p JOIN categories c ON c.id = p.category_id
     LEFT JOIN site_products sp ON sp.product_id = p.id
     WHERE p.cafe_id = ? AND p.is_open_price = 0
     ORDER BY c.sort_order, c.name, p.sort_order, p.name`,
    [cafe],
  );
  const shop = await ctx.all(
    `SELECT id, name, name_en, origin, notes, notes_en, description, description_en, weight, price, is_active, sort_order, image_ver,
            (image IS NOT NULL) AS has_image
     FROM shop_items WHERE cafe_id = ? ORDER BY sort_order, name`,
    [cafe],
  );
  return {
    settings: normalizeSiteSettings(parseJson(settings, {})),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: Number(p.price),
      is_active: bit(p.is_active),
      site: bit(p.has_row)
        ? {
            name_en: p.name_en,
            description_en: p.description_en,
            allergens: parseJson<string[]>(p.allergens, []),
            allergen_unknown: bit(p.allergen_unknown),
            featured: bit(p.featured),
            seasonal: bit(p.seasonal),
            image_mode: p.image_mode,
            image_ver: Number(p.image_ver),
            info_set: bit(p.info_set),
          }
        : null,
    })),
    shop: shop.map((s) => ({
      id: s.id,
      name: s.name,
      name_en: s.name_en,
      origin: s.origin,
      notes: s.notes,
      notes_en: s.notes_en,
      description: s.description,
      description_en: s.description_en,
      weight: s.weight,
      price: s.price === null ? null : Number(s.price),
      is_active: bit(s.is_active),
      sort_order: Number(s.sort_order),
      has_image: bit(s.has_image),
      image_ver: Number(s.image_ver),
    })),
  };
}

export async function site_save_settings(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "owner");
  const data = normalizeSiteSettings(obj(a.p_data) ?? {});
  await ctx.run(
    "INSERT INTO site_settings (cafe_id, data, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)",
    [cafe, JSON.stringify(data), ctx.now],
  );
  return data;
}

async function requireProduct(ctx: Ctx, cafe: string, id: string) {
  if (!(await ctx.val("SELECT 1 FROM products WHERE id = ? AND cafe_id = ?", [id, cafe]))) fail("E_PRODUCT_NOT_FOUND");
}

async function ensureRow(ctx: Ctx, cafe: string, product: string) {
  await ctx.run("INSERT IGNORE INTO site_products (product_id, cafe_id) VALUES (?, ?)", [product, cafe]);
}

export async function site_save_product(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const product = uuid(a.p_product);
  await requireRole(ctx, cafe, "owner");
  await requireProduct(ctx, cafe, product);
  const d = obj(a.p_data) ?? {};
  await ensureRow(ctx, cafe, product);
  await ctx.run(
    `UPDATE site_products SET name_en = ?, description_en = ?, allergens = ?, allergen_unknown = ?, featured = ?, seasonal = ?, info_set = 1, updated_at = ?
     WHERE product_id = ?`,
    [
      cleanText(d.name_en, 60),
      cleanText(d.description_en, 300),
      JSON.stringify(allergenList(d.allergens)),
      flag(d.allergen_unknown),
      flag(d.featured),
      flag(d.seasonal),
      ctx.now,
      product,
    ],
  );
  return null;
}

function imageBytes(a: Row): { mime: string; data: Buffer } | null {
  if (a.p_data === null || a.p_data === undefined || a.p_data === "") return null;
  const mime = String(a.p_mime ?? "");
  const b64 = String(a.p_data);
  if (!IMAGE_MIMES.includes(mime) || !/^[A-Za-z0-9+/=]*$/.test(b64)) fail("E_INVALID_INPUT");
  const data = Buffer.from(b64, "base64");
  if (data.length < 1 || data.length > MAX_IMAGE) fail("E_INVALID_INPUT");
  return { mime, data };
}

/** Ürün fotoğrafı: p_data verilirse yüklenir; p_mode = 'default' (menü dosyasındaki fotoğraf) ya da 'none' (fotoğrafsız) */
export async function site_product_image(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const product = uuid(a.p_product);
  await requireRole(ctx, cafe, "owner");
  await requireProduct(ctx, cafe, product);
  await ensureRow(ctx, cafe, product);
  const img = imageBytes(a);
  if (img) {
    await ctx.run("UPDATE site_products SET image_mode = 'custom', image = ?, image_mime = ?, image_ver = image_ver + 1, updated_at = ? WHERE product_id = ?", [
      img.data,
      img.mime,
      ctx.now,
      product,
    ]);
  } else {
    const mode = a.p_mode === "none" ? "none" : "default";
    await ctx.run("UPDATE site_products SET image_mode = ?, image = NULL, image_mime = NULL, image_ver = image_ver + 1, updated_at = ? WHERE product_id = ?", [mode, ctx.now, product]);
  }
  return Number(await ctx.val("SELECT image_ver FROM site_products WHERE product_id = ?", [product]));
}

export async function shop_save(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "owner");
  const d = obj(a.p_item) ?? {};
  const name = cleanText(d.name, 80);
  if (!name) fail("E_NAME_REQUIRED");
  const price = d.price === null || d.price === undefined || d.price === "" ? null : num(d.price);
  if (price !== null && (price < 0 || price >= 1000000)) fail("E_INVALID_PRICE");
  const values = [
    name,
    cleanText(d.name_en, 80),
    cleanText(d.origin, 80),
    cleanText(d.notes, 160),
    cleanText(d.notes_en, 160),
    cleanText(d.description, 600),
    cleanText(d.description_en, 600),
    cleanText(d.weight, 20),
    price,
    flag(d.is_active ?? true),
    Math.max(0, Math.min(9999, Math.round(num(d.sort_order) ?? 0))),
  ];
  const cols = "name = ?, name_en = ?, origin = ?, notes = ?, notes_en = ?, description = ?, description_en = ?, weight = ?, price = ?, is_active = ?, sort_order = ?";
  if (d.id) {
    const id = uuid(d.id);
    if (!(await ctx.val("SELECT 1 FROM shop_items WHERE id = ? AND cafe_id = ?", [id, cafe]))) fail("E_NOT_FOUND");
    await ctx.run(`UPDATE shop_items SET ${cols} WHERE id = ?`, [...values, id]);
    return id;
  }
  const id = newId();
  await ctx.run(
    "INSERT INTO shop_items (name, name_en, origin, notes, notes_en, description, description_en, weight, price, is_active, sort_order, id, cafe_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [...values, id, cafe, ctx.now],
  );
  return id;
}

export async function shop_delete(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "owner");
  await ctx.run("DELETE FROM shop_items WHERE id = ? AND cafe_id = ?", [uuid(a.p_id), cafe]);
  return null;
}

export async function shop_image(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const id = uuid(a.p_id);
  await requireRole(ctx, cafe, "owner");
  if (!(await ctx.val("SELECT 1 FROM shop_items WHERE id = ? AND cafe_id = ?", [id, cafe]))) fail("E_NOT_FOUND");
  const img = imageBytes(a);
  await ctx.run("UPDATE shop_items SET image = ?, image_mime = ?, image_ver = image_ver + 1 WHERE id = ?", [img?.data ?? null, img?.mime ?? null, id]);
  return Number(await ctx.val("SELECT image_ver FROM shop_items WHERE id = ?", [id]));
}
