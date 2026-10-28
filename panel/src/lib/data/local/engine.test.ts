// Veritabanı API'sinin davranış ve güvenlik testleri (gerçek Postgres/PGlite)
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createLocalUser, findLocalUser, localRpc, openLocalDatabase, seedLocalDatabase } from "./engine";
import { DEFAULT_CAFE, type CafeDef } from "../../seed/menus";
import type { TeamMemberSeed } from "../../seed/team";

// İki şubeli test kurulumu: kafeler arası izolasyon da sınanır
const CAFE_B: CafeDef = {
  ...DEFAULT_CAFE,
  slug: "sube",
  name: "İkinci Şube",
  theme: "ocean",
  favorites: [],
  areas: [{ name: "Bahçe", tables: Array.from({ length: 10 }, (_, i) => `S${i + 1}`) }],
};
const TEST_CAFES = [DEFAULT_CAFE, CAFE_B];

const OWNER = "sahip@test.local";
const OWNER2 = "ortak@test.local";
const STAFF_F = "barista-a@test.local";
const STAFF_B = "barista-b@test.local";
const MANAGER = "mudur@test.local";

const both = [{ slug: "kafe", role: "owner" as const }, { slug: "sube", role: "owner" as const }];
const TEST_TEAM: TeamMemberSeed[] = [
  { key: "sahip", email: OWNER, name: "Sahip", password: "test-sahip", memberships: both },
  { key: "ortak", email: OWNER2, name: "Ortak", password: "test-ortak", memberships: both },
  { key: "a", email: STAFF_F, name: "Barista A", password: "test-a", memberships: [{ slug: "kafe", role: "staff" }] },
  { key: "b", email: STAFF_B, name: "Barista B", password: "test-b", memberships: [{ slug: "sube", role: "staff" }] },
];

let db: PGlite;
const users: Record<string, string> = {};
let cafeA: string;
let cafeB: string;

type Floor = { tables: { id: string; name: string; is_takeaway: boolean; order: { total: number } | null }[] };
type Menu = {
  products: { id: string; name: string; price: number; group_ids: string[]; is_open_price?: boolean }[];
  groups: { id: string; name: string; options: { id: string; name: string; price_delta: number; is_default: boolean }[] }[];
};
type TableOrder = {
  order: null | {
    id: string;
    total: number;
    remaining: number;
    items: { id: string; name: string; quantity: number; unit_price: number; options_label: string }[];
  };
};

const as = (email: string) => users[email];

beforeAll(async () => {
  db = await openLocalDatabase();
  await seedLocalDatabase(db, { withOrders: false, cafes: TEST_CAFES, team: TEST_TEAM });
  for (const member of TEST_TEAM) users[member.email] = (await findLocalUser(db, member.email))!.id;
  const cafes = await localRpc<{ id: string; slug: string }[]>(db, as(OWNER), "app_my_cafes");
  cafeA = cafes.find((c) => c.slug === "kafe")!.id;
  cafeB = cafes.find((c) => c.slug === "sube")!.id;
  // Testler için ilk kafeye bir müdür ekle
  users[MANAGER] = await createLocalUser(db, MANAGER, "mudur2026");
  await db.query("select public.admin_add_member($1, $2, $3, $4)", [cafeA, users[MANAGER], "manager", "Müdür"]);
  // Sabah açılışı: gün açılmadan satış yapılamaz
  await localRpc(db, as(STAFF_F), "day_open", { p_cafe: cafeA, p_opening_cash: 0 });
});

async function expectError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toThrow(code);
}

describe("kiracı izolasyonu ve yetkiler", () => {
  it("sahipler iki kafeyi, baristalar yalnızca kendi kafesini görür", async () => {
    expect((await localRpc<unknown[]>(db, as(OWNER), "app_my_cafes")).length).toBe(2);
    expect((await localRpc<unknown[]>(db, as(OWNER2), "app_my_cafes")).length).toBe(2);
    expect((await localRpc<{ slug: string }[]>(db, as(STAFF_F), "app_my_cafes")).map((c) => c.slug)).toEqual(["kafe"]);
    expect((await localRpc<{ slug: string }[]>(db, as(STAFF_B), "app_my_cafes")).map((c) => c.slug)).toEqual(["sube"]);
  });

  it("kafe teması bağlamla birlikte gelir", async () => {
    const f = await localRpc<{ cafe: { theme: string; name: string } }>(db, as(OWNER), "app_cafe_context", { p_slug: "kafe" });
    const b = await localRpc<{ cafe: { theme: string; name: string } }>(db, as(STAFF_B), "app_cafe_context", { p_slug: "sube" });
    expect(f.cafe.theme).toBe("coffee");
    expect(b.cafe.theme).toBe("ocean");
    expect(b.cafe.name).toBe("İkinci Şube");
  });

  it("şube baristası diğer kafenin salonunu okuyamaz", async () => {
    await expectError(localRpc(db, as(STAFF_B), "pos_floor", { p_cafe: cafeA }), "E_FORBIDDEN");
    await expectError(localRpc(db, as(STAFF_B), "app_cafe_context", { p_slug: "kafe" }), "E_FORBIDDEN");
  });

  it("oturumsuz çağrılar reddedilir", async () => {
    await expect(localRpc(db, null, "pos_floor", { p_cafe: cafeA })).rejects.toThrow(/permission denied|E_NOT_AUTHENTICATED/);
  });

  it("personel rapor ve menü yönetimine erişemez, müdür erişir", async () => {
    await expectError(localRpc(db, as(STAFF_F), "report_range", { p_cafe: cafeA, p_from: "2026-09-01", p_to: "2026-09-07" }), "E_FORBIDDEN");
    await expectError(localRpc(db, as(STAFF_F), "report_products", { p_cafe: cafeA, p_from: "2020-01-01", p_to: "2026-09-17" }), "E_FORBIDDEN");
    await expectError(localRpc(db, as(STAFF_F), "report_series", { p_cafe: cafeA, p_from: "2026-09-01", p_to: "2026-09-07" }), "E_FORBIDDEN");
    await expectError(localRpc(db, as(STAFF_F), "menu_admin_data", { p_cafe: cafeA }), "E_FORBIDDEN");
    await expect(localRpc(db, as(MANAGER), "menu_admin_data", { p_cafe: cafeA })).resolves.toBeTruthy();
  });

  it("finans ve ekip yalnızca sahibe açıktır", async () => {
    await expectError(localRpc(db, as(MANAGER), "finance_expenses", { p_cafe: cafeA }), "E_FORBIDDEN");
    await expectError(localRpc(db, as(MANAGER), "team_list", { p_cafe: cafeA }), "E_FORBIDDEN");
    await expect(localRpc(db, as(OWNER), "team_list", { p_cafe: cafeA })).resolves.toHaveLength(4);
  });

  it("tablolara doğrudan erişim ve kurulum fonksiyonları kapalıdır", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: as(OWNER), role: "authenticated" })]);
        await tx.exec("set local role authenticated");
        await tx.query("select * from public.products limit 1");
      }),
    ).rejects.toThrow(/permission denied/);
    await expect(localRpc(db, as(OWNER), "admin_import_orders", { p_cafe: cafeA, p_payload: {} })).rejects.toThrow(/permission denied/);
  });

  it("başka kafenin ürünü masaya eklenemez", async () => {
    const floor = await localRpc<Floor>(db, as(STAFF_F), "pos_floor", { p_cafe: cafeA });
    const baseMenu = await localRpc<Menu>(db, as(OWNER), "pos_menu", { p_cafe: cafeB });
    await expectError(
      localRpc(db, as(STAFF_F), "pos_add_item", { p_cafe: cafeA, p_table: floor.tables[0].id, p_product: baseMenu.products[0].id }),
      "E_PRODUCT_NOT_FOUND",
    );
  });
});

