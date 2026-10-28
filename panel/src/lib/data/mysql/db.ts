// MySQL/MariaDB bağlantısı (Hostinger). Her RPC tek bir işlemde (transaction) çalışır;
// Postgres fonksiyonlarındaki gibi ya hepsi kaydedilir ya hiçbiri.
// Not: Bu modül "server-only" içermez; testler ve betikler de kullanır.

import mysql, { type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";
import { SCHEMA_COLUMNS, SCHEMA_SQL } from "./schema";

export type Role = "authenticated" | "anon" | "service_role";
export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let pool: Pool | null = null;

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL tanımlı değil (ör. mysql://kullanici:sifre@localhost:3306/veritabani).");
  return url;
}

export function createPool(url = databaseUrl()): Pool {
  return mysql.createPool({
    uri: url,
    connectionLimit: Number(process.env.DATABASE_POOL ?? 5),
    timezone: "Z",
    decimalNumbers: true,
    dateStrings: ["DATE"],
    charset: "utf8mb4",
    multipleStatements: false,
  });
}

export function getPool(): Pool {
  if (!pool) pool = createPool();
  return pool;
}

export async function closePool() {
  if (pool) await pool.end();
  pool = null;
}

/** Bir RPC çağrısının bağlamı: bağlantı, kimlik ve işlem anı (Postgres now() gibi işlem boyunca sabit) */
export class Ctx {
  constructor(
    readonly conn: PoolConnection,
    readonly uid: string | null,
    readonly role: Role,
    readonly now: Date,
  ) {}

  async all<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.conn.query<RowDataPacket[]>(sql, params);
    return rows as T[];
  }

  async one<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.all<T>(sql, params);
    return rows[0] ?? null;
  }

  async val<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const row = await this.one(sql, params);
    if (!row) return null;
    return Object.values(row)[0] as T;
  }

  async run(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
    const [res] = await this.conn.query<ResultSetHeader>(sql, params);
    return res;
  }
}

/** İşlem içinde çalıştırır; hata olursa geri alır */
export async function withTx<T>(
  p: Pool,
  uid: string | null,
  role: Role,
  fn: (ctx: Ctx) => Promise<T>,
): Promise<T> {
  const conn = await p.getConnection();
  try {
    await conn.query("SET time_zone = '+00:00', sql_mode = 'STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
    await conn.beginTransaction();
    const now = new Date();
    const result = await fn(new Ctx(conn, uid, role, now));
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback().catch(() => {});
    throw error;
  } finally {
    conn.release();
  }
}

/** Şemayı uygular (tablolar yoksa oluşturur) */
export async function migrateMysql(p: Pool) {
  for (const statement of schemaStatements()) await p.query(statement);
  for (const [table, column, ddl] of SCHEMA_COLUMNS) {
    const [rows] = await p.query<RowDataPacket[]>(
      "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [table, column],
    );
    if (!rows.length) await p.query(`ALTER TABLE ${table} ${ddl}`);
  }
}

export function schemaStatements(): string[] {
  return SCHEMA_SQL.split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
