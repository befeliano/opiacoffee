// Kafenin başlangıç verisi: masalar, menü, hammaddeler, seçenekler ve
// standart reçeteler. Tipik bir üçüncü dalga kahve dükkânı menüsüdür;
// kurulumdan sonra her şey Menü ve maliyet ekranından değiştirilebilir.
//
// Gerçek kurulumda hammadde fiyatları ve sabit maliyetler 0 gelir; sahip
// kendi alış fiyatlarını girer. `demo*` alanları yalnızca test verisi
// (tanıtım) yüklenirken örnek maliyet ve satış üretmek için kullanılır.

export type Tag = "vegan" | "milk" | "gluten" | "nuts" | "egg";
type Unit = "g" | "ml" | "adet";
type RecipeLine = readonly [ingredientKey: string, quantity: number];

/** Kafe renk paletleri (globals.css içindeki [data-cafe-theme] blokları) */
export const CAFE_THEMES = ["coffee", "forest", "ocean", "berry", "slate", "sunset"] as const;
export type CafeThemeKey = (typeof CAFE_THEMES)[number];

export interface IngredientDef {
  key: string;
  name: string;
  unit: Unit;
  packageSize: number;
  demoPrice: number;
}

export interface OptionDef {
  key: string;
  name: string;
  priceDelta?: number;
  isDefault?: boolean;
  recipe?: RecipeLine[];
  demoShare?: number;
}

export interface GroupDef {
  key: string;
  name: string;
  selection: "single" | "multi";
  isRequired?: boolean;
  options: OptionDef[];
}

export interface ProductDef {
  name: string;
  price: number;
  description?: string;
  tags?: Tag[];
  /** Reçete satırları; yoksa ve `fixed` değilse maliyet 0 kalır */
  recipe?: RecipeLine[];
  /** Hazır alınan ürün: maliyet elle girilir */
  fixed?: boolean;
  /** Demo modunda sabit maliyet (reçetesi olmayan ürünler için) */
  demoCost?: number;
  /** Demo modunda satış ağırlığı */
  demoWeight?: number;
  groups?: string[];
}

export interface CategoryDef {
  name: string;
  subtitle?: string;
  products: ProductDef[];
}

export interface CafeDef {
  slug: string;
  name: string;
  /** Renk paleti */
  theme: CafeThemeKey;
  timezone?: string;
  /** Kart komisyonu (0.01 = %1) */
  cardCommissionRate?: number;
  openHour: number;
  closeHour: number;
  areas: { name: string; tables: string[] }[];
  takeaway?: string;
  ingredients: IngredientDef[];
  groups: GroupDef[];
  categories: CategoryDef[];
  /** Satış ekranının "Favoriler" sekmesi (ürün adları, sırasıyla) */
  favorites?: string[];
  /** Demo modunda günlük ortalama adisyon sayısı */
  demoDailyOrders: number;
}

export const DEFAULT_TIMEZONE = "Europe/Istanbul";
export const DEFAULT_CARD_COMMISSION = 0.01;

const range = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);