describe("adisyon akışı", () => {
  it("ürün ekler, seçenek fiyatını sunucuda hesaplar, parçalı ödemeyle kapatır", async () => {
    const floor = await localRpc<Floor>(db, as(STAFF_F), "pos_floor", { p_cafe: cafeA });
    const table = floor.tables.find((t) => t.name === "M3")!;
    const menu = await localRpc<Menu>(db, as(STAFF_F), "pos_menu", { p_cafe: cafeA });
    const latte = menu.products.find((p) => p.name === "Latte")!;
    const milk = menu.groups.find((g) => g.name === "Süt")!;
    const oat = milk.options.find((o) => o.name === "Yulaf sütü")!;

    let res = await localRpc<TableOrder>(db, as(STAFF_F), "pos_add_item", {
      p_cafe: cafeA, p_table: table.id, p_product: latte.id, p_option_ids: [oat.id], p_quantity: 1,
    });
    expect(res.order!.items[0]).toMatchObject({ name: "Latte", unit_price: 220, options_label: "Yulaf sütü" });

    // Aynı turda özdeş ürün birleşir
    res = await localRpc<TableOrder>(db, as(STAFF_F), "pos_add_item", {
      p_cafe: cafeA, p_table: table.id, p_product: latte.id, p_option_ids: [oat.id],
    });
    expect(res.order!.items).toHaveLength(1);
    expect(res.order!.items[0].quantity).toBe(2);
    expect(res.order!.total).toBe(440);

    // Seçenek başka grupla çakışırsa reddedilir
    const regular = milk.options.find((o) => o.is_default)!;
    await expectError(
      localRpc(db, as(STAFF_F), "pos_add_item", { p_cafe: cafeA, p_table: table.id, p_product: latte.id, p_option_ids: [oat.id, regular.id] }),
      "E_INVALID_OPTIONS",
    );

    // Zorunlu seçenek (bitki çayı türü)
    const tea = menu.products.find((p) => p.name === "Bitki Çayı")!;
    await expectError(
      localRpc(db, as(STAFF_F), "pos_add_item", { p_cafe: cafeA, p_table: table.id, p_product: tea.id }),
      "E_OPTION_REQUIRED",
    );

    const orderId = res.order!.id;
    await expectError(localRpc(db, as(STAFF_F), "pos_pay", { p_cafe: cafeA, p_order: orderId, p_method: "card", p_amount: 1000 }), "E_AMOUNT_EXCEEDS");

    const part = await localRpc<{ closed: boolean; order: { remaining: number } }>(db, as(STAFF_F), "pos_pay", {
      p_cafe: cafeA, p_order: orderId, p_method: "card", p_amount: 200,
    });
    expect(part.closed).toBe(false);
    expect(part.order.remaining).toBe(240);

    const done = await localRpc<{ closed: boolean; order: { payments: { method: string; commission: number }[] } }>(
      db, as(STAFF_F), "pos_pay", { p_cafe: cafeA, p_order: orderId, p_method: "cash" },
    );
    expect(done.closed).toBe(true);
    expect(done.order.payments.map((p) => [p.method, p.commission])).toEqual([["card", 2], ["cash", 0]]);

    const after = await localRpc<Floor>(db, as(STAFF_F), "pos_floor", { p_cafe: cafeA });
    expect(after.tables.find((t) => t.id === table.id)!.order).toBeNull();
  });

  it("ürün silinince boşalan adisyon masayı boşaltır", async () => {
    const floor = await localRpc<Floor>(db, as(STAFF_F), "pos_floor", { p_cafe: cafeA });
    const table = floor.tables.find((t) => t.name === "M4")!;
    const menu = await localRpc<Menu>(db, as(STAFF_F), "pos_menu", { p_cafe: cafeA });
    const espresso = menu.products.find((p) => p.name === "Espresso")!;
    const res = await localRpc<TableOrder>(db, as(STAFF_F), "pos_add_item", { p_cafe: cafeA, p_table: table.id, p_product: espresso.id });
    const cleared = await localRpc<TableOrder>(db, as(STAFF_F), "pos_change_quantity", { p_cafe: cafeA, p_item: res.order!.items[0].id, p_delta: -1 });
    expect(cleared.order).toBeNull();
  });

  it("masa taşıma dolu masada adisyonları birleştirir", async () => {
    const floor = await localRpc<Floor>(db, as(STAFF_F), "pos_floor", { p_cafe: cafeA });
    const [a, b] = [floor.tables.find((t) => t.name === "M5")!, floor.tables.find((t) => t.name === "M6")!];
    const menu = await localRpc<Menu>(db, as(STAFF_F), "pos_menu", { p_cafe: cafeA });
    const su = menu.products.find((p) => p.name === "Su")!;
    const soda = menu.products.find((p) => p.name === "Soda")!;
    const ra = await localRpc<TableOrder>(db, as(STAFF_F), "pos_add_item", { p_cafe: cafeA, p_table: a.id, p_product: su.id });
    await localRpc(db, as(STAFF_F), "pos_add_item", { p_cafe: cafeA, p_table: b.id, p_product: soda.id });
    const merged = await localRpc<TableOrder>(db, as(STAFF_F), "pos_move_order", { p_cafe: cafeA, p_order: ra.order!.id, p_target_table: b.id });
    expect(merged.order!.items.map((i) => i.name).sort()).toEqual(["Soda", "Su"]);
    expect(merged.order!.total).toBe(105);
    const after = await localRpc<Floor>(db, as(STAFF_F), "pos_floor", { p_cafe: cafeA });
    expect(after.tables.find((t) => t.id === a.id)!.order).toBeNull();
  });
});

describe("menü ve maliyet", () => {
  it("reçeteli ürünün maliyetini hammadde fiyatından hesaplar", async () => {
    type Admin = {
      products: { id: string; name: string; unit_cost: number; recipe: { ingredient_id: string; quantity: number }[] }[];
      ingredients: { id: string; name: string; package_size: number; package_price: number }[];
    };
    const data = await localRpc<Admin>(db, as(MANAGER), "menu_admin_data", { p_cafe: cafeA });
    const beans = data.ingredients.find((i) => i.name === "Espresso çekirdeği")!;
    // Kurulumda alış fiyatları boştur; maliyet 0 görünür
    expect(beans.package_price).toBe(0);
    expect(data.products.find((p) => p.name === "Espresso")!.unit_cost).toBe(0);

    // 1 kg çekirdek 3.000 ₺ girilince espresso (18 g) 54 ₺ olur
    await localRpc(db, as(MANAGER), "menu_save_ingredient", {
      p_cafe: cafeA, p_ingredient: { id: beans.id, name: beans.name, unit: "g", package_size: 1000, package_price: 3000 },
    });
    const saved = await localRpc<{ id: string }>(db, as(MANAGER), "menu_save_product", {
      p_cafe: cafeA,
      p_product: { name: "Test Doppio", price: 160, cost_mode: "recipe", recipe: [{ ingredient_id: beans.id, quantity: 20 }], group_ids: [] },
    });
    const after = await localRpc<Admin>(db, as(MANAGER), "menu_admin_data", { p_cafe: cafeA });
    expect(after.products.find((p) => p.id === saved.id)!.unit_cost).toBeCloseTo(60, 2);
    expect(after.products.find((p) => p.name === "Espresso")!.unit_cost).toBeCloseTo(54, 2);

    await expectError(localRpc(db, as(MANAGER), "menu_delete_ingredient", { p_cafe: cafeA, p_id: beans.id }), "E_INGREDIENT_IN_USE");
  });
});

