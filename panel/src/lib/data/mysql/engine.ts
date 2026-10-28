// MySQL motoru: Supabase RPC çağrılarının TypeScript karşılıklarını tek kapıdan sunar.
// Not: Bu modül "server-only" içermez; testler ve betikler de kullanır.

import { randomUUID } from "node:crypto";
import type { Pool } from "mysql2/promise";
import { CAFES, DEFAULT_CARD_COMMISSION, DEFAULT_TIMEZONE, buildCafePayload, type CafeDef } from "../../seed/menus";
import { generateDemoOrders } from "../../seed/demo";
import { demoExpenses } from "../../seed/expenses";
import { LOCAL_PASSWORD, TEAM, type TeamMemberSeed } from "../../seed/team";
import { hashPassword } from "../password";
import { type Ctx, type Role, type Row, withTx } from "./db";
import * as admin from "./admin";
import * as day from "./day";
import * as guest from "./guest";
import * as rain from "./rain";
import * as menu from "./menu";
import * as pos from "./pos";
import * as reports from "./reports";
import * as tables from "./tables";
import * as team from "./team";

type Fn = (ctx: Ctx, args: Row) => Promise<unknown>;

const FUNCTIONS: Record<string, Fn> = {
  app_brand: day.app_brand,
  app_my_cafes: day.app_my_cafes,
  app_cafe_context: day.app_cafe_context,
  cafe_set_logo: day.cafe_set_logo,
  cafe_update_settings: day.cafe_update_settings,
  day_status: day.day_status,
  day_open: day.day_open,
  day_close: day.day_close,

  pos_floor: pos.pos_floor,
  pos_menu: pos.pos_menu,
  pos_table_order: pos.pos_table_order,
  pos_add_item: pos.pos_add_item,
  pos_update_item: pos.pos_update_item,
  pos_remove_item: pos.pos_remove_item,
  pos_change_quantity: pos.pos_change_quantity,
  pos_pay: pos.pos_pay,
  pos_pay_items: pos.pos_pay_items,
  pos_delete_payment: pos.pos_delete_payment,
  pos_change_payment_method: pos.pos_change_payment_method,
  pos_cancel_order: pos.pos_cancel_order,
  pos_void_order: pos.pos_void_order,
  pos_reopen_order: pos.pos_reopen_order,
  pos_move_order: pos.pos_move_order,
  pos_split_item: pos.pos_split_item,
  pos_price_item: pos.pos_price_item,
  pos_set_guests: pos.pos_set_guests,
  pos_update_order: pos.pos_update_order,
  pos_history: pos.pos_history,

  menu_admin_data: menu.menu_admin_data,
  menu_save_category: menu.menu_save_category,
  menu_save_product: menu.menu_save_product,
  menu_save_group: menu.menu_save_group,
  menu_save_ingredient: menu.menu_save_ingredient,
  menu_delete_category: menu.menu_delete_category,
  menu_delete_group: menu.menu_delete_group,
  menu_delete_product: menu.menu_delete_product,
  menu_delete_ingredient: menu.menu_delete_ingredient,
  menu_set_product_active: menu.menu_set_product_active,
  menu_set_favorite: menu.menu_set_favorite,
  menu_reorder_favorites: menu.menu_reorder_favorites,
  menu_reorder: menu.menu_reorder,
  menu_recalculate_costs: menu.menu_recalculate_costs,

  tables_admin_data: tables.tables_admin_data,
  tables_save_area: tables.tables_save_area,
  tables_save_table: tables.tables_save_table,
  tables_bulk_create: tables.tables_bulk_create,
  tables_delete_area: tables.tables_delete_area,
  tables_delete_table: tables.tables_delete_table,

  team_list: team.team_list,
  team_add_member: team.team_add_member,
  team_update_member: team.team_update_member,
  team_remove_member: team.team_remove_member,
  team_set_permissions: team.team_set_permissions,

  report_range: reports.report_range,
  report_series: reports.report_series,
  report_products: reports.report_products,
  report_product_daily: reports.report_product_daily,
  report_z: reports.report_z,

  finance_expenses: admin.finance_expenses,
  finance_save_expense: admin.finance_save_expense,
  finance_delete_expense: admin.finance_delete_expense,
  demo_status: admin.demo_status,
  demo_purge: admin.demo_purge,

  admin_cafe_by_slug: admin.admin_cafe_by_slug,
  admin_add_member: admin.admin_add_member,
  admin_create_cafe: admin.admin_create_cafe,
  admin_import_orders: admin.admin_import_orders,
  admin_import_expenses: admin.admin_import_expenses,
  admin_apply_prices: admin.admin_apply_prices,
  admin_cafe_seed_ids: admin.admin_cafe_seed_ids,

  // Yalnızca MySQL sürümü: QR masa siparişi
  pos_guest_requests: guest.pos_guest_requests,
  pos_guest_update: guest.pos_guest_update,
  tables_qr: guest.tables_qr,
  tables_qr_reset: guest.tables_qr_reset,
  cafe_set_qr_ordering: guest.cafe_set_qr_ordering,

  // Yağmur uyarısı
  rain_targets: rain.rain_targets,
  rain_report: rain.rain_report,
  rain_get: rain.rain_get,
  rain_ack: rain.rain_ack,
};

export const MYSQL_FUNCTIONS = Object.keys(FUNCTIONS);