// ---------------------------------------------------------------------
// Hammaddeler (demoPrice: paket fiyatı, yalnızca test verisinde)
// ---------------------------------------------------------------------
const INGREDIENTS: IngredientDef[] = [
  { key: "beans", name: "Espresso çekirdeği", unit: "g", packageSize: 1000, demoPrice: 2400 },
  { key: "filter_beans", name: "Filtre kahve çekirdeği", unit: "g", packageSize: 1000, demoPrice: 2000 },
  { key: "milk", name: "Tam yağlı süt", unit: "ml", packageSize: 1000, demoPrice: 55 },
  { key: "oat_milk", name: "Yulaf sütü", unit: "ml", packageSize: 1000, demoPrice: 140 },
  { key: "lf_milk", name: "Laktozsuz süt", unit: "ml", packageSize: 1000, demoPrice: 70 },
  { key: "vanilla", name: "Vanilya şurubu", unit: "ml", packageSize: 1000, demoPrice: 900 },
  { key: "caramel", name: "Karamel şurubu", unit: "ml", packageSize: 1000, demoPrice: 900 },
  { key: "choc_sauce", name: "Çikolata sosu", unit: "g", packageSize: 1000, demoPrice: 750 },
  { key: "white_choc", name: "Beyaz çikolata sosu", unit: "g", packageSize: 1000, demoPrice: 850 },
  { key: "matcha", name: "Matcha tozu", unit: "g", packageSize: 100, demoPrice: 1400 },
  { key: "strawberry", name: "Çilek püresi", unit: "g", packageSize: 1000, demoPrice: 450 },
  { key: "hot_choc", name: "Sıcak çikolata tozu", unit: "g", packageSize: 1000, demoPrice: 700 },
  { key: "salep", name: "Salep tozu", unit: "g", packageSize: 1000, demoPrice: 900 },
  { key: "turkish", name: "Türk kahvesi", unit: "g", packageSize: 1000, demoPrice: 1100 },
  { key: "black_tea", name: "Siyah çay (dökme)", unit: "g", packageSize: 1000, demoPrice: 450 },
  { key: "herbal", name: "Bitki çayı (poşet)", unit: "adet", packageSize: 20, demoPrice: 120 },
  { key: "orange", name: "Portakal", unit: "g", packageSize: 1000, demoPrice: 45 },
  { key: "lemon", name: "Limon", unit: "g", packageSize: 1000, demoPrice: 60 },
  { key: "simple_syrup", name: "Sade şurup", unit: "ml", packageSize: 1000, demoPrice: 60 },
  { key: "soda", name: "Soda", unit: "adet", packageSize: 24, demoPrice: 360 },
  { key: "ice", name: "Buz", unit: "g", packageSize: 1000, demoPrice: 5 },
  { key: "cup", name: "Karton bardak + kapak", unit: "adet", packageSize: 50, demoPrice: 350 },
];

// Standart reçeteler (çift shot = 18 g)
const R = {
  espresso: [["beans", 18]] as RecipeLine[],
  cortado: [["beans", 18], ["milk", 60]] as RecipeLine[],
  cappuccino: [["beans", 18], ["milk", 150]] as RecipeLine[],
  flatWhite: [["beans", 18], ["milk", 120]] as RecipeLine[],
  latte: [["beans", 18], ["milk", 200]] as RecipeLine[],
  vanillaLatte: [["beans", 18], ["milk", 200], ["vanilla", 20]] as RecipeLine[],
  caramelLatte: [["beans", 18], ["milk", 200], ["caramel", 20]] as RecipeLine[],
  mocha: [["beans", 18], ["milk", 180], ["choc_sauce", 25]] as RecipeLine[],
  whiteMocha: [["beans", 18], ["milk", 180], ["white_choc", 25]] as RecipeLine[],
  filter: [["filter_beans", 15]] as RecipeLine[],
  coldBrew: [["filter_beans", 25], ["ice", 120]] as RecipeLine[],
  turkish: [["turkish", 7]] as RecipeLine[],
  matchaLatte: [["matcha", 3], ["milk", 200]] as RecipeLine[],
  hotChoc: [["hot_choc", 30], ["milk", 200]] as RecipeLine[],
  salep: [["salep", 25], ["milk", 200]] as RecipeLine[],
  tea: [["black_tea", 3]] as RecipeLine[],
  herbal: [["herbal", 1]] as RecipeLine[],
  orangeJuice: [["orange", 500]] as RecipeLine[],
  lemonade: [["lemon", 60], ["simple_syrup", 30], ["ice", 120]] as RecipeLine[],
  strawberryLemonade: [["lemon", 50], ["simple_syrup", 20], ["strawberry", 40], ["ice", 120]] as RecipeLine[],
  churchill: [["soda", 1], ["lemon", 30]] as RecipeLine[],
};

