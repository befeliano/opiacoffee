// Güncel menüyü (scripts/data/jacca-menu-*.json) sitenin menü içeriğine ve adisyon kurulum menüsüne aktarır.
//   node scripts/import-jacca-menu.mjs
// - Fotoğrafları images.jacca.com'dan indirir, public/uploads/<ürün>.webp olarak kaydeder
// - src/site/content/menu.json: eski menüde de olan ürünlerin besin değeri, alerjen ve İngilizce adı korunur
// - src/lib/seed/opia.ts: yeni kurulumda adisyona girecek kategoriler, ürünler, fiyatlar ve seçenek grupları
// Not: Canlı adisyonda menü panelden yönetilir; bu betik yalnızca içerik dosyalarını ve kurulum menüsünü günceller.

import fs from "node:fs";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const file = (p) => new URL(p, root);
const DATA = JSON.parse(fs.readFileSync(file("scripts/data/jacca-menu-2026-11-23.json"), "utf8"));
// Önceki site menüsü: besin değerleri, alerjenler ve İngilizce adlar buradan alınır
const OLD = JSON.parse(fs.readFileSync(file("scripts/data/site-menu-onceki.json"), "utf8"));

// "Iced" → "iced" (tr-TR'de "ıced" olurdu); Türkçe "İ" ayrıca i yapılır
const norm = (s) => s.trim().replace(/İ/g, "i").toLowerCase().replace(/\s+/g, " ");
const slug = (s) =>
  norm(s)
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Kategoriler (sıra, İngilizce ad, kısa not)
const CATS = [
  ["OPIA Fall&Winter", "OPIA Fall&Winter", "Sezonun fincanları.", "This season's cups."],
  ["PROTEIN Bar", "PROTEIN Bar", "Protein shake'ler; besin değerleri açıklamada.", "Protein shakes; macros in the description."],
  ["Espresso Bar", "Espresso Bar", "Espresso bazlı sıcak kahveler.", "Hot espresso drinks."],
  ["Brew Bar", "Brew Bar", "Filtre kahve ve günün çekirdekleri: V60/Kalita ya da Japanese Cold Brew.", "Filter coffee and single origins: V60/Kalita or Japanese cold brew."],
  ["Cold Coffee", "Cold Coffee", "Buzlu kahveler.", "Iced coffees."],
  ["Türk Kahvesi", "Turkish Coffee", "", ""],
  ["Matcha Bar", "Matcha Bar", "Sıcak ve soğuk matcha.", "Hot and iced matcha."],
  ["Ube Bar", "Ube Bar", "Sıcak ve soğuk ube.", "Hot and iced ube."],
  ["Tea Bar", "Tea Bar", "Demlik çaylar.", "Loose-leaf teas."],
  ["Tatlılar", "Desserts", "Günlük çeşitlerimizi sorunuz.", "Ask for today's selection."],
  ["Sandviçler", "Sandwiches", "", ""],
  ["Diğer Sıcak İçecekler", "Other Hot Drinks", "", ""],
  ["Diğer Soğuk İçecekler", "Other Cold Drinks", "", ""],
  ["Ekstralar", "Extras", "İçeceğine ve tatlına ekle.", "Add to your drink or dessert."],
];