describe("raporlar", () => {
  it("demo verisini içe aktarır ve gün raporunu tutarlı üretir", async () => {
    const fresh = await openLocalDatabase();
    const now = new Date("2026-09-17T12:00:00Z");
    await seedLocalDatabase(fresh, { now, days: 14, withOrders: true, cafes: TEST_CAFES, team: TEST_TEAM });
    const owner = (await findLocalUser(fresh, OWNER))!.id;
    const cafes = await localRpc<{ id: string; slug: string }[]>(fresh, owner, "app_my_cafes");
    const cafe = cafes.find((c) => c.slug === "kafe")!.id;

    type Report = {
      daily: { date: string; orders: number; revenue: number; card: number; cash: number; cost: number; commission: number; guests: number }[];
      hourly: { hour: number; rounds: number }[];
      products: { qty: number }[];
      tables: { minutes: number }[];
    };
    const report = await localRpc<Report>(fresh, owner, "report_range", { p_cafe: cafe, p_from: "2026-09-07", p_to: "2026-09-13" });
    expect(report.daily).toHaveLength(7);
    // Test verisi hedefi: günde ~40 adisyon, 9–14 bin ₺ ciro
    const avgOrders = report.daily.reduce((s, d) => s + d.orders, 0) / 7;
    const avgRevenue = report.daily.reduce((s, d) => s + d.revenue, 0) / 7;
    expect(avgOrders).toBeGreaterThan(28);
    expect(avgOrders).toBeLessThan(60);
    expect(avgRevenue).toBeGreaterThan(7000);
    expect(avgRevenue).toBeLessThan(18000);
    for (const d of report.daily) {
      expect(d.orders).toBeGreaterThan(5);
      // Kart + nakit = ciro (kuruş yuvarlaması toleransıyla)
      expect(Math.abs(d.card + d.cash - d.revenue)).toBeLessThan(0.05);
      expect(d.cost).toBeGreaterThan(0);
      expect(d.commission).toBeCloseTo(Math.round(d.card * 0.01 * 100) / 100, 0);
    }
    expect(report.hourly.every((h) => h.hour >= 10 && h.hour < 24)).toBe(true);
    // Test verisinde kişi sayısı da var (müşteri analizi boş görünmesin)
    expect(report.daily.every((d) => d.guests > 0)).toBe(true);
    // Favoriler sekmesi kurulumdan dolu gelir
    const menu = await localRpc<{ products: { name: string; favorite_rank: number | null }[] }>(fresh, owner, "pos_menu", { p_cafe: cafe });
    const favs = menu.products.filter((p) => p.favorite_rank !== null).sort((a, b) => a.favorite_rank! - b.favorite_rank!);
    expect(favs.map((p) => p.name).slice(0, 3)).toEqual(["Latte", "Americano", "Cappuccino"]);
    expect(report.products.length).toBeGreaterThan(10);
    expect(report.tables.length).toBeGreaterThan(5);

    // Hafif seri raporu aynı günlük rakamları verir
    type Series = { daily: { date: string; revenue: number; orders: number }[]; hourly: { hour: number }[] };
    const series = await localRpc<Series>(fresh, owner, "report_series", { p_cafe: cafe, p_from: "2026-09-07", p_to: "2026-09-13" });
    expect(series.daily).toHaveLength(7);
    series.daily.forEach((d, i) => {
      expect(d.revenue).toBeCloseTo(report.daily[i].revenue, 1);
      expect(d.orders).toBe(report.daily[i].orders);
    });

    // Ürün raporu: tüm zamanlar
    type Products = {
      totals: { orders: number; items: number; revenue: number };
      products: { name: string; qty: number; days_sold: number }[];
      unsold: { name: string }[];
      first_sale: string;
    };
    const all = await localRpc<Products>(fresh, owner, "report_products", { p_cafe: cafe, p_from: "2020-01-01", p_to: "2026-09-17" });
    expect(all.totals.orders).toBeGreaterThan(200);
    expect(all.products[0].qty).toBeGreaterThanOrEqual(all.products[1].qty);
    expect(all.first_sale <= "2026-09-17").toBe(true);
    const todayOnly = await localRpc<Products>(fresh, owner, "report_products", { p_cafe: cafe, p_from: "2026-09-17", p_to: "2026-09-17" });
    expect(todayOnly.totals.items).toBeLessThan(all.totals.items);

    await fresh.close();
  });
});

