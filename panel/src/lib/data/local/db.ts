import "server-only";
import type { PGlite } from "@electric-sql/pglite";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data", "pglite");

type GlobalWithDb = typeof globalThis & { __adisyonLocalDb?: Promise<PGlite> };

/** Geliştirme sunucusu boyunca tek bir PGlite örneği (hot reload'da korunur) */
export function getLocalDb(): Promise<PGlite> {
  const g = globalThis as GlobalWithDb;
  if (!g.__adisyonLocalDb) {
    g.__adisyonLocalDb = (async () => {
      await mkdir(DATA_DIR, { recursive: true });
      const { openLocalDatabase, seedLocalDatabase } = await import("./engine");
      const db = await openLocalDatabase(DATA_DIR);
      await seedLocalDatabase(db);
      return db;
    })().catch((error) => {
      g.__adisyonLocalDb = undefined;
      throw error;
    });
  }
  return g.__adisyonLocalDb;
}