// Türkçe adların İngilizcesi (İngilizce adlar olduğu gibi kalır)
const NAME_EN = {
  "Sıcak Çikolata": "Hot Chocolate",
  "Süt Reçelli Latte": "Dulce de Leche Latte",
  "Süt Reçelli Iced Latte": "Dulce de Leche Iced Latte",
  "Filtre Kahve": "Filter Coffee",
  "Etiyopya Chelbesa V60/Kalita": "Ethiopia Chelbesa V60/Kalita",
  "Etiyopya Chelbesa Japanese Cold Brew": "Ethiopia Chelbesa Japanese Cold Brew",
  "Kolombiya Diego Horta V60/Kalita": "Colombia Diego Horta V60/Kalita",
  "Kolombiya Diego Horta Japanese Cold Brew": "Colombia Diego Horta Japanese Cold Brew",
  "Türk Kahvesi": "Turkish Coffee",
  "Double Türk Kahvesi": "Double Turkish Coffee",
  "Matcha Çayı": "Matcha Tea",
  "Ube Çayı": "Ube Tea",
  "Çikolatalı San Sebastian Cheesecake": "Chocolate San Sebastian Cheesecake",
  "Beyaz Çikolatalı Brownie": "White Chocolate Brownie",
  "Dana Füme": "Smoked Beef",
  Akdeniz: "Mediterranean",
  "Hindi füme": "Smoked Turkey",
  "Fincan Çay": "Cup of Tea",
  Su: "Water",
  Soda: "Sparkling Water",
  "Yulaf Sütü": "Oat Milk",
  "Badem Sütü": "Almond Milk",
  "Hindistan Cevizi Sütü": "Coconut Milk",
  Dondurma: "Ice Cream",
  Çikolata: "Chocolate",
  "Yüksek Protein Süt ( 50 G )": "High-Protein Milk (50 g)",
};

// Yeni adın eski menüdeki karşılığı (besin değeri ve alerjen için)
const OLD_ALIAS = {
  cappucino: "cappuccino",
  "double türk kahvesi": "duble türk kahvesi",
  "sıcak çikolata": "klasik sıcak çikolata",
  "beyaz çikolatalı brownie": "brownie",
  "torte della nonna": "büyükanne turtası",
  "dark chocolate mocha": "mocha",
};
const oldByName = new Map(OLD.products.map((p) => [norm(p.name), p]));

// jacca alerjen simgeleri → sitenin alerjen kimlikleri
const JACCA_ALLERGEN = { milk: "sut", eggs: "yumurta", wheat: "gluten", sesame: "susam" };

const usedSlugs = new Set();
const uniqueSlug = (name) => {
  let s = slug(name);
  let i = 2;
  while (usedSlugs.has(s)) s = `${slug(name)}-${i++}`;
  usedSlugs.add(s);
  return s;
};

