import "server-only";
// Sitenin menüsü: fiyat, satışta olma ve sıra adisyondan (MySQL), besin değerleri, alerjenler ve
// İngilizce metinler src/site/content/menu.json'dan gelir. Ürünler adisyondaki adıyla eşleşir.
// Veritabanına ulaşılamazsa site içerik dosyasındaki fiyatlarla çalışmaya devam eder.

import content from "./content/menu.json";
import { SITE, type Lang } from "./config";

export interface Nutrition {
  basis: string;
  per100: Record<string, number>;
  servings: { label: string; amount: number; price?: number }[];
}

export interface SiteProduct {
  id: string;
  dbId: string | null;
  category: string;
  name: string;
  name_en: string;
  lang: string;
  description: string;
  description_en: string;
  price: number;
  priceNote: string;
  priceNote_en: string;
  image: string;
  tags: string[];
  tags_en: string[];
  allergens: string[];
  seasonal: boolean;
  featured: boolean;
  soldout: boolean;
  orderable: boolean;
  options: { milk: boolean; shot: boolean; temp: boolean; dessert: boolean };
  sort: number;
  nutrition: Nutrition;
}

export interface SiteCategory {
  id: string;
  name: string;
  name_en: string;
  note: string;
  note_en: string;
  sort: number;
}

export interface SiteMenu {
  categories: SiteCategory[];
  products: SiteProduct[];
  allergens: { id: string; name: string; name_en: string }[];
  season: { title: string; label: string; subtitle: string; title_en: string; label_en: string; subtitle_en: string };
  /** Veritabanından mı geldi (false: yalnızca içerik dosyası) */
  live: boolean;
}

/** Adisyondaki seçenek gruplarının adları (QR siparişte site seçenekleri bunlara bağlanır) */
export const GROUP_NAMES = { milk: "süt", temp: "sıcaklık", shot: "ekstra shot", dessert: "tatlı ekstra" } as const;

const norm = (s: string) => s.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
const slug = (s: string) =>
  norm(s)
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

type ContentProduct = (typeof content.products)[number];

function fromContent(p: ContentProduct): SiteProduct {
  return {
    ...p,
    dbId: null,
    soldout: false,
    options: { milk: false, shot: false, temp: false, dessert: false },
    nutrition: p.nutrition as Nutrition,
  };
}

let cache: { at: number; menu: SiteMenu } | null = null;
const TTL_MS = 20_000;

export async function getSiteMenu(): Promise<SiteMenu> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.menu;
  let menu: SiteMenu;
  try {
    menu = process.env.DATABASE_URL ? await loadLive() : offline();
  } catch (error) {
    console.error("[site menü] veritabanı okunamadı, içerik dosyası kullanılıyor:", error);
    menu = offline();
  }
  cache = { at: Date.now(), menu };
  return menu;
}

function offline(): SiteMenu {
  return {
    categories: content.categories,
    products: content.products.map(fromContent),
    allergens: content.allergens,
    season: content.season,
    live: false,
  };
}

