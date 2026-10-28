// Fark testi: aynı veri ve aynı çağrılar Postgres (PGlite, asıl şema) ve MySQL motorunda
// birebir aynı JSON'u üretmeli. Kimlikler ilk görülme sırasına göre, zamanlar ana göre normalize edilir.
// Çalıştırmak için: MYSQL_TEST_URL=mysql://kullanici:sifre@127.0.0.1:3306

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql, { type Pool } from "mysql2/promise";
import type { PGlite } from "@electric-sql/pglite";
import { randomBytes } from "node:crypto";
import { toAppError } from "@/lib/errors";
import { createLocalUser, localRpc, openLocalDatabase } from "../local/engine";
import { createPool, migrateMysql } from "./db";
import { createMysqlUser, mysqlRpc } from "./engine";
import { DEFAULT_CAFE, DEFAULT_CARD_COMMISSION, DEFAULT_TIMEZONE, buildCafePayload } from "../../seed/menus";
import { generateDemoOrders } from "../../seed/demo";
import { demoExpenses } from "../../seed/expenses";

const BASE_URL = (process.env.MYSQL_TEST_URL ?? "").replace(/\/+$/, "");
const DB_NAME = `adisyon_diff_${randomBytes(4).toString("hex")}`;

type Call = (user: string | null, fn: string, args?: Record<string, unknown>, service?: boolean) => Promise<unknown>;
interface Side {
  call: Call;
  users: Record<string, string>;
}

let pg: PGlite;
let my: Pool;
const sides: Record<"pg" | "my", Side> = {
  pg: { call: async () => null, users: {} },
  my: { call: async () => null, users: {} },
};

/** Aynı sırayla aynı kimlikleri üreten üreteç */
function idGenerator() {
  let n = 0;
  return () => {
    n++;
    const hex = n.toString(16).padStart(12, "0");
    return `00000000-0000-4000-8000-${hex}`;
  };
}

const TIE_KEYS = ["options", "products", "tables", "longest", "unsold", "payment_list", "categories", "orders"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** Karşılaştırma için normalize eder */
function normalize(value: unknown, ids = new Map<string, string>(), report = false, key = ""): unknown {
  if (Array.isArray(value)) {
    const list = value.map((v) => normalize(v, ids, report));
    // Raporlarda eşit adetli satırların sırası Postgres'te de tanımsızdır: küme olarak karşılaştır
    return report && TIE_KEYS.includes(key) ? list.sort((x, y) => (JSON.stringify(x) < JSON.stringify(y) ? -1 : 1)) : list;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) out[k] = normalize((value as Record<string, unknown>)[k], ids, report, k);
    return out;
  }
  if (typeof value === "string") {
    if (UUID_RE.test(value)) {
      const key = value.toLowerCase();
      // Tohumdan gelen sabit kimlikler iki tarafta aynıdır; yeni kayıtlar görülme sırasıyla eşlenir
      if (key.startsWith("00000000-0000-4000-8000-")) return key;
      if (!ids.has(key)) ids.set(key, `id#${ids.size + 1}`);
      return ids.get(key);
    }
    if (TS_RE.test(value)) {
      const ms = Date.parse(value);
      // İşlem anına bağlı zamanlar (now, generated_at, yeni kayıtlar) iki tarafta farklıdır
      if (Math.abs(ms - Date.now()) < 10 * 60 * 1000) return "<şimdi>";
      return new Date(ms).toISOString();
    }
  }
  return value;
}

async function both(user: string | null, fn: string, args: (side: "pg" | "my") => Record<string, unknown> = () => ({}), service = false) {
  const run = async (side: "pg" | "my") => {
    try {
      // void dönüşler: PGlite "" verir, Supabase ve MySQL motoru null
      const ok = await sides[side].call(user ? sides[side].users[user] : null, fn, args(side), service);
      return { ok: ok === "" ? null : ok };
    } catch (error) {
      // Uygulamanın göreceği hata kodu (Postgres ham hatası da aynı koda çevrilir)
      return { error: toAppError(error).code };
    }
  };
  const a = await run("pg");
  const b = await run("my");
  return { pg: a, my: b };
}