const espressoGroups = ["temp", "milk", "extra"];
const blackCoffeeGroups = ["temp", "extra"];

const TEAS = ["Ada çayı", "Ihlamur", "Kuşburnu", "Papatya", "Yeşil çay", "Nane limon"];

/** Seçenek grupları. Bitki çayında seçim zorunlu ama dokununca varsayılan tür gelir. */
const GROUPS: GroupDef[] = [
  {
    key: "temp",
    name: "Sıcaklık",
    selection: "single",
    options: [
      { key: "hot", name: "Sıcak", isDefault: true, demoShare: 0.62 },
      { key: "ice", name: "Buzlu", recipe: [["ice", 150]], demoShare: 0.38 },
    ],
  },
  {
    key: "milk",
    name: "Süt",
    selection: "single",
    options: [
      { key: "regular", name: "Normal süt", isDefault: true, demoShare: 0.84 },
      { key: "oat", name: "Yulaf sütü", priceDelta: 40, recipe: [["oat_milk", 170], ["milk", -170]], demoShare: 0.11 },
      { key: "lf", name: "Laktozsuz süt", priceDelta: 15, recipe: [["lf_milk", 170], ["milk", -170]], demoShare: 0.05 },
    ],
  },
  {
    key: "extra",
    name: "Ekstra",
    selection: "multi",
    options: [
      { key: "shot", name: "Ekstra shot", priceDelta: 40, recipe: [["beans", 9]], demoShare: 0.08 },
      { key: "vanilla", name: "Vanilya şurubu", priceDelta: 25, recipe: [["vanilla", 15]], demoShare: 0.05 },
      { key: "caramel", name: "Karamel şurubu", priceDelta: 25, recipe: [["caramel", 15]], demoShare: 0.05 },
    ],
  },
  {
    key: "tea",
    name: "Bitki çayı",
    selection: "single",
    isRequired: true,
    options: TEAS.map((name, i) => ({ key: `tea_${i}`, name, isDefault: i === 0, demoShare: 1 / TEAS.length })),
  },
  {
    key: "sugar",
    name: "Şeker",
    selection: "single",
    options: [
      { key: "plain", name: "Sade", demoShare: 0.4 },
      { key: "little", name: "Az şekerli", demoShare: 0.2 },
      { key: "medium", name: "Orta şekerli", demoShare: 0.3 },
      { key: "sweet", name: "Şekerli", demoShare: 0.1 },
    ],
  },
];

