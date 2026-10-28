import "server-only";
import type { Pool } from "mysql2/promise";

type Engine = typeof import("./engine");
type GlobalWithMysql = typeof globalThis & { __adisyonMysql?: Promise<{ pool: Pool; engine: Engine }> };

/**
 * Sunucu boyunca tek bağlantı havuzu. İlk kullanımda tablolar yoksa oluşturulur;
 * örnek veri yalnızca MYSQL_SEED_DEMO=1 ise yüklenir (canlıda kullanma).
 */
export function getMysql(): Promise<{ pool: Pool; engine: Engine }> {
  const g = globalThis as GlobalWithMysql;
  if (!g.__adisyonMysql) {
    g.__adisyonMysql = (async () => {
      const [{ getPool, migrateMysql }, engine] = await Promise.all([import("./db"), import("./engine")]);
      const pool = getPool();
      await migrateMysql(pool);
      if (process.env.MYSQL_SEED_DEMO === "1") await seedDev(pool, engine);
      return { pool, engine };
    })().catch((error) => {
      g.__adisyonMysql = undefined;
      throw error;
    });
  }
  return g.__adisyonMysql;
}

/** Yerel geliştirme: boş veritabanına Opia menüsü, logosu ve iki deneme hesabı */
async function seedDev(pool: Pool, engine: Engine) {
  const [{ OPIA_CAFE, OPIA_DEV_TEAM }, { readFile }, path] = await Promise.all([
    import("@/lib/seed/opia"),
    import("node:fs/promises"),
    import("node:path"),
  ]);
  const created = await engine.seedMysqlDatabase(pool, { cafes: [OPIA_CAFE], team: OPIA_DEV_TEAM });
  if (!created) return;
  const logo = await readFile(path.join(process.cwd(), "public", "opia", "logo.png"));
  await pool.query("UPDATE cafes SET logo = ? WHERE slug = ?", [`data:image/png;base64,${logo.toString("base64")}`, OPIA_CAFE.slug]);
}
