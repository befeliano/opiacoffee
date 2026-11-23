// src/lib/data/local/engine.test.ts → src/lib/data/mysql/engine.test.ts
// Yerel motor (PGlite) testinin aynısını MySQL motoruna uyarlar; yalnızca Postgres'e özgü birkaç yer değişir.
// Yerel teste test eklediğinde çalıştır:  node scripts/gen-mysql-test.mjs
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const src = fs.readFileSync(new URL("src/lib/data/local/engine.test.ts", root), "utf8");
let s = src;
const rep = (a, b) => {
  if (!s.includes(a)) throw new Error("bulunamadı: " + a.slice(0, 80));
  s = s.replace(a, b);
};

rep(
  "// Veritabanı API'sinin davranış ve güvenlik testleri (gerçek Postgres/PGlite)\n",
  "// Veritabanı API'sinin davranış ve güvenlik testleri, MySQL motoru (gerçek MySQL/MariaDB).\n" +
    "// scripts/gen-mysql-test.mjs ile local/engine.test.ts'ten üretilir; elle düzenleme.\n" +
    "// Çalıştırmak için: MYSQL_TEST_URL=mysql://kullanici:sifre@127.0.0.1:3306 (her test için geçici veritabanı açılır)\n",
);
rep('import { beforeAll, describe, expect, it } from "vitest";', 'import { afterAll, beforeAll, describe, expect, it } from "vitest";');
rep('import type { PGlite } from "@electric-sql/pglite";\n', 'import mysql, { type Pool } from "mysql2/promise";\nimport { randomBytes } from "node:crypto";\n');
rep(
  'import { createLocalUser, findLocalUser, localRpc, openLocalDatabase, seedLocalDatabase } from "./engine";\n',
  `import { createPool, migrateMysql, type Role } from "./db";
import { createMysqlUser, findMysqlUser, mysqlRpc, seedMysqlDatabase } from "./engine";
`,
);
rep(
  "const TEST_CAFES = [DEFAULT_CAFE, CAFE_B];\n",
  `const TEST_CAFES = [DEFAULT_CAFE, CAFE_B];

// Yerel motorun adlarıyla aynı yardımcılar (test gövdesi değişmesin)
const BASE_URL = (process.env.MYSQL_TEST_URL ?? "").replace(/\\/+$/, "");
const opened: { pool: Pool; name: string }[] = [];

async function openLocalDatabase(): Promise<Pool> {
  const name = \`adisyon_test_\${randomBytes(4).toString("hex")}\`;
  const admin = await mysql.createConnection({ uri: BASE_URL });
  await admin.query(\`CREATE DATABASE \${name} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin\`);
  await admin.end();
  const pool = createPool(\`\${BASE_URL}/\${name}\`);
  await migrateMysql(pool);
  opened.push({ pool, name });
  return pool;
}

const localRpc = <T>(pool: Pool, userId: string | null, fn: string, args: Record<string, unknown> = {}, opts: { role?: Role } = {}) =>
  mysqlRpc<T>(pool, userId, fn, args, opts);
const seedLocalDatabase = seedMysqlDatabase;
const findLocalUser = findMysqlUser;
const createLocalUser = createMysqlUser;

afterAll(async () => {
  if (!BASE_URL) return;
  const admin = await mysql.createConnection({ uri: BASE_URL });
  for (const { pool, name } of opened) {
    await pool.end();
    await admin.query(\`DROP DATABASE IF EXISTS \${name}\`);
  }
  await admin.end();
});
`,
);
rep("let db: PGlite;", "let db: Pool;");
rep("beforeAll(async () => {\n  db = await openLocalDatabase();", "beforeAll(async () => {\n  if (!BASE_URL) return;\n  db = await openLocalDatabase();");
rep(
  '  await db.query("select public.admin_add_member($1, $2, $3, $4)", [cafeA, users[MANAGER], "manager", "Müdür"]);',
  '  await localRpc(db, null, "admin_add_member", { p_cafe: cafeA, p_user: users[MANAGER], p_role: "manager", p_display_name: "Müdür" }, { role: "service_role" });',
);
rep(
  `    await expect(
      db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: as(OWNER), role: "authenticated" })]);
        await tx.exec("set local role authenticated");
        await tx.query("select * from public.products limit 1");
      }),
    ).rejects.toThrow(/permission denied/);
    await expect(localRpc(db, as(OWNER), "admin_import_orders", { p_cafe: cafeA, p_payload: {} })).rejects.toThrow(/permission denied/);`,
  `    // MySQL'de tablolara yalnızca sunucu erişir; kurulum fonksiyonları servis rolü ister
    await expect(localRpc(db, as(OWNER), "admin_import_orders", { p_cafe: cafeA, p_payload: {} })).rejects.toThrow("E_FORBIDDEN");
    await expect(localRpc(db, as(OWNER), "admin_create_cafe", { p_owner: null, p_owner_name: "", p_payload: {} })).rejects.toThrow("E_FORBIDDEN");`,
);
rep(
  '    await db.query("update public.cafes set ticket_commission_rate = 0.05 where id = $1", [cafeB]);',
  '    await db.query("UPDATE cafes SET ticket_commission_rate = 0.05 WHERE id = ?", [cafeB]);',
);
rep("    await fresh.close();\n", "");
rep('    await db.query("update public.cafes set lat = 39.785454, lon = 30.502377");', '    await db.query("UPDATE cafes SET lat = 39.785454, lon = 30.502377");');
// Tüm describe blokları MYSQL_TEST_URL yoksa atlanır
s = s.replace(/^describe\("/gm, 'describe.skipIf(!BASE_URL)("');
if (/PGlite|\$1/.test(s)) console.warn("uyarı: Postgres kalıntısı olabilir");
fs.writeFileSync(new URL("src/lib/data/mysql/engine.test.ts", root), s);
console.log("ok");