describe("ürün bazlı ödeme, satır fiyatı ve gün kapanışı", () => {
  type Line = { id: string; name: string; quantity: number; unit_price: number; list_price: number; unit_discount: number; paid_quantity: number };
  type Ord = { order: null | { id: string; total: number; remaining: number; discount: number; items: Line[] } };
  type Pay = { closed: boolean; order: { remaining: number; payments: { method: string; amount: number; lines: string }[]; items: Line[] } };

  it("gün açmadan da satış yapılır (kafe 09:00–02:00 kendiliğinden açık); eski açılış bir kez yapılır", async () => {
    const floor = await localRpc<Floor>(db, as(STAFF_B), "pos_floor", { p_cafe: cafeB });
    const menu = await localRpc<Menu>(db, as(STAFF_B), "pos_menu", { p_cafe: cafeB });
    const added = await localRpc<Ord>(db, as(STAFF_B), "pos_add_item", { p_cafe: cafeB, p_table: floor.tables[0].id, p_product: menu.products[0].id });
    await localRpc(db, as(STAFF_B), "pos_void_order", { p_cafe: cafeB, p_order: added.order!.id, p_reason: "Test" });
    expect(menu.products.find((p) => p.name === "Cookie")?.price).toBe(110);
    await localRpc(db, as(STAFF_B), "day_open", { p_cafe: cafeB, p_opening_cash: 500 });
    await expectError(localRpc(db, as(STAFF_B), "day_open", { p_cafe: cafeB, p_opening_cash: 0 }), "E_DAY_ALREADY_OPEN");
  });

  it("seçilen ürünler ayrı ayrı kart ve nakitle ödenir, satır indirimi ve fiyat değişikliği hesaba yansır", async () => {
    const floor = await localRpc<Floor>(db, as(STAFF_B), "pos_floor", { p_cafe: cafeB });
    const table = floor.tables.find((t) => t.name === "S1")!;
    const menu = await localRpc<Menu>(db, as(STAFF_B), "pos_menu", { p_cafe: cafeB });
    const americano = menu.products.find((p) => p.name === "Americano")!;
    const pie = menu.products.find((p) => p.name === "San Sebastian Cheesecake")!;
    const joker = menu.products.find((p) => p.is_open_price)!;
    expect(joker.name).toBe("Joker");

    const add = (product: string, extra: Record<string, unknown> = {}) =>
      localRpc<Ord>(db, as(STAFF_B), "pos_add_item", { p_cafe: cafeB, p_table: table.id, p_product: product, ...extra });

    await add(americano.id, { p_quantity: 2 });
    await add(pie.id);
    // Joker fiyatsız eklenemez; girilen fiyatla eklenir, maliyeti 0
    await expectError(add(joker.id), "E_INVALID_PRICE");
    let res = await add(joker.id, { p_price: 75, p_note: "Menü dışı kurabiye" });
    expect(res.order!.total).toBe(160 * 2 + 230 + 75);

    const line = (name: string) => res.order!.items.find((i) => i.name === name)!;

    // Cheesecake'e %50 indirim (birim 115), Americano fiyatı 200'e çıkar (fazla ödeme)
    res = await localRpc<Ord>(db, as(STAFF_B), "pos_price_item", { p_cafe: cafeB, p_item: line(pie.name).id, p_unit_price: 230, p_unit_discount: 115 });
    res = await localRpc<Ord>(db, as(STAFF_B), "pos_price_item", { p_cafe: cafeB, p_item: line("Americano").id, p_unit_price: 200, p_unit_discount: 0 });
    expect(line("Americano")).toMatchObject({ unit_price: 200, list_price: 160 });
    expect(res.order!.discount).toBe(115);
    expect(res.order!.total).toBe(400 + 115 + 75);

    // 1 Americano kartla
    const p1 = await localRpc<Pay>(db, as(STAFF_B), "pos_pay_items", {
      p_cafe: cafeB, p_order: res.order!.id, p_method: "card", p_lines: [{ item_id: line("Americano").id, quantity: 1 }],
    });
    expect(p1.closed).toBe(false);
    expect(p1.order.remaining).toBe(390);
    expect(p1.order.payments[0]).toMatchObject({ method: "card", amount: 200, lines: "1× Americano" });

    // Ödenmiş satır silinemez / ödenenden aşağı düşürülemez / fiyatı değişmez
    await expectError(localRpc(db, as(STAFF_B), "pos_remove_item", { p_cafe: cafeB, p_item: line("Americano").id }), "E_ITEM_PAID");
    await expectError(localRpc(db, as(STAFF_B), "pos_change_quantity", { p_cafe: cafeB, p_item: line("Americano").id, p_delta: -2 }), "E_ITEM_PAID");
    await expectError(
      localRpc(db, as(STAFF_B), "pos_price_item", { p_cafe: cafeB, p_item: line("Americano").id, p_unit_price: 100, p_unit_discount: 0 }),
      "E_ITEM_PAID",
    );
    // Ödenmiş adetten fazlası seçilemez
    await expectError(
      localRpc(db, as(STAFF_B), "pos_pay_items", {
        p_cafe: cafeB, p_order: res.order!.id, p_method: "cash", p_lines: [{ item_id: line("Americano").id, quantity: 2 }],
      }),
      "E_INVALID_QUANTITY",
    );

    // Kalanlar nakit → adisyon kapanır
    const p2 = await localRpc<Pay>(db, as(STAFF_B), "pos_pay_items", {
      p_cafe: cafeB,
      p_order: res.order!.id,
      p_method: "cash",
      p_lines: [
        { item_id: line("Americano").id, quantity: 1 },
        { item_id: line(pie.name).id, quantity: 1 },
        { item_id: line("Joker").id, quantity: 1 },
      ],
    });
    expect(p2.closed).toBe(true);
    expect(p2.order.payments.map((p) => [p.method, p.amount])).toEqual([["card", 200], ["cash", 390]]);
    expect(p2.order.items.every((i) => i.paid_quantity === i.quantity)).toBe(true);
  });

  it("açık masa varken gün kapanmaz; kapanışta sayılan nakit beklenenle karşılaştırılır", async () => {
    const floor = await localRpc<Floor>(db, as(STAFF_B), "pos_floor", { p_cafe: cafeB });
    const table = floor.tables.find((t) => t.name === "S2")!;
    const menu = await localRpc<Menu>(db, as(STAFF_B), "pos_menu", { p_cafe: cafeB });
    const latte = menu.products.find((p) => p.name === "Latte")!;
    const res = await localRpc<Ord>(db, as(STAFF_B), "pos_add_item", { p_cafe: cafeB, p_table: table.id, p_product: latte.id });

    await expectError(localRpc(db, as(STAFF_B), "day_close", { p_cafe: cafeB, p_counted_cash: 0 }), "E_DAY_OPEN_ORDERS");
    await localRpc(db, as(STAFF_B), "pos_pay", { p_cafe: cafeB, p_order: res.order!.id, p_method: "cash" });

    // Barista da sahip gibi günün özetini ve beklenen nakdi görür
    type Status = { open: { opening_cash: number } | null; live: { expected_cash: number; cash: number } | null };
    const staffView = await localRpc<Status>(db, as(STAFF_B), "day_status", { p_cafe: cafeB });
    expect(staffView.open!.opening_cash).toBe(500);
    // 500 açılış + 390 + 180 nakit
    expect(staffView.live!.expected_cash).toBe(1070);
    const ownerView = await localRpc<Status>(db, as(OWNER), "day_status", { p_cafe: cafeB });
    expect(ownerView.live!.expected_cash).toBe(1070);

    // Barista salon ekranında günün cirosunu ve kârını görür
    const staffFloor = await localRpc<{ today?: { revenue: number; profit: number } }>(db, as(STAFF_B), "pos_floor", { p_cafe: cafeB });
    expect(staffFloor.today!.revenue).toBe(770);

    const closed = await localRpc<{ difference: number; day: { counted_cash: number; expected_cash?: number } }>(
      db, as(STAFF_B), "day_close", { p_cafe: cafeB, p_counted_cash: 1050, p_note: "" },
    );
    expect(closed.difference).toBe(-20);
    expect(closed.day.expected_cash).toBe(1070);

    type History = { open: null; history: { expected_cash: number; counted_cash: number; cash_difference: number; summary: { orders: number; card: number } }[] };
    const history = await localRpc<History>(db, as(OWNER), "day_status", { p_cafe: cafeB });
    expect(history.open).toBeNull();
    expect(history.history[0]).toMatchObject({ expected_cash: 1070, counted_cash: 1050, cash_difference: -20 });
    expect(history.history[0].summary).toMatchObject({ orders: 2, card: 200 });
  });

  it("Z raporu: KDV her ödemede ayrı hesaplanır, yalnızca sahip görür", async () => {
    const status = await localRpc<{ business_date: string }>(db, as(OWNER), "day_status", { p_cafe: cafeB });
    await expectError(localRpc(db, as(STAFF_B), "report_z", { p_cafe: cafeB, p_date: status.business_date }), "E_FORBIDDEN");

    type Z = {
      sales: { orders: number; revenue: number; items: number };
      payments: { cash: number; card: number; vat: number; commission: number; total: number };
      summary: { revenue: number; vat: number; revenue_ex_vat: number; net_profit: number };
      products: { name: string; qty: number; revenue: number }[];
      payment_list: { amount: number; vat: number }[];
      days: { counted_cash: number }[];
    };
    const z = await localRpc<Z>(db, as(OWNER), "report_z", { p_cafe: cafeB, p_date: status.business_date });
    expect(z.sales.orders).toBe(2);
    expect(z.sales.revenue).toBe(770);
    expect(z.payments).toMatchObject({ card: 200, cash: 570, total: 770, commission: 2 });
    // 200 → 18,18 · 390 → 35,45 · 180 → 16,36 (ödeme başına yuvarlanır)
    expect(z.payment_list.map((p) => p.vat)).toEqual([18.18, 35.45, 16.36]);
    expect(z.payments.vat).toBeCloseTo(69.99, 2);
    expect(z.summary.revenue_ex_vat).toBeCloseTo(700.01, 2);
    expect(z.products.find((p) => p.name === "Americano")).toMatchObject({ qty: 2, revenue: 400 });
    expect(z.products.find((p) => p.name === "Joker")).toMatchObject({ qty: 1, revenue: 75 });
    expect(z.days[0].counted_cash).toBe(1050);
  });
});