async function same(user: string | null, fn: string, args: (side: "pg" | "my") => Record<string, unknown> = () => ({}), service = false) {
  const r = await both(user, fn, args, service);
  const unordered = fn.startsWith("report_") || fn === "pos_history";
  expect(normalize(r.my, new Map(), unordered), `${fn} ${JSON.stringify(args("pg"))}`).toEqual(normalize(r.pg, new Map(), unordered));
  return r;
}

const OWNER = "sahip@diff.local";
const STAFF = "barista@diff.local";
const NOW = new Date();

beforeAll(async () => {
  if (!BASE_URL) return;
  pg = await openLocalDatabase();
  const admin = await mysql.createConnection({ uri: BASE_URL });
  await admin.query(`CREATE DATABASE ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`);
  await admin.end();
  my = createPool(`${BASE_URL}/${DB_NAME}`);
  await migrateMysql(my);

  sides.pg.call = (u, fn, args = {}, service) => localRpc(pg, u, fn, args, service ? { role: "service_role" } : {});
  sides.my.call = (u, fn, args = {}, service) => mysqlRpc(my, u, fn, args, service ? { role: "service_role" } : {});
  sides.pg.users[OWNER] = await createLocalUser(pg, OWNER, "sahip-2026");
  sides.pg.users[STAFF] = await createLocalUser(pg, STAFF, "barista-2026");
  sides.my.users[OWNER] = await createMysqlUser(my, OWNER, "sahip-2026");
  sides.my.users[STAFF] = await createMysqlUser(my, STAFF, "barista-2026");

  // İki motora aynı kimliklerle aynı kurulum ve 30 günlük örnek satış
  const gen = idGenerator();
  const { payload, ids } = buildCafePayload(DEFAULT_CAFE, { demo: true, uuid: gen });
  const demo = generateDemoOrders(DEFAULT_CAFE, ids, {
    days: 30,
    now: NOW,
    tz: DEFAULT_CAFE.timezone ?? DEFAULT_TIMEZONE,
    seed: 4242,
    commissionRate: DEFAULT_CAFE.cardCommissionRate ?? DEFAULT_CARD_COMMISSION,
    uuid: gen,
  });
  for (const side of ["pg", "my"] as const) {
    const s = sides[side];
    await s.call(null, "admin_create_cafe", { p_owner: s.users[OWNER], p_owner_name: "Sahip", p_payload: payload }, true);
    await s.call(null, "admin_add_member", { p_cafe: ids.cafeId, p_user: s.users[STAFF], p_role: "staff", p_display_name: "Barista" }, true);
    for (let i = 0; i < demo.orders.length; i += 800) {
      const orders = demo.orders.slice(i, i + 800);
      const set = new Set(orders.map((o) => o.id));
      await s.call(null, "admin_import_orders", {
        p_cafe: ids.cafeId,
        p_payload: { orders, items: demo.items.filter((x) => set.has(x.order_id)), payments: demo.payments.filter((x) => set.has(x.order_id)) },
      }, true);
    }
    await s.call(null, "admin_import_expenses", { p_cafe: ids.cafeId, p_payload: { expenses: demoExpenses(NOW) } }, true);
  }
  cafe = ids.cafeId;
}, 300_000);

afterAll(async () => {
  if (!BASE_URL) return;
  await my?.end();
  const admin = await mysql.createConnection({ uri: BASE_URL });
  await admin.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
  await admin.end();
});

let cafe = "";
const c = () => ({ p_cafe: cafe });
const day = (offset: number) => {
  const d = new Date(Date.now() - 5 * 3600 * 1000 + 3 * 3600 * 1000 + offset * 86400000);
  return d.toISOString().slice(0, 10);
};

