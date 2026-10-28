// Ekip yönetimi (team_*) fonksiyonları.

import type { Ctx, Row } from "./db";
import { assertOwnerRemains, cleanText, fail, iso, memberPerms, obj, parseJson, requireRole, roleRank, str, uuid } from "./helpers";

function role(value: unknown, fallback?: "staff"): "owner" | "manager" | "staff" {
  if ((value === null || value === undefined) && fallback) return fallback;
  if (value === "owner" || value === "manager" || value === "staff") return value;
  fail("E_INVALID_INPUT");
}

export async function team_list(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "owner");
  const rows = await ctx.all(
    `SELECT m.*, u.email FROM cafe_members m JOIN app_users u ON u.id = m.user_id WHERE m.cafe_id = ?`,
    [cafe],
  );
  rows.sort(
    (x, y) =>
      roleRank(y.role) - roleRank(x.role) ||
      (x.display_name < y.display_name ? -1 : x.display_name > y.display_name ? 1 : 0) ||
      (x.email < y.email ? -1 : x.email > y.email ? 1 : 0),
  );
  return rows.map((m) => ({
    user_id: m.user_id,
    email: m.email,
    display_name: m.display_name,
    role: m.role,
    permissions: memberPerms(m.role, m.permissions),
    custom_permissions: parseJson<Row>(m.permissions, {}),
    created_at: iso(m.created_at),
    is_self: m.user_id === ctx.uid,
  }));
}

export async function team_add_member(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const r = role(a.p_role, "staff");
  await requireRole(ctx, cafe, "owner");
  const user = await ctx.val<string>("SELECT id FROM app_users WHERE LOWER(email) = LOWER(?)", [(str(a.p_email) ?? "").trim()]);
  if (!user) fail("E_USER_NOT_FOUND");
  const name = cleanText(a.p_display_name, 60);
  await ctx.run(
    `INSERT INTO cafe_members (cafe_id, user_id, role, display_name, created_at, permissions) VALUES (?, ?, ?, ?, ?, '{}')
     ON DUPLICATE KEY UPDATE role = VALUES(role), display_name = VALUES(display_name)`,
    [cafe, user, r, name, ctx.now],
  );
  return { user_id: user };
}

async function currentRole(ctx: Ctx, cafe: string, user: string) {
  const current = await ctx.val<string>("SELECT role FROM cafe_members WHERE cafe_id = ? AND user_id = ?", [cafe, user]);
  if (!current) fail("E_NOT_FOUND");
  return current;
}

export async function team_update_member(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const user = uuid(a.p_user);
  const r = role(a.p_role);
  await requireRole(ctx, cafe, "owner");
  const current = await currentRole(ctx, cafe, user);
  if (current === "owner" && r !== "owner") await assertOwnerRemains(ctx, cafe, user);
  await ctx.run("UPDATE cafe_members SET role = ?, display_name = ? WHERE cafe_id = ? AND user_id = ?", [
    r,
    cleanText(a.p_display_name, 60),
    cafe,
    user,
  ]);
  return null;
}

export async function team_remove_member(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const user = uuid(a.p_user);
  await requireRole(ctx, cafe, "owner");
  const current = await currentRole(ctx, cafe, user);
  if (current === "owner") await assertOwnerRemains(ctx, cafe, user);
  await ctx.run("DELETE FROM cafe_members WHERE cafe_id = ? AND user_id = ?", [cafe, user]);
  return null;
}

const BOOL_KEYS = ["profit", "reports", "void", "payments", "discounts", "menu"];
const FIGURES = ["none", "today", "two_days", "all"];

export async function team_set_permissions(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  const user = uuid(a.p_user);
  await requireRole(ctx, cafe, "owner");
  const input = a.p_permissions === null || a.p_permissions === undefined ? {} : obj(a.p_permissions);
  if (!input || Array.isArray(input)) fail("E_INVALID_INPUT");

  const clean: Row = {};
  for (const key of Object.keys(input).sort()) {
    const v = input[key];
    if ((key === "figures" && typeof v === "string" && FIGURES.includes(v)) || (BOOL_KEYS.includes(key) && typeof v === "boolean")) {
      clean[key] = v;
    } else {
      fail("E_INVALID_INPUT");
    }
  }
  const res = await ctx.run("UPDATE cafe_members SET permissions = ? WHERE cafe_id = ? AND user_id = ?", [
    JSON.stringify(clean),
    cafe,
    user,
  ]);
  if (res.affectedRows === 0) {
    // MySQL değişmeyen satırı "etkilenmedi" sayar; üyeliğin varlığını ayrıca denetle
    if (!(await ctx.val("SELECT 1 FROM cafe_members WHERE cafe_id = ? AND user_id = ?", [cafe, user]))) fail("E_USER_NOT_FOUND");
  }
  return null;
}