// ---------------------------------------------------------------------
// Varsayılan kafe: 20 masa (M1–M20) + Gel-Al
// ---------------------------------------------------------------------
export const DEFAULT_CAFE: CafeDef = {
  slug: "kafe",
  name: "Demo Kafe",
  theme: "coffee",
  timezone: DEFAULT_TIMEZONE,
  cardCommissionRate: DEFAULT_CARD_COMMISSION,
  openHour: 9,
  closeHour: 24,
  areas: [{ name: "Salon", tables: range("M", 1, 20) }],
  takeaway: "Gel-Al",
  demoDailyOrders: 42,
  favorites: ["Latte", "Americano", "Cappuccino", "Flat White", "Türk Kahvesi", "Çay", "Filtre Kahve", "Cold Brew", "Limonata", "San Sebastian Cheesecake", "Brownie", "Su"],
  ingredients: INGREDIENTS,
  groups: GROUPS,
  categories: [
    {
      name: "Espresso Bar",
      subtitle: "Sıcak / Buzlu",
      products: [
        { name: "Espresso", price: 120, tags: ["vegan"], recipe: R.espresso, groups: ["extra"], demoWeight: 3 },
        { name: "Americano", price: 160, tags: ["vegan"], recipe: R.espresso, groups: blackCoffeeGroups, demoWeight: 8 },
        { name: "Cortado", price: 165, tags: ["milk"], recipe: R.cortado, groups: espressoGroups, demoWeight: 3 },
        { name: "Cappuccino", price: 175, tags: ["milk"], recipe: R.cappuccino, groups: espressoGroups, demoWeight: 6 },
        { name: "Flat White", price: 180, tags: ["milk"], recipe: R.flatWhite, groups: espressoGroups, demoWeight: 5 },
        { name: "Latte", price: 180, tags: ["milk"], recipe: R.latte, groups: espressoGroups, demoWeight: 10 },
        { name: "Vanilyalı Latte", price: 200, tags: ["milk"], recipe: R.vanillaLatte, groups: espressoGroups, demoWeight: 4 },
        { name: "Karamelli Latte", price: 200, tags: ["milk"], recipe: R.caramelLatte, groups: espressoGroups, demoWeight: 4 },
        { name: "Mocha", price: 205, tags: ["milk"], recipe: R.mocha, groups: espressoGroups, demoWeight: 3 },
        { name: "White Mocha", price: 205, tags: ["milk"], recipe: R.whiteMocha, groups: espressoGroups, demoWeight: 3 },
      ],
    },
    {
      name: "Demleme",
      subtitle: "Filtre ve geleneksel",
      products: [
        { name: "Filtre Kahve", price: 150, tags: ["vegan"], recipe: R.filter, groups: ["temp"], demoWeight: 3 },
        { name: "Cold Brew", price: 185, tags: ["vegan"], recipe: R.coldBrew, demoWeight: 2.5 },
        { name: "Türk Kahvesi", price: 120, tags: ["vegan"], recipe: R.turkish, groups: ["sugar"], demoWeight: 3 },
        { name: "Matcha Latte", price: 220, tags: ["milk"], recipe: R.matchaLatte, groups: ["temp", "milk"], demoWeight: 3 },
        { name: "Sıcak Çikolata", price: 175, tags: ["milk"], recipe: R.hotChoc, groups: ["milk"], demoWeight: 1.5 },
        { name: "Salep", price: 175, tags: ["milk"], recipe: R.salep, demoWeight: 1 },
      ],
    },
    {
      name: "Çaylar",
      products: [
        { name: "Çay", price: 40, tags: ["vegan"], recipe: R.tea, demoWeight: 6 },
        { name: "Fincan Çay", price: 70, tags: ["vegan"], recipe: [["black_tea", 5]], demoWeight: 1.5 },
        {
          name: "Bitki Çayı",
          price: 130,
          tags: ["vegan"],
          description: TEAS.join(", "),
          recipe: R.herbal,
          groups: ["tea"],
          demoWeight: 2,
        },
      ],
    },
    {
      name: "Soğuk İçecekler",
      products: [
        { name: "Limonata", price: 160, tags: ["vegan"], recipe: R.lemonade, demoWeight: 2.5 },
        { name: "Çilekli Limonata", price: 175, tags: ["vegan"], recipe: R.strawberryLemonade, demoWeight: 2 },
        { name: "Portakal Suyu", price: 170, tags: ["vegan"], recipe: R.orangeJuice, demoWeight: 1.5 },
        { name: "Churchill", price: 110, tags: ["vegan"], recipe: R.churchill, demoWeight: 1 },
        { name: "Soda", price: 70, tags: ["vegan"], fixed: true, demoCost: 15, demoWeight: 1.5 },
        { name: "Su", price: 35, tags: ["vegan"], fixed: true, demoCost: 7, demoWeight: 3 },
      ],
    },
    {
      name: "Tatlılar",
      products: [
        { name: "San Sebastian Cheesecake", price: 230, tags: ["milk", "gluten", "egg"], fixed: true, demoCost: 96, demoWeight: 3 },
        { name: "Brownie", price: 190, tags: ["milk", "gluten", "egg"], fixed: true, demoCost: 70, demoWeight: 2.5 },
        { name: "Tiramisu", price: 210, tags: ["milk", "gluten", "egg"], fixed: true, demoCost: 88, demoWeight: 2 },
        { name: "Havuçlu Kek", price: 160, tags: ["milk", "gluten", "egg", "nuts"], fixed: true, demoCost: 55, demoWeight: 1.5 },
        { name: "Cookie", price: 110, tags: ["milk", "gluten", "egg"], fixed: true, demoCost: 38, demoWeight: 2.5 },
      ],
    },
    {
      name: "Atıştırmalık",
      products: [
        { name: "Kaşarlı Tost", price: 150, tags: ["milk", "gluten"], fixed: true, demoCost: 55, demoWeight: 2 },
        { name: "Karışık Tost", price: 175, tags: ["milk", "gluten"], fixed: true, demoCost: 70, demoWeight: 1.5 },
        { name: "Tavuklu Sandviç", price: 210, tags: ["gluten"], fixed: true, demoCost: 92, demoWeight: 1.2 },
        { name: "Tereyağlı Kruvasan", price: 120, tags: ["milk", "gluten"], fixed: true, demoCost: 42, demoWeight: 1.8 },
      ],
    },
  ],
};