describe("ticket, POS ile gün kapanışı, adisyon silme ve favoriler", () => {
  type Ord = { order: null | { id: string; items: { id: string; name: string }[] } };
  type Pay = { closed: boolean; order: { payments: { method: string; amount: number; commission: number }[] } };
  const tableByName = async (name: string) =>
    (await localRpc<Floor>(db, as(STAFF_B), "pos_floor", { p_cafe: cafeB })).tables.find((t) => t.name === name)!;
  const product = async (name: string) =>
    (await localRpc<Menu>(db, as(STAFF_B), "pos_menu", { p_cafe: cafeB })).products.find((p) => p.name === name)!;

  it("ticket kendi komisyonuyla alınır; barista bugünün adisyonunu silebilir; kapanışta POS kart toplamı karşılaştırılır", async () => {
    await db.query("update public.cafes set ticket_commission_rate = 0.05 where id = $1", [cafeB]);
    await localRpc(db, as(STAFF_B), "day_open", { p_cafe: cafeB, p_opening_cash: 0 });

    // Ticket
    const s3 = await tableByName("S3");
    const latte = await product("Latte");
    let res = await localRpc<Ord>(db, as(STAFF_B), "pos_add_item", { p_cafe: cafeB, p_table: s3.id, p_product: latte.id });
    const ticket = await localRpc<Pay>(db, as(STAFF_B), "pos_pay", { p_cafe: cafeB, p_order: res.order!.id, p_method: "ticket" });
    expect(ticket.closed).toBe(true);
    expect(ticket.order.payments[0]).toMatchObject({ method: "ticket", amount: 180, commission: 9 });

    // Kartla ödenip sonra yanlış olduğu anlaşılan adisyon: barista siler
    const s4 = await tableByName("S4");
    const americano = await product("Americano");
    res = await localRpc<Ord>(db, as(STAFF_B), "pos_add_item", { p_cafe: cafeB, p_table: s4.id, p_product: americano.id });
    const wrongId = res.order!.id;
    await localRpc(db, as(STAFF_B), "pos_pay", { p_cafe: cafeB, p_order: wrongId, p_method: "card" });
    await localRpc(db, as(STAFF_B), "pos_void_order", { p_cafe: cafeB, p_order: wrongId, p_reason: "Yanlış masa" });
    await expectError(localRpc(db, as(STAFF_B), "pos_void_order", { p_cafe: cafeB, p_order: wrongId, p_reason: "" }), "E_ORDER_CANCELLED");

    // Kalan kart ödemesi: 120
    const s5 = await tableByName("S5");
    const espresso = await product("Espresso");
    res = await localRpc<Ord>(db, as(STAFF_B), "pos_add_item", { p_cafe: cafeB, p_table: s5.id, p_product: espresso.id });
    await localRpc(db, as(STAFF_B), "pos_pay", { p_cafe: cafeB, p_order: res.order!.id, p_method: "card" });

    // POS cihazı 130 gösteriyor → kart farkı +10; nakit 0 beklenir
    type Closed = { difference: number; card_difference: number; day: { pos_total: number; card_expected?: number } };
    const closed = await localRpc<Closed>(db, as(STAFF_B), "day_close", { p_cafe: cafeB, p_counted_cash: 0, p_note: "", p_pos_total: 130 });
    expect(closed.difference).toBe(0);
    expect(closed.card_difference).toBe(10);
    expect(closed.day.pos_total).toBe(130);
    expect(closed.day.card_expected).toBe(120);

    const owner = await localRpc<{ history: { pos_total: number; card_expected: number; summary: { ticket: number; card: number } }[] }>(
      db, as(OWNER), "day_status", { p_cafe: cafeB },
    );
    expect(owner.history[0]).toMatchObject({ pos_total: 130, card_expected: 120 });
    expect(owner.history[0].summary).toMatchObject({ ticket: 180, card: 120 });

    const status = await localRpc<{ business_date: string }>(db, as(OWNER), "day_status", { p_cafe: cafeB });
    const z = await localRpc<{ payments: { ticket: number; ticket_count: number; card: number }; sales: { cancelled: number } }>(
      db, as(OWNER), "report_z", { p_cafe: cafeB, p_date: status.business_date },
    );
    expect(z.payments).toMatchObject({ ticket: 180, ticket_count: 1 });
    expect(z.sales.cancelled).toBeGreaterThanOrEqual(1);
  });

  it("favorileri yalnızca yönetici/sahip düzenler; POS menüsünde sıralı gelir", async () => {
    const su = await product("Su");
    const latte = await product("Latte");
    await expectError(localRpc(db, as(STAFF_B), "menu_set_favorite", { p_cafe: cafeB, p_product: su.id, p_favorite: true }), "E_FORBIDDEN");
    await localRpc(db, as(OWNER), "menu_set_favorite", { p_cafe: cafeB, p_product: su.id, p_favorite: true });
    await localRpc(db, as(OWNER), "menu_set_favorite", { p_cafe: cafeB, p_product: latte.id, p_favorite: true });
    await localRpc(db, as(OWNER), "menu_reorder_favorites", { p_cafe: cafeB, p_ids: [latte.id, su.id] });
    const menu = await localRpc<{ products: { name: string; favorite_rank: number | null }[] }>(db, as(STAFF_B), "pos_menu", { p_cafe: cafeB });
    const favs = menu.products.filter((p) => p.favorite_rank !== null).sort((a, b) => a.favorite_rank! - b.favorite_rank!);
    expect(favs.map((p) => p.name)).toEqual(["Latte", "Su"]);
  });
});