async function loadLive(): Promise<SiteMenu> {
  const { getMysql } = await import("@/lib/data/mysql/server");
  const { pool } = await getMysql();
  const q = async <T>(sql: string, params: unknown[]) => (await pool.query(sql, params))[0] as T[];

  const [cafe] = await q<{ id: string }>("SELECT id FROM cafes WHERE slug = ?", [SITE.cafeSlug]);
  if (!cafe) return offline();
  const categories = await q<{ id: string; name: string; subtitle: string; sort_order: number }>(
    "SELECT id, name, subtitle, sort_order FROM categories WHERE cafe_id = ? ORDER BY sort_order, name",
    [cafe.id],
  );
  const products = await q<{ id: string; category_id: string | null; name: string; description: string; price: number; is_active: number; is_open_price: number; sort_order: number }>(
    "SELECT id, category_id, name, description, price, is_active, is_open_price, sort_order FROM products WHERE cafe_id = ? ORDER BY sort_order, name",
    [cafe.id],
  );
  const links = await q<{ product_id: string; name: string }>(
    `SELECT pog.product_id, g.name FROM product_option_groups pog JOIN option_groups g ON g.id = pog.group_id WHERE pog.cafe_id = ?`,
    [cafe.id],
  );

  const contentCats = new Map(content.categories.map((c) => [norm(c.name), c]));
  const contentProds = new Map(content.products.map((p) => [norm(p.name), p]));
  const groupsOf = new Map<string, Set<string>>();
  for (const l of links) {
    const set = groupsOf.get(l.product_id) ?? new Set<string>();
    set.add(norm(l.name));
    groupsOf.set(l.product_id, set);
  }

  const cats: SiteCategory[] = categories
    .filter((c) => norm(c.name) !== "diğer")
    .map((c, i) => {
      const cc = contentCats.get(norm(c.name));
      return {
        id: cc?.id ?? (slug(c.name) || c.id),
        name: c.name,
        name_en: cc?.name_en ?? "",
        note: c.subtitle || cc?.note || "",
        note_en: cc?.note_en ?? "",
        sort: i + 1,
      };
    });
  const catById = new Map(categories.map((c) => [c.id, cats.find((x) => x.name === c.name)]));

  const list: SiteProduct[] = [];
  for (const p of products) {
    if (p.is_open_price) continue;
    const cat = p.category_id ? catById.get(p.category_id) : undefined;
    if (!cat) continue;
    const cp = contentProds.get(norm(p.name));
    const base = cp ? fromContent(cp) : null;
    const g = groupsOf.get(p.id) ?? new Set<string>();
    const price = Number(p.price);
    const nutrition: Nutrition = base
      ? { ...base.nutrition, servings: base.nutrition.servings.map((s) => ({ ...s, price })) }
      : { basis: "", per100: {}, servings: [] };
    list.push({
      id: base?.id ?? (slug(p.name) || p.id),
      dbId: p.id,
      category: cat.id,
      name: p.name,
      name_en: base?.name_en ?? "",
      lang: base?.lang ?? "tr",
      description: p.description || base?.description || "",
      description_en: base?.description_en ?? "",
      price,
      priceNote: base?.priceNote ?? "",
      priceNote_en: base?.priceNote_en ?? "",
      image: base?.image ?? "",
      tags: base?.tags ?? [],
      tags_en: base?.tags_en ?? [],
      allergens: base?.allergens ?? [],
      seasonal: base?.seasonal ?? false,
      featured: base?.featured ?? false,
      soldout: !p.is_active,
      orderable: (base?.orderable ?? true) && cat.id !== "ekstralar",
      options: {
        milk: g.has(GROUP_NAMES.milk),
        shot: g.has(GROUP_NAMES.shot),
        temp: g.has(GROUP_NAMES.temp),
        dessert: g.has(GROUP_NAMES.dessert),
      },
      sort: p.sort_order,
      nutrition,
    });
  }
  return { categories: cats, products: list, allergens: content.allergens, season: content.season, live: true };
}

// ---------------------------------------------------------------------
// Dil yardımcıları (PHP sürümündeki pn/pd/ptags/pnote/cn/cnote)
// ---------------------------------------------------------------------
export const pn = (p: SiteProduct, lang: Lang) => (lang === "en" && p.name_en) || p.name;
export const pd = (p: SiteProduct, lang: Lang) => (lang === "en" && p.description_en) || p.description;
export const ptags = (p: SiteProduct, lang: Lang) => (lang === "en" ? p.tags_en : p.tags);
export const pnote = (p: SiteProduct, lang: Lang) => (lang === "en" && p.priceNote_en) || p.priceNote;
export const cn = (c: SiteCategory, lang: Lang) => (lang === "en" && c.name_en) || c.name;
export const cnote = (c: SiteCategory, lang: Lang) => (lang === "en" ? c.note_en : c.note);
export const seasonTxt = (m: SiteMenu, key: "title" | "label" | "subtitle", lang: Lang) =>
  (lang === "en" && m.season[`${key}_en`]) || m.season[key];

export function productsIn(m: SiteMenu, cat: string) {
  return m.products.filter((p) => p.category === cat).sort((a, b) => a.sort - b.sort);
}

export function seasonal(m: SiteMenu) {
  return m.products.filter((p) => p.seasonal).sort((a, b) => a.sort - b.sort);
}

const SERVING_EN: Record<string, string> = {
  Standart: "Regular", Tek: "Single", Duble: "Double", Dilim: "Slice", Kase: "Bowl", Bardak: "Cup", Kare: "Square",
  Porsiyon: "Portion", Top: "Scoop", Küçük: "Small", Büyük: "Large", Orta: "Medium",
};
export function servingLabel(label: string, lang: Lang) {
  if (lang !== "en") return label;
  return label.replace(/[\p{L}]+/gu, (w) => SERVING_EN[w] ?? w);
}

export function allergenNames(m: SiteMenu, lang: Lang): Record<string, string> {
  return Object.fromEntries(m.allergens.map((a) => [a.id, lang === "en" ? a.name_en || a.name : a.name]));
}