export const CAFES: CafeDef[] = [DEFAULT_CAFE];

// ---------------------------------------------------------------------
// Veritabanı yükü (admin_create_cafe) üretimi
// ---------------------------------------------------------------------
export interface SeedIds {
  cafeId: string;
  tables: { id: string; name: string; isTakeaway: boolean }[];
  products: {
    id: string;
    name: string;
    category: string;
    price: number;
    unitCost: number;
    weight: number;
    groupIds: string[];
  }[];
  groups: {
    id: string;
    key: string;
    selection: "single" | "multi";
    isRequired: boolean;
    options: { id: string; name: string; priceDelta: number; isDefault: boolean; unitCost: number; share: number }[];
  }[];
}

export function buildCafePayload(def: CafeDef, opts: { demo: boolean; uuid: () => string }) {
  const { uuid, demo } = opts;
  const cafeId = uuid();
  const ingredientIds = new Map(def.ingredients.map((i) => [i.key, uuid()]));
  const ingredientUnitCost = new Map(
    def.ingredients.map((i) => [i.key, demo ? i.demoPrice / i.packageSize : 0]),
  );
  const groupIds = new Map(def.groups.map((g) => [g.key, uuid()]));

  const recipeCost = (lines: RecipeLine[] = []) =>
    lines.reduce((sum, [key, qty]) => sum + qty * (ingredientUnitCost.get(key) ?? 0), 0);

  const ingredientId = (key: string) => {
    const id = ingredientIds.get(key);
    if (!id) throw new Error(`Bilinmeyen hammadde: ${key} (${def.slug})`);
    return id;
  };
  const groupId = (key: string) => {
    const id = groupIds.get(key);
    if (!id) throw new Error(`Bilinmeyen seçenek grubu: ${key} (${def.slug})`);
    return id;
  };

  const favoriteRank = (name: string) => {
    const rank = def.favorites?.indexOf(name) ?? -1;
    return rank >= 0 ? rank : null;
  };

  const areas = def.areas.map((a, i) => ({ id: uuid(), name: a.name, sort_order: i }));
  let tableOrder = 0;
  const tables: { id: string; area_id: string | null; name: string; is_takeaway: boolean; sort_order: number }[] =
    def.areas.flatMap((a, ai) =>
      a.tables.map((name) => ({ id: uuid(), area_id: areas[ai].id, name, is_takeaway: false, sort_order: tableOrder++ })),
    );
  if (def.takeaway) {
    tables.push({ id: uuid(), area_id: null, name: def.takeaway, is_takeaway: true, sort_order: tableOrder++ });
  }

  const categories = def.categories.map((c, i) => ({ id: uuid(), name: c.name, subtitle: c.subtitle ?? "", sort_order: i }));

  const recipes: { product_id: string | null; option_id: string | null; ingredient_id: string; quantity: number }[] = [];

  const options: {
    id: string; group_id: string; name: string; price_delta: number; cost_mode: string;
    fixed_cost: number; is_default: boolean; sort_order: number;
  }[] = [];
  const seedGroups: SeedIds["groups"] = [];
  const groups = def.groups.map((g, gi) => {
    const gid = groupId(g.key);
    const seedOptions: SeedIds["groups"][number]["options"] = [];
    g.options.forEach((o, oi) => {
      const oid = uuid();
      options.push({
        id: oid, group_id: gid, name: o.name, price_delta: o.priceDelta ?? 0,
        cost_mode: o.recipe?.length ? "recipe" : "fixed", fixed_cost: 0,
        is_default: !!o.isDefault, sort_order: oi,
      });
      for (const [key, qty] of o.recipe ?? []) {
        recipes.push({ product_id: null, option_id: oid, ingredient_id: ingredientId(key), quantity: qty });
      }
      seedOptions.push({
        id: oid, name: o.name, priceDelta: o.priceDelta ?? 0, isDefault: !!o.isDefault,
        unitCost: recipeCost(o.recipe), share: o.demoShare ?? 0,
      });
    });
    seedGroups.push({ id: gid, key: g.key, selection: g.selection, isRequired: !!g.isRequired, options: seedOptions });
    return { id: gid, name: g.name, selection: g.selection, is_required: !!g.isRequired, sort_order: gi };
  });

  const products: {
    id: string; category_id: string; name: string; description: string; price: number;
    cost_mode: string; fixed_cost: number; tags: string[]; sort_order: number; favorite_rank: number | null;
  }[] = [];
  const productGroups: { product_id: string; group_id: string; sort_order: number }[] = [];
  const seedProducts: SeedIds["products"] = [];

  def.categories.forEach((c, ci) => {
    c.products.forEach((p, pi) => {
      const pid = uuid();
      const hasRecipe = !!p.recipe?.length;
      // Reçetesi bilinmeyen ürünler: gerçek kurulumda "reçete" modunda boş
      // gelir; demo modunda örnek sabit maliyetle gelir.
      const costMode = p.fixed || (!hasRecipe && demo && p.demoCost) ? "fixed" : "recipe";
      const fixedCost = demo && costMode === "fixed" ? (p.demoCost ?? 0) : 0;
      products.push({
        id: pid, category_id: categories[ci].id, name: p.name, description: p.description ?? "",
        price: p.price, cost_mode: costMode, fixed_cost: fixedCost, tags: p.tags ?? [], sort_order: pi,
        favorite_rank: favoriteRank(p.name),
      });
      for (const [key, qty] of p.recipe ?? []) {
        recipes.push({ product_id: pid, option_id: null, ingredient_id: ingredientId(key), quantity: qty });
      }
      const gids = (p.groups ?? []).map(groupId);
      gids.forEach((gid, i) => productGroups.push({ product_id: pid, group_id: gid, sort_order: i }));
      seedProducts.push({
        id: pid, name: p.name, category: c.name, price: p.price,
        unitCost: costMode === "fixed" ? fixedCost : recipeCost(p.recipe),
        weight: p.demoWeight ?? 1, groupIds: gids,
      });
    });
  });

  const payload = {
    cafe: {
      id: cafeId, slug: def.slug, name: def.name, timezone: def.timezone ?? DEFAULT_TIMEZONE,
      card_commission_rate: def.cardCommissionRate ?? DEFAULT_CARD_COMMISSION,
      open_hour: def.openHour, close_hour: def.closeHour,
      theme: def.theme,
    },
    areas,
    tables,
    categories,
    ingredients: def.ingredients.map((i) => ({
      id: ingredientId(i.key), name: i.name, unit: i.unit,
      package_size: i.packageSize, package_price: demo ? i.demoPrice : 0,
    })),
    groups,
    options,
    products,
    product_groups: productGroups,
    recipes,
  };

  const ids: SeedIds = {
    cafeId,
    tables: tables.map((t) => ({ id: t.id, name: t.name, isTakeaway: t.is_takeaway })),
    products: seedProducts,
    groups: seedGroups,
  };

  return { payload, ids };
}