describe("kalemi bölerek ödeme ve kişi sayısı", () => {
  type Line = { id: string; name: string; quantity: number; split_parts: number; paid_parts: number; paid_quantity: number };
  type Ord = { order: null | { id: string; guests: number | null; remaining: number; items: Line[] } };
  type Pay = { closed: boolean; order: { remaining: number; payments: { amount: number; lines: string }[]; items: Line[] } };

  it("4 kişi: brownie 4'e bölünür; americano içen kendi içeceği + ¼ brownie öder; kişi sayısı rapora yansır", async () => {
    await localRpc(db, as(STAFF_B), "day_open", { p_cafe: cafeB, p_opening_cash: 0 });
    const floor = await localRpc<Floor>(db, as(STAFF_B), "pos_floor", { p_cafe: cafeB });
    const table = floor.tables.find((t) => t.name === "S7")!;
    const menu = await localRpc<Menu>(db, as(STAFF_B), "pos_menu", { p_cafe: cafeB });
    const americano = menu.products.find((p) => p.name === "Americano")!;
    const brownie = menu.products.find((p) => p.name.includes("Brownie"))!;

    await localRpc(db, as(STAFF_B), "pos_add_item", { p_cafe: cafeB, p_table: table.id, p_product: americano.id, p_quantity: 2 });
    let res = await localRpc<Ord>(db, as(STAFF_B), "pos_add_item", { p_cafe: cafeB, p_table: table.id, p_product: brownie.id });
    const line = (r: Ord, name: string) => r.order!.items.find((i) => i.name === name)!;

    // Kişi sayısı
    res = await localRpc<Ord>(db, as(STAFF_B), "pos_set_guests", { p_cafe: cafeB, p_order: res.order!.id, p_guests: 4 });
    expect(res.order!.guests).toBe(4);

    // Brownie'yi 4'e böl
    res = await localRpc<Ord>(db, as(STAFF_B), "pos_split_item", { p_cafe: cafeB, p_item: line(res, brownie.name).id, p_parts: 4 });
    expect(line(res, brownie.name)).toMatchObject({ split_parts: 4, paid_parts: 0 });

    // 1 americano + ¼ brownie kartla
    const quarter = Math.round((brownie.price / 4) * 100) / 100;
    const p1 = await localRpc<Pay>(db, as(STAFF_B), "pos_pay_items", {
      p_cafe: cafeB, p_order: res.order!.id, p_method: "card",
      p_lines: [{ item_id: line(res, "Americano").id, quantity: 1 }, { item_id: line(res, brownie.name).id, quantity: 1 }],
    });
    expect(p1.order.payments[0].amount).toBe(americano.price + quarter);
    expect(p1.order.items.find((i) => i.name === brownie.name)).toMatchObject({ paid_parts: 1, paid_quantity: 0 });

    // Ödemesi başlamış satır yeniden bölünemez; 4 paydan fazlası seçilemez
    await expectError(localRpc(db, as(STAFF_B), "pos_split_item", { p_cafe: cafeB, p_item: line(res, brownie.name).id, p_parts: 2 }), "E_ITEM_PAID");
    await expectError(
      localRpc(db, as(STAFF_B), "pos_pay_items", { p_cafe: cafeB, p_order: res.order!.id, p_method: "cash", p_lines: [{ item_id: line(res, brownie.name).id, quantity: 4 }] }),
      "E_INVALID_QUANTITY",
    );

    // Kalan: 1 americano + 3/4 brownie nakit → kuruş farkı kalmadan kapanır
    const p2 = await localRpc<Pay>(db, as(STAFF_B), "pos_pay_items", {
      p_cafe: cafeB, p_order: res.order!.id, p_method: "cash",
      p_lines: [{ item_id: line(res, "Americano").id, quantity: 1 }, { item_id: line(res, brownie.name).id, quantity: 3 }],
    });
    expect(p2.closed).toBe(true);
    expect(p2.order.payments.reduce((s, p) => s + p.amount, 0)).toBeCloseTo(americano.price * 2 + brownie.price, 2);

    const status = await localRpc<{ business_date: string }>(db, as(OWNER), "day_status", { p_cafe: cafeB });
    type Report = { daily: { guests: number; guest_orders: number; guest_revenue: number }[] };
    const report = await localRpc<Report>(db, as(OWNER), "report_range", { p_cafe: cafeB, p_from: status.business_date, p_to: status.business_date });
    expect(report.daily[0]).toMatchObject({ guests: 4, guest_orders: 1 });
    expect(report.daily[0].guest_revenue).toBeCloseTo(americano.price * 2 + brownie.price, 2);
  });
});

