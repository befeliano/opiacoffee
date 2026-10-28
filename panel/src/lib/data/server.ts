import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { CafeTheme } from "@/lib/api/types";
import { dataBackend } from "@/lib/env";
import { AppError, toAppError } from "@/lib/errors";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getLocalDb } from "./local/db";
import { LOCAL_SESSION_COOKIE, LOCAL_SESSION_MAX_AGE, signLocalSession, verifyLocalSession } from "./local/session";
import { getMysql } from "./mysql/server";
import { verifyPassword } from "./password";

// =====================================================================
// Veri Erişim Katmanı (DAL)
// Sayfalar ve sunucu eylemleri veritabanına yalnızca buradan erişir.
// Yetki kontrolünün asıl sahibi veritabanı fonksiyonlarıdır (MySQL'de
// src/lib/data/mysql/*.ts); bu katman oturumu çözer ve çağrıyı doğru
// kimlikle iletir. Supabase dışındaki iki motor (yerel PGlite, MySQL) aynı
// imzalı oturum çerezini kullanır.
// =====================================================================

export interface SessionUser {
  id: string;
  email: string;
}

const getSupabase = cache(createSupabaseServerClient);

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const backend = dataBackend();
  if (backend === "supabase") {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims?.sub) return null;
    return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
  }

  const store = await cookies();
  const userId = await verifyLocalSession(store.get(LOCAL_SESSION_COOKIE)?.value);
  if (!userId) return null;
  if (backend === "mysql") {
    const { pool, engine } = await getMysql();
    return engine.getMysqlUser(pool, userId);
  }
  const db = await getLocalDb();
  const res = await db.query<SessionUser>("select id, email from auth.users where id = $1", [userId]);
  return res.rows[0] ?? null;
});

/** Oturumdaki kullanıcının kimliğiyle bir veritabanı API fonksiyonu çağırır */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  try {
    const backend = dataBackend();
    if (backend === "supabase") {
      const supabase = await getSupabase();
      const { data, error } = await supabase.rpc(fn, args);
      if (error) throw error;
      return data as T;
    }
    const user = await getSessionUser();
    if (!user) throw new AppError("E_NOT_AUTHENTICATED");
    if (backend === "mysql") {
      const { pool, engine } = await getMysql();
      return await engine.mysqlRpc<T>(pool, user.id, fn, args);
    }
    const db = await getLocalDb();
    const { localRpc } = await import("./local/engine");
    return await localRpc<T>(db, user.id, fn, args);
  } catch (error) {
    throw toAppError(error);
  }
}

export interface Brand {
  name?: string;
  theme?: CafeTheme;
  logo?: string | null;
  language?: "tr" | "en";
}

/** Giriş ekranı için kafenin adı, rengi ve logosu (oturum gerekmez) */
export const getBrand = cache(async (): Promise<Brand> => {
  try {
    const backend = dataBackend();
    if (backend === "supabase") {
      const supabase = await getSupabase();
      const { data, error } = await supabase.rpc("app_brand");
      if (error) throw error;
      return (data ?? {}) as Brand;
    }
    if (backend === "mysql") {
      const { pool, engine } = await getMysql();
      return (await engine.mysqlRpc<Brand>(pool, null, "app_brand")) ?? {};
    }
    const db = await getLocalDb();
    const { localRpc } = await import("./local/engine");
    return (await localRpc<Brand>(db, null, "app_brand")) ?? {};
  } catch {
    return {};
  }
});

/**
 * Servis rolüyle (yalnızca admin_* kurulum fonksiyonları) çağrı. Çağıran
 * eylem, kullanıcının yetkisini önceden veritabanından doğrulamış olmalıdır.
 */
export async function serviceRpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  try {
    const backend = dataBackend();
    if (backend === "supabase") {
      const { data, error } = await createSupabaseAdminClient().rpc(fn, args);
      if (error) throw error;
      return data as T;
    }
    if (backend === "mysql") {
      const { pool, engine } = await getMysql();
      return await engine.mysqlRpc<T>(pool, null, fn, args, { role: "service_role" });
    }
    const db = await getLocalDb();
    const { localRpc } = await import("./local/engine");
    return await localRpc<T>(db, null, fn, args, { role: "service_role" });
  } catch (error) {
    throw toAppError(error);
  }
}

