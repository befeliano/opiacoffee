// Yerel geliştirme veritabanı (PGlite = WebAssembly Postgres).
// Supabase ile birebir aynı migration'ları çalıştırır; Supabase anahtarları
// tanımlanmadığında uygulama bu motorla tam işlevli çalışır.
// Not: Bu modül "server-only" içermez; testler ve betikler de kullanır.

import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { CAFES, DEFAULT_CARD_COMMISSION, DEFAULT_TIMEZONE, buildCafePayload, type CafeDef } from "../../seed/menus";
import { generateDemoOrders } from "../../seed/demo";
import { demoExpenses } from "../../seed/expenses";
import { LOCAL_PASSWORD, TEAM, type TeamMemberSeed } from "../../seed/team";

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const BOOTSTRAP_FILE = path.join(ROOT, "supabase", "local", "bootstrap.sql");

/** Yerel modda hazır hesaplar (demo ekip + parolaları) */
export const LOCAL_ACCOUNTS = TEAM.map((member) => ({
  email: member.email,
  password: LOCAL_PASSWORD(member.key),
  name: member.name,
  memberships: member.memberships,
}));

export async function openLocalDatabase(dataDir?: string): Promise<PGlite> {
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  await db.waitReady;
  await migrate(db);
  return db;
}

export async function migrate(db: PGlite) {
  await db.exec(await readFile(BOOTSTRAP_FILE, "utf8"));
  const applied = new Set(
    (await db.query<{ name: string }>("select name from local_meta.migrations")).rows.map((r) => r.name),
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into local_meta.migrations (name) values ($1)", [file]);
    });
  }
}

// ---------------------------------------------------------------------
// Parola ve oturum yardımcıları (yalnızca yerel mod)
// ---------------------------------------------------------------------
export { hashPassword, verifyPassword } from "../password";
import { hashPassword } from "../password";

export async function findLocalUser(db: PGlite, email: string) {
  const res = await db.query<{ id: string; email: string; encrypted_password: string }>(
    "select id, email, encrypted_password from auth.users where lower(email) = lower($1)",
    [email.trim()],
  );
  return res.rows[0] ?? null;
}

export async function createLocalUser(db: PGlite, email: string, password: string): Promise<string> {
  const res = await db.query<{ id: string }>(
    "insert into auth.users (email, encrypted_password) values (lower($1), $2) returning id",
    [email.trim(), hashPassword(password)],
  );
  return res.rows[0].id;
}

export async function setLocalPassword(db: PGlite, userId: string, password: string) {
  await db.query("update auth.users set encrypted_password = $2 where id = $1", [userId, hashPassword(password)]);
}

// ---------------------------------------------------------------------
// RPC: Supabase/PostgREST davranışını taklit eder. Fonksiyon, oturumdaki
// kullanıcının kimliğiyle ve "authenticated" rolüyle çalışır.
// ---------------------------------------------------------------------
const IDENT = /^[a-z_][a-z0-9_]*$/;

export async function localRpc<T>(
  db: PGlite,
  userId: string | null,
  fn: string,
  args: Record<string, unknown> = {},
  opts: { role?: "authenticated" | "anon" | "service_role" } = {},
): Promise<T> {
  if (!IDENT.test(fn)) throw new Error("Geçersiz fonksiyon adı");
  const keys = Object.keys(args);
  for (const key of keys) if (!IDENT.test(key)) throw new Error("Geçersiz parametre adı");

  const role = opts.role ?? (userId ? "authenticated" : "anon");
  const claims = JSON.stringify(userId ? { sub: userId, role } : { role });
  const params = keys.map((k) => serializeParam(args[k]));
  const call = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as result`;

  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await tx.exec(`set local role ${role}`);
    const res = await tx.query<{ result: T }>(call, params);
    return res.rows[0]?.result as T;
  });
}

function serializeParam(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

// ---------------------------------------------------------------------
// Demo verisiyle ilk kurulum
// ---------------------------------------------------------------------
export async function seedLocalDatabase(
  db: PGlite,
  opts: { now?: Date; days?: number; withOrders?: boolean; cafes?: CafeDef[]; team?: TeamMemberSeed[] } = {},
): Promise<boolean> {
  const existing = await db.query<{ n: number }>("select count(*)::int as n from public.cafes");
  if (existing.rows[0].n > 0) return false;

  const now = opts.now ?? new Date();
  const cafes = opts.cafes ?? CAFES;
  const team = opts.team ?? TEAM;
  const password = (member: TeamMemberSeed) => (opts.team ? member.password : LOCAL_PASSWORD(member.key));
  // Örnek satış verisi yalnızca istenirse yüklenir (LOCAL_DEMO_DATA=1 ya da demo modu)
  const withOrders = opts.withOrders ?? (process.env.LOCAL_DEMO_DATA === "1" || process.env.NEXT_PUBLIC_DEMO_MODE === "1");

  const userIds = new Map<string, string>();
  for (const member of team) {
    userIds.set(member.email, await createLocalUser(db, member.email, password(member)));
  }
  const firstOwner = team.find((m) => m.memberships.some((x) => x.role === "owner"));

  let seed = 20260917;
  for (const def of cafes) {
    const { payload, ids } = buildCafePayload(def, { demo: withOrders, uuid: randomUUID });
    await db.query("select public.admin_create_cafe($1, $2, $3)", [
      firstOwner ? userIds.get(firstOwner.email) : null,
      firstOwner?.name ?? "",
      JSON.stringify(payload),
    ]);

    for (const member of team) {
      const membership = member.memberships.find((m) => m.slug === def.slug);
      if (!membership) continue;
      await db.query("select public.admin_add_member($1, $2, $3, $4)", [
        ids.cafeId,
        userIds.get(member.email),
        membership.role,
        member.name,
      ]);
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
        await db.query("select public.admin_import_orders($1, $2)", [
          ids.cafeId,
          JSON.stringify({
            orders,
            items: demo.items.filter((it) => orderIds.has(it.order_id)),
            payments: demo.payments.filter((pay) => orderIds.has(pay.order_id)),
          }),
        ]);
      }
      await db.query("select public.admin_import_expenses($1, $2)", [
        ids.cafeId,
        JSON.stringify({ expenses: demoExpenses(now) }),
      ]);
    }
  }

  // Planlayıcı istatistikleri (yerelde autovacuum yok)
  await db.exec("analyze");
  return true;
}
