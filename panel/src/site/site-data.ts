import "server-only";
// Panelin "Web sitesi" ekranında değiştirilenler: görünüm ayarları, ürün fotoğrafları ve site bilgileri, mağaza.
// Veritabanı yoksa (Vercel) ya da okunamazsa varsayılanlarla çalışır.

import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings, type SiteSettings } from "@/lib/site-settings";
import { SITE } from "./config";
import shopDefaults from "./content/shop.json";

export interface ProductOverride {
  name_en: string;
  description_en: string;
  allergens: string[];
  allergen_unknown: boolean;
  featured: boolean;
  seasonal: boolean;
  image_mode: "default" | "custom" | "none";
  image_ver: number;
  /** Metin bilgileri panelde kaydedildi mi (değilse menü dosyasındakiler geçerli) */
  info_set: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  name_en: string;
  origin: string;
  notes: string;
  notes_en: string;
  description: string;
  description_en: string;
  weight: string;
  price: number | null;
  image: string;
}

export interface DbPost {
  slug: string;
  title: string;
  description: string;
  lead: string;
  body: string;
  published: boolean;
  hidden: boolean;
  date: string;
  updated: string;
}

export interface SiteExtras {
  settings: SiteSettings;
  products: Map<string, ProductOverride>;
  shop: ShopItem[];
  /** Panelden yüklenen fotoğraf yerleri: yer → sürüm */
  images: Map<string, number>;
  posts: DbPost[];
}

/** imgSrc (ui.tsx) eşzamanlı çalıştığı için son okunan fotoğraf yerleri burada tutulur */
export const slotVersions = new Map<string, number>();

const DEFAULT_SHOP: ShopItem[] = shopDefaults.items.map((i, n) => ({ ...i, id: `varsayilan-${n + 1}`, price: null }));
const FALLBACK: SiteExtras = { settings: DEFAULT_SITE_SETTINGS, products: new Map(), shop: DEFAULT_SHOP, images: new Map(), posts: [] };

let cache: { at: number; value: SiteExtras } | null = null;
const TTL_MS = 20_000;

export async function getSiteExtras(): Promise<SiteExtras> {
  if (!process.env.DATABASE_URL) return FALLBACK;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value = FALLBACK;
  try {
    value = await load();
  } catch (error) {
    // Tablolar henüz yoksa (ilk açılış) ya da bağlantı sorunu: varsayılanlar
    console.error("[site ayarları] okunamadı, varsayılanlar kullanılıyor:", error);
  }
  cache = { at: Date.now(), value };
  slotVersions.clear();
  for (const [k, v] of value.images) slotVersions.set(k, v);
  return value;
}

async function load(): Promise<SiteExtras> {
  const { getMysql } = await import("@/lib/data/mysql/server");
  const { pool } = await getMysql();
  const q = async <T>(sql: string, params: unknown[]) => (await pool.query(sql, params))[0] as T[];
  const [cafe] = await q<{ id: string }>("SELECT id FROM cafes WHERE slug = ?", [SITE.cafeSlug]);
  if (!cafe) return FALLBACK;
  const [settingsRow] = await q<{ data: string }>("SELECT data FROM site_settings WHERE cafe_id = ?", [cafe.id]);
  const rows = await q<{
    product_id: string; name_en: string; description_en: string; allergens: string; allergen_unknown: number;
    featured: number; seasonal: number; image_mode: ProductOverride["image_mode"]; image_ver: number; info_set: number;
  }>(
    "SELECT product_id, name_en, description_en, allergens, allergen_unknown, featured, seasonal, image_mode, image_ver, info_set FROM site_products WHERE cafe_id = ?",
    [cafe.id],
  );
  const shopRows = await q<Omit<ShopItem, "image" | "price"> & { price: string | null; image_ver: number; has_image: number }>(
    `SELECT id, name, name_en, origin, notes, notes_en, description, description_en, weight, price, image_ver, (image IS NOT NULL) AS has_image
     FROM shop_items WHERE cafe_id = ? AND is_active = 1 ORDER BY sort_order, name`,
    [cafe.id],
  );
  const imageRows = await q<{ slot: string; ver: number }>("SELECT slot, ver FROM site_images WHERE cafe_id = ?", [cafe.id]);
  const postRows = await q<{ slug: string; title: string; description: string; lead: string; body: string; published: number; hidden: number; post_date: string; updated_at: Date }>(
    "SELECT slug, title, description, lead, body, published, hidden, post_date, updated_at FROM site_posts WHERE cafe_id = ?",
    [cafe.id],
  );
  let settings = DEFAULT_SITE_SETTINGS;
  if (settingsRow) {
    try {
      settings = normalizeSiteSettings(JSON.parse(settingsRow.data));
    } catch {
      settings = DEFAULT_SITE_SETTINGS;
    }
  }
  const allergens = (text: string) => {
    try {
      const v = JSON.parse(text);
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  };
  return {
    settings,
    images: new Map(imageRows.map((r) => [r.slot, Number(r.ver)])),
    posts: postRows.map((r) => ({
      slug: r.slug,
      title: r.title,
      description: r.description,
      lead: r.lead,
      body: r.body,
      published: !!r.published,
      hidden: !!r.hidden,
      date: String(r.post_date).slice(0, 10),
      updated: new Date(r.updated_at).toISOString().slice(0, 10),
    })),
    products: new Map(
      rows.map((r) => [
        r.product_id,
        {
          name_en: r.name_en,
          description_en: r.description_en,
          allergens: allergens(r.allergens),
          allergen_unknown: !!r.allergen_unknown,
          featured: !!r.featured,
          seasonal: !!r.seasonal,
          image_mode: r.image_mode,
          image_ver: Number(r.image_ver),
          info_set: !!r.info_set,
        },
      ]),
    ),
    // Panelde hiç mağaza ürünü eklenmediyse varsayılan çekirdek listesi görünür
    shop: shopRows.length
      ? shopRows.map(({ image_ver, has_image, price, ...s }) => ({
          ...s,
          price: price === null ? null : Number(price),
          image: has_image ? `/gorsel/magaza/${s.id}?v=${image_ver}` : "",
        }))
      : DEFAULT_SHOP,
  };
}

/** Panelde bir şey kaydedilince sitenin hemen güncel olması için */
export function clearSiteExtrasCache() {
  cache = null;
}