describe("kasa sayımını pas geçme ve baristanın geçmiş görünümü", () => {
  type Day = { opening_cash: number | null; counted_cash: number | null; expected_cash: number | null; cash_difference: number | null; pos_total: number | null; card_difference: number | null };

  it("açılışta ve kapanışta sayım pas geçilebilir; girilmeyen tutarın farkı hesaplanmaz", async () => {
    // Önceki testin açık günü: nakit ve POS sayımı pas geçilerek kapanır
    const skipped = await localRpc<{ difference: number | null; card_difference: number | null; day: Day }>(
      db, as(STAFF_B), "day_close", { p_cafe: cafeB, p_counted_cash: null, p_note: "", p_pos_total: null },
    );
    expect(skipped.difference).toBeNull();
    expect(skipped.card_difference).toBeNull();
    expect(skipped.day).toMatchObject({ counted_cash: null, pos_total: null, cash_difference: null });

    // Açılış nakdi girilmeden açılır → beklenen nakit bilinmez
    await localRpc(db, as(STAFF_B), "day_open", { p_cafe: cafeB, p_opening_cash: null });
    const status = await localRpc<{ open: Day; live: { expected_cash: number | null } }>(db, as(STAFF_B), "day_status", { p_cafe: cafeB });
    expect(status.open.opening_cash).toBeNull();
    expect(status.live.expected_cash).toBeNull();

    // Yalnızca POS girilir: kart farkı hesaplanır, nakit farkı boş kalır
    const closed = await localRpc<{ difference: number | null; card_difference: number | null; day: Day }>(
      db, as(STAFF_B), "day_close", { p_cafe: cafeB, p_counted_cash: 300, p_note: "", p_pos_total: 0 },
    );
    expect(closed.difference).toBeNull();
    expect(closed.card_difference).toBe(0);
    expect(closed.day).toMatchObject({ opening_cash: null, counted_cash: 300, expected_cash: null });
  });

  it("barista bugünün ve dünün adisyonlarını görür, daha eskisini göremez", async () => {
    const status = await localRpc<{ business_date: string }>(db, as(STAFF_B), "day_status", { p_cafe: cafeB });
    const shift = (days: number) => {
      const d = new Date(`${status.business_date}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    await localRpc(db, as(STAFF_B), "pos_history", { p_cafe: cafeB, p_date: shift(-1) });
    await expectError(localRpc(db, as(STAFF_B), "pos_history", { p_cafe: cafeB, p_date: shift(-2) }), "E_FORBIDDEN");
    await localRpc(db, as(OWNER), "pos_history", { p_cafe: cafeB, p_date: shift(-30) });
    // Raporlar yine yalnızca yönetici/sahipte
    await expectError(localRpc(db, as(STAFF_B), "report_range", { p_cafe: cafeB, p_from: shift(-1), p_to: status.business_date }), "E_FORBIDDEN");
  });
});


describe("bitki çayı varsayılan türü ve Türk kahvesi şekeri", () => {
  type Ord = { order: null | { id: string; items: { name: string; options_label: string }[] } };

  it("bitki çayı varsayılan türle eklenir; Türk kahvesinde şeker isteğe bağlıdır", async () => {
    const menu = await localRpc<Menu>(db, as(STAFF_B), "pos_menu", { p_cafe: cafeB });
    const tea = menu.products.find((p) => p.name === "Bitki Çayı")!;
    const turkish = menu.products.find((p) => p.name === "Türk Kahvesi")!;
    const teaGroup = menu.groups.find((g) => tea.group_ids.includes(g.id))!;
    const sugar = menu.groups.find((g) => g.name === "Şeker")!;
    expect(teaGroup.options.filter((o) => o.is_default).map((o) => o.name)).toEqual(["Ada çayı"]);
    expect(turkish.group_ids).toContain(sugar.id);
    expect(sugar.options.map((o) => o.name)).toEqual(["Sade", "Az şekerli", "Orta şekerli", "Şekerli"]);

    const table = (await localRpc<Floor>(db, as(STAFF_B), "pos_floor", { p_cafe: cafeB })).tables.find((t) => t.name === "S8")!;
    const add = (product: string, optionIds: string[]) =>
      localRpc<Ord>(db, as(STAFF_B), "pos_add_item", { p_cafe: cafeB, p_table: table.id, p_product: product, p_option_ids: optionIds });
    await add(tea.id, teaGroup.options.filter((o) => o.is_default).map((o) => o.id));
    await add(turkish.id, []);
    const res = await add(turkish.id, [sugar.options.find((o) => o.name === "Orta şekerli")!.id]);
    expect(res.order!.items.map((i) => [i.name, i.options_label])).toEqual([
      ["Bitki Çayı", "Ada çayı"],
      ["Türk Kahvesi", ""],
      ["Türk Kahvesi", "Orta şekerli"],
    ]);
    await localRpc(db, as(STAFF_B), "pos_void_order", { p_cafe: cafeB, p_order: res.order!.id, p_reason: "Test" });
  });
});

describe("kafe profili ve kasa sayımı ayarı", () => {
  type Ctx = { cafe: { name: string; theme: string; currency: string; language: string; cash_count: boolean; logo: string | null; open_hour: number } };
  const ctxOf = () => localRpc<Ctx>(db, as(OWNER), "app_cafe_context", { p_slug: "kafe" });

  it("ayarlar kısmi kaydedilir; gönderilmeyen alan değişmez; yalnızca sahip değiştirir", async () => {
    const before = await ctxOf();
    await localRpc(db, as(OWNER), "cafe_update_settings", { p_cafe: cafeA, p_settings: { theme: "forest", currency: "EUR", language: "en" } });
    const after = await ctxOf();
    expect(after.cafe).toMatchObject({ theme: "forest", currency: "EUR", language: "en", name: before.cafe.name, open_hour: before.cafe.open_hour });
    await expectError(localRpc(db, as(MANAGER), "cafe_update_settings", { p_cafe: cafeA, p_settings: { theme: "ocean" } }), "E_FORBIDDEN");
    await expectError(localRpc(db, as(OWNER), "cafe_update_settings", { p_cafe: cafeA, p_settings: { name: "  " } }), "E_NAME_REQUIRED");
    await expectError(localRpc(db, as(OWNER), "cafe_update_settings", { p_cafe: cafeA, p_settings: { theme: "fleabag" } }), "E_INVALID_INPUT");
    await localRpc(db, as(OWNER), "cafe_update_settings", { p_cafe: cafeA, p_settings: { theme: "coffee", currency: "TRY", language: "tr" } });
  });

  it("logo yalnızca küçük resim olarak kaydedilir; giriş ekranı markası oturumsuz okunur", async () => {
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    await localRpc(db, as(OWNER), "cafe_set_logo", { p_cafe: cafeA, p_logo: png });
    expect((await ctxOf()).cafe.logo).toBe(png);
    await expectError(localRpc(db, as(OWNER), "cafe_set_logo", { p_cafe: cafeA, p_logo: "javascript:alert(1)" }), "E_INVALID_INPUT");
    await expectError(localRpc(db, as(STAFF_F), "cafe_set_logo", { p_cafe: cafeA, p_logo: null }), "E_FORBIDDEN");
    const brand = await localRpc<{ name: string; logo: string | null }>(db, null, "app_brand");
    expect(brand).toMatchObject({ name: DEFAULT_CAFE.name, logo: png });
    await localRpc(db, as(OWNER), "cafe_set_logo", { p_cafe: cafeA, p_logo: null });
  });

  it("kasa sayımı açıkken gün açılmadan satış yapılamaz; kapatılınca açık gün sayımsız kapanır", async () => {
    type Floor2 = { tables: { id: string; name: string }[] };
    const table = (await localRpc<Floor2>(db, as(STAFF_F), "pos_floor", { p_cafe: cafeA })).tables.find((t) => t.name === "M15")!;
    const espresso = (await localRpc<Menu>(db, as(STAFF_F), "pos_menu", { p_cafe: cafeA })).products.find((p) => p.name === "Espresso")!;
    const add = () => localRpc<TableOrder>(db, as(STAFF_F), "pos_add_item", { p_cafe: cafeA, p_table: table.id, p_product: espresso.id });

    // Sayım kapalıyken açık kalmış gün (beforeAll) ayar kaydedilince sayımsız kapanır
    await localRpc(db, as(OWNER), "cafe_update_settings", { p_cafe: cafeA, p_settings: { cash_count: false } });
    expect((await localRpc<{ open: unknown }>(db, as(OWNER), "day_status", { p_cafe: cafeA })).open).toBeNull();

    await localRpc(db, as(OWNER), "cafe_update_settings", { p_cafe: cafeA, p_settings: { cash_count: true } });
    await expectError(add(), "E_DAY_CLOSED");
    await localRpc(db, as(STAFF_F), "day_open", { p_cafe: cafeA, p_opening_cash: 200 });
    const res = await add();
    await localRpc(db, as(STAFF_F), "pos_void_order", { p_cafe: cafeA, p_order: res.order!.id, p_reason: "Test" });

    await localRpc(db, as(OWNER), "cafe_update_settings", { p_cafe: cafeA, p_settings: { cash_count: false } });
    const status = await localRpc<{ open: unknown }>(db, as(OWNER), "day_status", { p_cafe: cafeA });
    expect(status.open).toBeNull();
    const again = await add();
    await localRpc(db, as(STAFF_F), "pos_void_order", { p_cafe: cafeA, p_order: again.order!.id, p_reason: "Test" });
  });
});

describe("kişiye özel yetkiler (veritabanında uygulanır)", () => {
  type FloorToday = { today: null | { revenue: number; profit: number | null; cost: number | null } };
  type Perms = Record<string, string | boolean>;
  const setPerms = (user: string, p: Perms) => localRpc(db, as(OWNER), "team_set_permissions", { p_cafe: cafeA, p_user: users[user], p_permissions: p });
  const shift = (date: string, days: number) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  it("barista varsayılanı: kâr gizli, rapor ve menü kapalı; bağlamda yetkiler gelir", async () => {
    const floor = await localRpc<FloorToday>(db, as(STAFF_F), "pos_floor", { p_cafe: cafeA });
    expect(floor.today).not.toBeNull();
    expect(floor.today!.profit).toBeNull();
    expect(floor.today!.cost).toBeNull();
    const owner = await localRpc<FloorToday>(db, as(OWNER), "pos_floor", { p_cafe: cafeA });
    expect(owner.today!.profit).not.toBeNull();
    const ctx = await localRpc<{ permissions: Perms }>(db, as(STAFF_F), "app_cafe_context", { p_slug: "kafe" });
    expect(ctx.permissions).toMatchObject({ figures: "two_days", profit: false, reports: false, menu: false, void: true });
  });

  it("sahip baristaya rapor ve menü verir, indirim/silme/ödeme değiştirmeyi kapatır", async () => {
    await setPerms(STAFF_F, { reports: true, menu: true, discounts: false, void: false, payments: false, figures: "none", profit: true });
    const today = (await localRpc<{ business_date: string }>(db, as(OWNER), "day_status", { p_cafe: cafeA })).business_date;

    type R = { daily: Record<string, unknown>[]; products: Record<string, unknown>[] };
    const withCost = await localRpc<R>(db, as(STAFF_F), "report_range", { p_cafe: cafeA, p_from: shift(today, -6), p_to: today });
    expect(withCost.daily[0]).toHaveProperty("cost");
    // Kâr yetkisi kapanınca maliyet alanları veritabanından hiç gelmez
    await setPerms(STAFF_F, { reports: true, menu: true, discounts: false, void: false, payments: false, figures: "none", profit: false });
    const noCost = await localRpc<R>(db, as(STAFF_F), "report_range", { p_cafe: cafeA, p_from: shift(today, -6), p_to: today });
    expect(noCost.daily[0]).not.toHaveProperty("cost");
    expect(noCost.daily[0]).toHaveProperty("revenue");
    expect(JSON.stringify(noCost)).not.toMatch(/"(cost|unit_cost)"/);
    const products = await localRpc<{ totals: Record<string, unknown> }>(db, as(STAFF_F), "report_products", { p_cafe: cafeA, p_from: shift(today, -6), p_to: today });
    expect(products.totals).not.toHaveProperty("cost");
    await expect(localRpc(db, as(STAFF_F), "menu_admin_data", { p_cafe: cafeA })).resolves.toBeTruthy();
    // Ciro kapsamı "hiç": salon özeti gelmez, dünün geçmişi kapalı
    expect((await localRpc<FloorToday>(db, as(STAFF_F), "pos_floor", { p_cafe: cafeA })).today).toBeNull();
    await expectError(localRpc(db, as(STAFF_F), "pos_history", { p_cafe: cafeA, p_date: shift(today, -1) }), "E_FORBIDDEN");
    await localRpc(db, as(STAFF_F), "pos_history", { p_cafe: cafeA, p_date: today });

    const floor = await localRpc<Floor>(db, as(STAFF_F), "pos_floor", { p_cafe: cafeA });
    const table = floor.tables.find((t) => t.name === "M18")!;
    const menu = await localRpc<Menu>(db, as(STAFF_F), "pos_menu", { p_cafe: cafeA });
    const latte = menu.products.find((p) => p.name === "Latte")!;
    const res = await localRpc<TableOrder>(db, as(STAFF_F), "pos_add_item", { p_cafe: cafeA, p_table: table.id, p_product: latte.id });
    const item = res.order!.items[0];
    // İndirim, farklı fiyat, ikram ve hesap indirimi kapalı
    await expectError(localRpc(db, as(STAFF_F), "pos_price_item", { p_cafe: cafeA, p_item: item.id, p_unit_price: latte.price, p_unit_discount: 20 }), "E_FORBIDDEN");
    await expectError(localRpc(db, as(STAFF_F), "pos_price_item", { p_cafe: cafeA, p_item: item.id, p_unit_price: 1, p_unit_discount: 0 }), "E_FORBIDDEN");
    await expectError(
      localRpc(db, as(STAFF_F), "pos_update_item", { p_cafe: cafeA, p_item: item.id, p_option_ids: [], p_quantity: 1, p_note: "", p_is_comp: true }),
      "E_FORBIDDEN",
    );
    await expectError(localRpc(db, as(STAFF_F), "pos_update_order", { p_cafe: cafeA, p_order: res.order!.id, p_note: "", p_discount: 10 }), "E_FORBIDDEN");
    // Not yazmak serbest
    await localRpc(db, as(STAFF_F), "pos_update_order", { p_cafe: cafeA, p_order: res.order!.id, p_note: "Az sıcak", p_discount: 0 });

    // Ödeme alınır ama yöntemi değiştirilemez, adisyon silinemez
    type Paid = { order: { id: string; payments: { id: string }[] } };
    const paid = await localRpc<Paid>(db, as(STAFF_F), "pos_pay", { p_cafe: cafeA, p_order: res.order!.id, p_method: "cash" });
    await expectError(
      localRpc(db, as(STAFF_F), "pos_change_payment_method", { p_cafe: cafeA, p_payment: paid.order.payments[0].id, p_method: "card" }),
      "E_FORBIDDEN",
    );
    await expectError(localRpc(db, as(STAFF_F), "pos_void_order", { p_cafe: cafeA, p_order: res.order!.id, p_reason: "Yanlış" }), "E_FORBIDDEN");
    await localRpc(db, as(OWNER), "pos_void_order", { p_cafe: cafeA, p_order: res.order!.id, p_reason: "Test" });
  });

  it("geçersiz yetki reddedilir; yalnızca sahip değiştirir; boş nesne varsayılana döner", async () => {
    await expectError(setPerms(STAFF_F, { figures: "forever" }), "E_INVALID_INPUT");
    await expectError(setPerms(STAFF_F, { finance: true }), "E_INVALID_INPUT");
    await expectError(
      localRpc(db, as(MANAGER), "team_set_permissions", { p_cafe: cafeA, p_user: users[STAFF_F], p_permissions: { reports: true } }),
      "E_FORBIDDEN",
    );
    // Müdürden raporu almak
    await setPerms(MANAGER, { reports: false });
    await expectError(localRpc(db, as(MANAGER), "report_products", { p_cafe: cafeA, p_from: "2026-01-01", p_to: "2026-01-02" }), "E_FORBIDDEN");
    await setPerms(MANAGER, {});
    await setPerms(STAFF_F, {});
    await expectError(localRpc(db, as(STAFF_F), "menu_admin_data", { p_cafe: cafeA }), "E_FORBIDDEN");
    type Team = { email: string; permissions: Perms; custom_permissions: Perms }[];
    const team = await localRpc<Team>(db, as(OWNER), "team_list", { p_cafe: cafeA });
    expect(team.find((m) => m.email === STAFF_F)).toMatchObject({ custom_permissions: {}, permissions: { reports: false, figures: "two_days" } });
  });
});

describe("yağmur uyarısı", () => {
  type Row = { alert_since: string | null; ack_at: string | null; ack_by: string; eta_min: number | null };
  const report = (alert: boolean, eta: number | null) =>
    localRpc<Row>(db, null, "rain_report", { p_cafe: cafeB, p_status: { alert, etaMin: eta, frameTime: 1_800_000_000, stale: false } }, { role: "service_role" });

  it("ölçümü yalnızca servis yazar; uyarı açılır, onaylanınca kapanır, tekrar ölçümde açık kalmaz", async () => {
    await db.query("update public.cafes set lat = 39.785454, lon = 30.502377");
    await expect(localRpc(db, as(STAFF_B), "rain_report", { p_cafe: cafeB, p_status: { alert: true } })).rejects.toThrow(/permission denied|E_FORBIDDEN/);
    await expect(localRpc(db, as(STAFF_B), "rain_targets")).rejects.toThrow(/permission denied|E_FORBIDDEN/);

    const targets = await localRpc<{ cafe_id: string; lat: number }[]>(db, null, "rain_targets", {}, { role: "service_role" });
    expect(targets.map((t) => t.cafe_id).sort()).toEqual([cafeA, cafeB].sort());

    let row = await report(true, 12);
    expect(row.alert_since).not.toBeNull();
    expect(row.eta_min).toBe(12);

    // Başka kafenin üyesi okuyamaz ve onaylayamaz; kendi baristası onaylar
    await expectError(localRpc(db, as(STAFF_F), "rain_ack", { p_cafe: cafeB }), "E_FORBIDDEN");
    await expectError(localRpc(db, as(STAFF_F), "rain_get", { p_cafe: cafeB }), "E_FORBIDDEN");
    await localRpc(db, as(STAFF_B), "rain_ack", { p_cafe: cafeB });
    row = await report(true, 8);
    expect(row.ack_at).not.toBeNull(); // aynı yağış: onay korunur, uyarı tekrar çıkmaz
    expect(row.ack_by).toBe("Barista B");
    expect((await localRpc<Row>(db, as(STAFF_B), "rain_get", { p_cafe: cafeB })).eta_min).toBe(8);

    // Yağış geçti ama 30 dk dolmadı: uyarı kaydı durur
    row = await report(false, null);
    expect(row.alert_since).not.toBeNull();
  });
});