async function saveImage(id, target) {
  const out = file(`public/uploads/${target}.webp`);
  const res = await fetch(`https://images.jacca.com/prod/pixlogo/product/${id}.jpg`, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${id}: ${res.status}`);
  const input = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(input).metadata();
  await sharp(input).rotate().webp({ quality: 86, effort: 6, smartSubsample: true }).toFile(out.pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  return `${meta.width}x${meta.height}`;
}

const products = [];
const sizes = [];
let sort = 0;
fs.mkdirSync(file("public/uploads"), { recursive: true });
for (const [cat, sub, name, desc, price, img, icons] of DATA.rows) {
  const catId = slug(cat);
  const key = norm(name);
  const old = oldByName.get(OLD_ALIAS[key] ?? key);
  const id = uniqueSlug(name);
  const allergens = new Set(old?.allergens ?? []);
  for (const ic of icons ? icons.split(",") : []) if (JACCA_ALLERGEN[ic]) allergens.add(JACCA_ALLERGEN[ic]);
  const text = `${name} ${desc}`;
  if (/latte|mocha|cappuc|cortado|flat white|süt\b|sütü|\bsüt,|chai/i.test(text) && !/yulaf|badem|hindistan cevizi sütü/i.test(name)) allergens.add("sut");
  if (/kaşar|peynir|mozzarella|cheddar/i.test(desc)) allergens.add("sut");
  if (cat === "Sandviçler") allergens.add("gluten");
  if (/tahin/i.test(desc)) allergens.add("susam");
  // Bilinen alerjeni olmayan, eski menüde de olmayan ürün: "barda sor" (yanlışlıkla "içermez" denmesin)
  const plain = ["Brew Bar", "Tea Bar", "Türk Kahvesi"].includes(cat) || /^(espresso|americano|iced espresso|iced americano|filtre kahve|red eye|black eye|su|soda|fincan çay|matcha çayı|ube çayı|espresso soda|espresso tonic)$/.test(key);
  const unknown = allergens.size === 0 && !old && !plain;

  let image = "";
  if (img) {
    sizes.push(`${name}: ${await saveImage(img, id)}`);
    image = `${id}.webp`;
  }
  const nameEn = NAME_EN[name] ?? (old?.name_en || "");
  products.push({
    id,
    category: catId,
    name,
    name_en: nameEn,
    lang: /[çğıöşüÇĞİÖŞÜ]/.test(name) || NAME_EN[name] ? "tr" : "en",
    description: desc || old?.description || "",
    description_en: desc ? "" : old?.description_en || "",
    price,
    priceNote: sub,
    priceNote_en: sub === "Sıcak" ? "Hot" : sub === "Soğuk" ? "Iced" : "",
    image,
    tags: sub ? [sub] : [],
    tags_en: sub === "Sıcak" ? ["Hot"] : sub === "Soğuk" ? ["Iced"] : [],
    allergens: [...allergens],
    allergenUnknown: unknown,
    seasonal: cat === "OPIA Fall&Winter",
    featured: ["Flat White", "Iced Matcha Latte", "San Sebastian Cheesecake"].includes(name),
    orderable: cat !== "Ekstralar",
    sort: ++sort,
    nutrition: old?.nutrition
      ? { ...old.nutrition, servings: old.nutrition.servings.map((s) => ({ ...s, price })) }
      : { basis: "", per100: {}, servings: [] },
  });
}

const content = {
  _note: OLD._note,
  season: {
    title: "OPIA Fall&Winter",
    label: "Sonbahar & Kış",
    subtitle: "Levant, Pumpkin Spice Latte, salep ve sıcak çikolata: soğuk günlerin fincanları barda.",
    title_en: "OPIA Fall&Winter",
    label_en: "Fall & Winter",
    subtitle_en: "Levant, pumpkin spice latte, salep and hot chocolate: cups for cold days, at the bar now.",
  },
  categories: CATS.map(([name, name_en, note, note_en], i) => ({ id: slug(name), name, name_en, note, note_en, sort: i + 1 })),
  allergens: OLD.allergens,
  products,
};
fs.writeFileSync(file("src/site/content/menu.json"), JSON.stringify(content, null, 1));

// ---------------------------------------------------------------------
// Adisyon kurulum menüsü (src/lib/seed/opia.ts)
// ---------------------------------------------------------------------
const q = (s) => JSON.stringify(s);
const price = (n) => products.find((p) => p.name === n)?.price;
const TAGS = { sut: "milk", gluten: "gluten", yumurta: "egg", "sert-kabuklu": "nuts", "yer-fistigi": "nuts" };
const WEIGHT = { Latte: 6, "Flat White": 5, Americano: 5, "Iced Latte": 5, "Iced Americano": 4, Cappucino: 4, Espresso: 3, "Filtre Kahve": 3, "Türk Kahvesi": 3, "Iced Matcha Latte": 4, "Matcha Latte": 3, "San Sebastian Cheesecake": 3, "Beyaz Çikolatalı Brownie": 2, Tiramisu: 2, Levant: 2 };
const milkDrink = (p) =>
  /latte|mocha|cappuc|cortado|flat white|chai|sıcak çikolata|cafe miel|levant|salep/i.test(p.name) && !["Ekstralar"].includes(CATS.find(([n]) => slug(n) === p.category)?.[0]);
const lines = [];
for (const [catName, , note] of CATS) {
  const ps = products.filter((p) => p.category === slug(catName));
  lines.push(`    {\n      name: ${q(catName)},\n      subtitle: ${q(note.slice(0, 60))},\n      products: [`);
  for (const p of ps) {
    const tags = [...new Set(p.allergens.map((a) => TAGS[a]).filter(Boolean))];
    const groups = [];
    if (p.orderable && milkDrink(p)) groups.push("milk");
    if (catName === "Tatlılar") groups.push("dessert");
    const parts = [`name: ${q(p.name)}`, `price: ${p.price}`];
    if (p.description) parts.push(`description: ${q(p.description.slice(0, 200))}`);
    if (tags.length) parts.push(`tags: ${q(tags)}`);
    if (groups.length) parts.push(`groups: ${q(groups)}`);
    parts.push(`demoWeight: ${catName === "Ekstralar" ? 0.3 : (WEIGHT[p.name] ?? 1)}`);
    lines.push(`        { ${parts.join(", ")} },`);
  }
  lines.push("      ],\n    },");
}
const seed = `// Opia Coffee Co. adisyon kurulumu: kategoriler, ürünler, fiyatlar ve seçenek grupları.
// scripts/import-jacca-menu.mjs ile güncel menüden (opiacoffee.jacca.com, 23 Kasım 2026) üretildi.
// Kurulumdan sonra menü panelden (Menü ekranı) yönetilir; bu dosya yalnızca yeni bir veritabanı
// kurulurken (npm run setup:mysql) kullanılır.

import type { CafeDef } from "./menus";

const range = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => \`\${prefix}\${from + i}\`);

export const OPIA_CAFE: CafeDef = {
  slug: "opia",
  name: "Opia Coffee Co.",
  theme: "slate",
  timezone: "Europe/Istanbul",
  cardCommissionRate: 0.01,
  openHour: 9,
  closeHour: 24,
  areas: [{ name: "Salon", tables: range("Masa ", 1, 12) }],
  takeaway: "Gel-Al",
  demoDailyOrders: 55,
  favorites: ["Latte", "Americano", "Flat White", "Cappucino", "Espresso", "Iced Latte", "Iced Americano", "Filtre Kahve", "Türk Kahvesi", "Iced Matcha Latte", "San Sebastian Cheesecake", "Beyaz Çikolatalı Brownie"],
  ingredients: [],
  groups: [
    {
      key: "milk",
      name: "Süt",
      selection: "single",
      options: [
        { key: "regular", name: "Normal süt", isDefault: true, demoShare: 0.8 },
        { key: "oat", name: "Yulaf sütü", priceDelta: ${price("Yulaf Sütü") ?? 50}, demoShare: 0.08 },
        { key: "almond", name: "Badem sütü", priceDelta: ${price("Badem Sütü") ?? 50}, demoShare: 0.05 },
        { key: "coconut", name: "Hindistan cevizi sütü", priceDelta: ${price("Hindistan Cevizi Sütü") ?? 50}, demoShare: 0.04 },
        { key: "protein", name: "Yüksek protein süt", priceDelta: ${price("Yüksek Protein Süt ( 50 G )") ?? 50}, demoShare: 0.03 },
      ],
    },
    {
      key: "dessert",
      name: "Tatlı ekstra",
      selection: "multi",
      options: [
        { key: "icecream", name: "Dondurma", priceDelta: ${price("Dondurma") ?? 60}, demoShare: 0.12 },
        { key: "choc", name: "Çikolata sos", priceDelta: ${price("Çikolata") ?? 70}, demoShare: 0.1 },
      ],
    },
  ],
  categories: [
${lines.join("\n")}
  ],
};

/** Yalnızca yerel geliştirme (MYSQL_SEED_DEMO=1) hesapları. Canlıda hesaplar npm run setup:mysql ile açılır. */
export const OPIA_DEV_TEAM = [
  { key: "sahip", email: "sahip@opia.local", name: "Sahip", password: "opia-sahip", memberships: [{ slug: "opia", role: "owner" as const }] },
  { key: "bar", email: "bar@opia.local", name: "Bar", password: "opia-bar", memberships: [{ slug: "opia", role: "staff" as const }] },
];
`;
fs.writeFileSync(file("src/lib/seed/opia.ts"), seed);

console.log(`${products.length} ürün, ${products.filter((p) => p.image).length} fotoğraf, ${products.filter((p) => p.nutrition.basis).length} besin değerli, ${products.filter((p) => p.allergenUnknown).length} alerjeni bilinmeyen`);
console.log(sizes.join("\n"));