/** RPC çağrısı (Supabase davranışı): oturumdaki kullanıcının kimliğiyle, tek işlemde */
export async function mysqlRpc<T>(
  pool: Pool,
  userId: string | null,
  fn: string,
  args: Record<string, unknown> = {},
  opts: { role?: Role } = {},
): Promise<T> {
  const impl = Object.prototype.hasOwnProperty.call(FUNCTIONS, fn) ? FUNCTIONS[fn] : undefined;
  if (!impl) throw new Error(`Bilinmeyen fonksiyon: ${fn}`);
  const role = opts.role ?? (userId ? "authenticated" : "anon");
  // JSON gidiş-dönüşü: Supabase istemcisi de sonucu JSON olarak alır (undefined → null)
  const result = await withTx(pool, userId, role, (ctx) => impl(ctx, args ?? {}));
  return (result === undefined ? null : JSON.parse(JSON.stringify(result))) as T;
}

// ---------------------------------------------------------------------
// Kullanıcılar (Supabase Auth yerine)
// ---------------------------------------------------------------------
export async function findMysqlUser(pool: Pool, email: string) {
  const [rows] = await pool.query("SELECT id, email, encrypted_password FROM app_users WHERE LOWER(email) = LOWER(?)", [
    email.trim(),
  ]);
  return ((rows as Row[])[0] as { id: string; email: string; encrypted_password: string } | undefined) ?? null;
}

export async function getMysqlUser(pool: Pool, id: string) {
  const [rows] = await pool.query("SELECT id, email FROM app_users WHERE id = ?", [id]);
  return ((rows as Row[])[0] as { id: string; email: string } | undefined) ?? null;
}

export async function createMysqlUser(pool: Pool, email: string, password: string): Promise<string> {
  const id = randomUUID();
  await pool.query("INSERT INTO app_users (id, email, encrypted_password, created_at) VALUES (?, LOWER(?), ?, UTC_TIMESTAMP(6))", [
    id,
    email.trim(),
    hashPassword(password),
  ]);
  return id;
}

export async function setMysqlPassword(pool: Pool, userId: string, password: string) {
  await pool.query("UPDATE app_users SET encrypted_password = ? WHERE id = ?", [hashPassword(password), userId]);
}

// ---------------------------------------------------------------------
// İlk kurulum (yerel motorla aynı adımlar)
// ---------------------------------------------------------------------
export async function seedMysqlDatabase(
  pool: Pool,
  opts: { now?: Date; days?: number; withOrders?: boolean; cafes?: CafeDef[]; team?: TeamMemberSeed[] } = {},
): Promise<boolean> {
  const [existing] = await pool.query("SELECT COUNT(*) AS n FROM cafes");
  if (Number((existing as Row[])[0].n) > 0) return false;

  const now = opts.now ?? new Date();
  const cafes = opts.cafes ?? CAFES;
  const members = opts.team ?? TEAM;
  const password = (member: TeamMemberSeed) => (opts.team ? member.password : LOCAL_PASSWORD(member.key));
  const withOrders = opts.withOrders ?? (process.env.LOCAL_DEMO_DATA === "1" || process.env.NEXT_PUBLIC_DEMO_MODE === "1");
  const service = { role: "service_role" as const };

  const userIds = new Map<string, string>();
  for (const member of members) userIds.set(member.email, await createMysqlUser(pool, member.email, password(member)));
  const firstOwner = members.find((m) => m.memberships.some((x) => x.role === "owner"));

  let seed = 20260917;
  for (const def of cafes) {
    const { payload, ids } = buildCafePayload(def, { demo: withOrders, uuid: randomUUID });
    await mysqlRpc(pool, null, "admin_create_cafe", {
      p_owner: firstOwner ? userIds.get(firstOwner.email) : null,
      p_owner_name: firstOwner?.name ?? "",
      p_payload: payload,
    }, service);

    for (const member of members) {
      const membership = member.memberships.find((m) => m.slug === def.slug);
      if (!membership) continue;
      await mysqlRpc(pool, null, "admin_add_member", {
        p_cafe: ids.cafeId,
        p_user: userIds.get(member.email),
        p_role: membership.role,
        p_display_name: member.name,
      }, service);
    }

    if (withOrders) {
      const demo = generateDemoOrders(def, ids, {
        days: opts.days ?? 60,
        now,
        tz: def.timezone ?? DEFAULT_TIMEZONE,
        seed: seed++,
        commissionRate: def.cardCommissionRate ?? DEFAULT_CARD_COMMISSION,
        uuid: randomUUID,
      });
      const chunk = 800;
      for (let i = 0; i < demo.orders.length; i += chunk) {
        const orders = demo.orders.slice(i, i + chunk);
        const orderIds = new Set(orders.map((o) => o.id));
        await mysqlRpc(pool, null, "admin_import_orders", {
          p_cafe: ids.cafeId,
          p_payload: {
            orders,
            items: demo.items.filter((it) => orderIds.has(it.order_id)),
            payments: demo.payments.filter((pay) => orderIds.has(pay.order_id)),
          },
        }, service);
      }
      await mysqlRpc(pool, null, "admin_import_expenses", {
        p_cafe: ids.cafeId,
        p_payload: { expenses: demoExpenses(now) },
      }, service);
    }
  }
  return true;
}