// ---------------------------------------------------------------------
// Giriş denemesi sınırı (sunucu örneği başına, en iyi çaba)
// ---------------------------------------------------------------------
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function checkRateLimit(key: string) {
  const now = Date.now();
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k);
  }
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) throw new AppError("E_RATE_LIMITED");
}

async function findUser(email: string) {
  if (dataBackend() === "mysql") {
    const { pool, engine } = await getMysql();
    return engine.findMysqlUser(pool, email);
  }
  const db = await getLocalDb();
  const { findLocalUser } = await import("./local/engine");
  return findLocalUser(db, email);
}

export async function signIn(email: string, password: string, clientKey: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  checkRateLimit(`${clientKey}|${normalized}`);

  if (dataBackend() === "supabase") {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email: normalized, password });
    if (error) {
      if (error.status === 429) throw new AppError("E_RATE_LIMITED");
      throw new AppError("E_INVALID_LOGIN");
    }
    attempts.delete(`${clientKey}|${normalized}`);
    return;
  }

  const user = await findUser(normalized);
  // Kullanıcı yoksa da aynı süreyi harca (zamanlama farkıyla hesap tespiti olmasın)
  const stored = user?.encrypted_password ?? `scrypt$${"0".repeat(32)}$${"0".repeat(64)}`;
  const ok = verifyPassword(password, stored);
  if (!user || !ok) throw new AppError("E_INVALID_LOGIN");

  attempts.delete(`${clientKey}|${normalized}`);
  const store = await cookies();
  store.set(LOCAL_SESSION_COOKIE, await signLocalSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LOCAL_SESSION_MAX_AGE,
  });
}

export async function signOut(): Promise<void> {
  if (dataBackend() === "supabase") {
    const supabase = await getSupabase();
    await supabase.auth.signOut();
    return;
  }
  const store = await cookies();
  store.delete(LOCAL_SESSION_COOKIE);
}

// ---------------------------------------------------------------------
// Hesap yönetimi — çağıran eylem, kullanıcının kafe sahibi olduğunu
// veritabanından doğrulamış olmalıdır.
// ---------------------------------------------------------------------

/** Hesap yoksa oluşturur. Hesap zaten varsa şifresine dokunmaz. */
export async function ensureAuthUser(email: string, password: string): Promise<{ created: boolean }> {
  const normalized = email.trim().toLowerCase();
  const backend = dataBackend();
  if (backend === "supabase") {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.createUser({ email: normalized, password, email_confirm: true });
    if (!error) return { created: true };
    if (/already|registered|exists/i.test(error.message)) return { created: false };
    if (/password/i.test(error.message)) throw new AppError("E_WEAK_PASSWORD");
    throw toAppError(error);
  }
  if (await findUser(normalized)) return { created: false };
  if (backend === "mysql") {
    const { pool, engine } = await getMysql();
    await engine.createMysqlUser(pool, normalized, password);
    return { created: true };
  }
  const db = await getLocalDb();
  const { createLocalUser } = await import("./local/engine");
  await createLocalUser(db, normalized, password);
  return { created: true };
}

export async function setAuthUserPassword(userId: string, password: string): Promise<void> {
  const backend = dataBackend();
  if (backend === "supabase") {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) {
      if (/password/i.test(error.message)) throw new AppError("E_WEAK_PASSWORD");
      throw toAppError(error);
    }
    return;
  }
  if (backend === "mysql") {
    const { pool, engine } = await getMysql();
    await engine.setMysqlPassword(pool, userId, password);
    return;
  }
  const db = await getLocalDb();
  const { setLocalPassword } = await import("./local/engine");
  await setLocalPassword(db, userId, password);
}

export async function isLocalMode() {
  return dataBackend() === "local";
}

/** QR masa siparişi gibi yalnızca MySQL sürümünde olan özellikler için */
export async function isMysqlMode() {
  return dataBackend() === "mysql";
}