describe.skipIf(!BASE_URL)("Postgres ↔ MySQL fark testi", () => {
  it("okuma ekranları aynı", async () => {
    await same(OWNER, "app_brand");
    await same(OWNER, "app_my_cafes");
    await same(OWNER, "app_cafe_context", () => ({ p_slug: DEFAULT_CAFE.slug }));
    await same(STAFF, "app_cafe_context", () => ({ p_slug: DEFAULT_CAFE.slug }));
    await same(OWNER, "pos_floor", c);
    await same(STAFF, "pos_floor", c);
    await same(OWNER, "pos_menu", c);
    await same(OWNER, "menu_admin_data", c);
    await same(OWNER, "tables_admin_data", c);
    await same(OWNER, "team_list", c);
    await same(OWNER, "finance_expenses", c);
    await same(OWNER, "demo_status", c);
    await same(OWNER, "day_status", c);
    await same(STAFF, "menu_admin_data", c);
  });

  it("raporlar aynı", async () => {
    for (const [from, to] of [[day(-29), day(0)], [day(-6), day(0)], [day(-1), day(-1)]]) {
      await same(OWNER, "report_range", () => ({ ...c(), p_from: from, p_to: to }));
      await same(OWNER, "report_series", () => ({ ...c(), p_from: from, p_to: to }));
      await same(OWNER, "report_products", () => ({ ...c(), p_from: from, p_to: to }));
      await same(OWNER, "report_product_daily", () => ({ ...c(), p_from: from, p_to: to }));
      await same(STAFF, "report_range", () => ({ ...c(), p_from: from, p_to: to }));
    }
    for (const d of [day(0), day(-1), day(-7), day(-20)]) {
      await same(OWNER, "report_z", () => ({ ...c(), p_date: d }));
      await same(OWNER, "pos_history", () => ({ ...c(), p_date: d }));
    }
    await same(STAFF, "pos_history", () => ({ ...c(), p_date: day(-1) }));
    await same(STAFF, "pos_history", () => ({ ...c(), p_date: day(-5) }));
    await same(OWNER, "report_range", () => ({ ...c(), p_from: day(0), p_to: day(-3) }));
  });

  it("satış akışı aynı sonuçları üretir", async () => {
    type Floor = { tables: { id: string; name: string; is_takeaway: boolean }[] };
    type Menu = { products: { id: string; name: string; group_ids: string[]; is_open_price: boolean }[]; groups: { id: string; options: { id: string; is_default: boolean }[] }[] };
    const floor = (await sides.pg.call(sides.pg.users[STAFF], "pos_floor", c())) as Floor;
    const menu = (await sides.pg.call(sides.pg.users[STAFF], "pos_menu", c())) as Menu;
    const t1 = floor.tables.find((t) => t.name === "M5")!.id;
    const t2 = floor.tables.find((t) => t.name === "M6")!.id;
    const withOptions = menu.products.find((p) => p.group_ids.length > 0 && !p.is_open_price)!;
    const plain = menu.products.find((p) => p.group_ids.length === 0 && !p.is_open_price)!;
    // Joker kafe eklenirken her motorda kendi kimliğiyle oluşur
    const myMenu = (await sides.my.call(sides.my.users[STAFF], "pos_menu", c())) as Menu;
    const joker = { pg: menu.products.find((p) => p.is_open_price)!.id, my: myMenu.products.find((p) => p.is_open_price)!.id };
    const opts = withOptions.group_ids
      .map((g) => menu.groups.find((x) => x.id === g)!)
      .map((g) => (g.options.find((o) => !o.is_default) ?? g.options[0]).id);

    // Kimlikler katalogdan (iki tarafta aynı); adisyon/satır kimlikleri her taraftan kendi yanıtıyla okunur
    const last: Record<"pg" | "my", { order?: { id: string; items: { id: string }[]; payments: { id: string }[] } }> = { pg: {}, my: {} };
    const step = async (user: string, fn: string, args: (side: "pg" | "my") => Record<string, unknown>) => {
      const r = await same(user, fn, args);
      for (const side of ["pg", "my"] as const) {
        const ok = (r[side] as { ok?: { order?: unknown } }).ok;
        if (ok && typeof ok === "object" && "order" in ok && ok.order) last[side] = ok as (typeof last)["pg"];
      }
      return r;
    };
    const item = (side: "pg" | "my", i: number) => last[side].order!.items[i].id;
    const order = (side: "pg" | "my") => last[side].order!.id;

    await step(STAFF, "pos_add_item", () => ({ ...c(), p_table: t1, p_product: withOptions.id, p_option_ids: opts, p_quantity: 2, p_note: "  az   şekerli\n" }));
    await step(STAFF, "pos_add_item", () => ({ ...c(), p_table: t1, p_product: withOptions.id, p_option_ids: opts, p_quantity: 1, p_note: "az şekerli" }));
    await step(STAFF, "pos_add_item", () => ({ ...c(), p_table: t1, p_product: plain.id, p_quantity: 3 }));
    await step(STAFF, "pos_add_item", (s) => ({ ...c(), p_table: t1, p_product: joker[s], p_price: 12.345 }));
    await step(STAFF, "pos_add_item", (s) => ({ ...c(), p_table: t1, p_product: joker[s] }));
    await step(STAFF, "pos_add_item", () => ({ ...c(), p_table: t1, p_product: withOptions.id, p_option_ids: [] }));
    await step(STAFF, "pos_change_quantity", (s) => ({ ...c(), p_item: item(s, 1), p_delta: 2 }));
    await step(STAFF, "pos_change_quantity", (s) => ({ ...c(), p_item: item(s, 1), p_delta: -1 }));
    await step(STAFF, "pos_price_item", (s) => ({ ...c(), p_item: item(s, 1), p_unit_price: 41.15, p_unit_discount: 3.33 }));
    await step(STAFF, "pos_split_item", (s) => ({ ...c(), p_item: item(s, 0), p_parts: 3 }));
    await step(STAFF, "pos_update_order", (s) => ({ ...c(), p_order: order(s), p_note: "Pencere kenarı", p_discount: 7.5 }));
    await step(STAFF, "pos_update_order", (s) => ({ ...c(), p_order: order(s), p_note: "", p_discount: 100000 }));
    await step(STAFF, "pos_set_guests", (s) => ({ ...c(), p_order: order(s), p_guests: 3 }));
    await step(STAFF, "pos_pay_items", (s) => ({ ...c(), p_order: order(s), p_method: "card", p_lines: [{ item_id: item(s, 0), quantity: 1 }] }));
    await step(STAFF, "pos_pay_items", (s) => ({ ...c(), p_order: order(s), p_method: "cash", p_lines: [{ item_id: item(s, 0), quantity: 2 }, { item_id: item(s, 1), quantity: 1 }] }));
    await step(STAFF, "pos_remove_item", (s) => ({ ...c(), p_item: item(s, 0) }));
    await step(STAFF, "pos_pay", (s) => ({ ...c(), p_order: order(s), p_method: "ticket", p_amount: 10.005 }));
    await step(OWNER, "pos_change_payment_method", (s) => ({ ...c(), p_payment: last[s].order!.payments[0].id, p_method: "cash" }));
    await step(STAFF, "pos_add_item", () => ({ ...c(), p_table: t2, p_product: plain.id, p_quantity: 1 }));
    const t2order = { pg: last.pg.order!.id, my: last.my.order!.id };
    await step(STAFF, "pos_table_order", () => ({ ...c(), p_table: t1 }));
    await step(STAFF, "pos_move_order", (s) => ({ ...c(), p_order: t2order[s], p_target_table: t1 }));
    await step(STAFF, "pos_pay", (s) => ({ ...c(), p_order: order(s), p_method: "card", p_amount: 999999 }));
    await step(STAFF, "pos_pay", (s) => ({ ...c(), p_order: order(s), p_method: "card" }));
    await same(OWNER, "pos_floor", c);
    await same(OWNER, "report_z", () => ({ ...c(), p_date: day(0) }));
    await same(OWNER, "report_range", () => ({ ...c(), p_from: day(-1), p_to: day(0) }));
    await step(OWNER, "pos_reopen_order", (s) => ({ ...c(), p_order: order(s) }));
    await step(OWNER, "pos_void_order", (s) => ({ ...c(), p_order: order(s), p_reason: "Deneme" }));
    await same(OWNER, "pos_history", () => ({ ...c(), p_date: day(0) }));
  });

  it("menü, masa, ekip ve gider yönetimi aynı", async () => {
    await same(OWNER, "menu_save_category", () => ({ ...c(), p_category: { name: "  Yeni   Kategori ", subtitle: "x" } }));
    await same(OWNER, "menu_save_category", () => ({ ...c(), p_category: { name: "" } }));
    await same(OWNER, "menu_save_ingredient", () => ({ ...c(), p_ingredient: { name: "Deneme süt", unit: "ml", package_size: 1000, package_price: 42.555 } }));
    await same(OWNER, "menu_save_ingredient", () => ({ ...c(), p_ingredient: { name: "Kötü", unit: "kg", package_size: 1 } }));
    await same(OWNER, "menu_save_product", () => ({ ...c(), p_product: { name: "Deneme", price: 55.555, tags: ["vegan", "milk", "vegan"] } }));
    await same(OWNER, "menu_save_product", () => ({ ...c(), p_product: { name: "Kötü etiket", price: 1, tags: ["et"] } }));
    await same(OWNER, "menu_save_group", () => ({ ...c(), p_group: { name: "Boy", selection: "single", options: [{ name: "Küçük", is_default: true }, { name: "Büyük", price_delta: 10, is_default: true }, { name: " " }] } }));
    await same(OWNER, "menu_admin_data", c);
    await same(OWNER, "menu_recalculate_costs", () => ({ ...c(), p_from: day(-10), p_to: day(0) }));
    await same(OWNER, "report_range", () => ({ ...c(), p_from: day(-10), p_to: day(0) }));
    await same(OWNER, "tables_bulk_create", () => ({ ...c(), p_area: null, p_prefix: "B", p_from: 1, p_to: 5 }));
    await same(OWNER, "tables_bulk_create", () => ({ ...c(), p_area: null, p_prefix: "B", p_from: 3, p_to: 8 }));
    await same(OWNER, "tables_save_area", () => ({ ...c(), p_area: { name: "Teras" } }));
    await same(OWNER, "tables_admin_data", c);
    await same(OWNER, "team_set_permissions", (s) => ({ ...c(), p_user: sides[s].users[STAFF], p_permissions: { reports: true, figures: "all" } }));
    await same(OWNER, "team_set_permissions", (s) => ({ ...c(), p_user: sides[s].users[STAFF], p_permissions: { reports: "evet" } }));
    await same(OWNER, "team_list", c);
    await same(STAFF, "report_range", () => ({ ...c(), p_from: day(-3), p_to: day(0) }));
    await same(OWNER, "team_update_member", (s) => ({ ...c(), p_user: sides[s].users[OWNER], p_role: "staff", p_display_name: "Sahip" }));
    await same(OWNER, "finance_save_expense", () => ({ ...c(), p_expense: { kind: "monthly", category: "kira", name: "Kira", amount: 30000, starts_on: "2026-03-17", ends_on: "2026-12-02" } }));
    await same(OWNER, "finance_save_expense", () => ({ ...c(), p_expense: { kind: "one_time", category: "ekipman", name: "Değirmen", amount: 12500.499, starts_on: day(0), ends_on: "2027-01-01" } }));
    await same(OWNER, "finance_expenses", c);
    await same(OWNER, "report_z", () => ({ ...c(), p_date: day(0) }));
    await same(OWNER, "cafe_update_settings", () => ({ ...c(), p_settings: { name: "Opia", cash_count: true, vat_rate: 0.2, theme: "slate" } }));
    await same(STAFF, "pos_add_item", () => ({ ...c(), p_table: "00000000-0000-4000-8000-000000000001", p_product: "00000000-0000-4000-8000-000000000002" }));
    await same(STAFF, "day_open", () => ({ ...c(), p_opening_cash: 500.257 }));
    await same(STAFF, "day_status", c);
    await same(STAFF, "day_close", () => ({ ...c(), p_counted_cash: 480, p_note: "Eksik", p_pos_total: 100 }));
    await same(OWNER, "day_status", c);
    await same(OWNER, "demo_purge", c);
    await same(OWNER, "demo_status", c);
  });
});
