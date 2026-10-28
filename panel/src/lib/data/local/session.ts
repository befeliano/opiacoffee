import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Yalnızca yerel demo modu için imzalı (HMAC-SHA256) oturum çerezi.
// Supabase modunda oturumu Supabase Auth yönetir.

export const LOCAL_SESSION_COOKIE = "ad_session";
export const LOCAL_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

let cachedSecret: Buffer | null = null;

async function getSecret(): Promise<Buffer> {
  if (cachedSecret) return cachedSecret;
  if (process.env.LOCAL_SESSION_SECRET && process.env.LOCAL_SESSION_SECRET.length >= 32) {
    cachedSecret = Buffer.from(process.env.LOCAL_SESSION_SECRET);
    return cachedSecret;
  }
  const file = path.join(process.cwd(), ".data", "session-secret");
  try {
    cachedSecret = Buffer.from((await readFile(file, "utf8")).trim(), "hex");
    if (cachedSecret.length < 32) throw new Error("kısa anahtar");
  } catch {
    cachedSecret = randomBytes(32);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, cachedSecret.toString("hex"), { mode: 0o600 });
  }
  return cachedSecret;
}

export async function signLocalSession(userId: string): Promise<string> {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + LOCAL_SESSION_MAX_AGE }),
  ).toString("base64url");
  const signature = createHmac("sha256", await getSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function verifyLocalSession(token: string | undefined): Promise<string | null> {
  if (!token || token.length > 512) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", await getSecret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown; exp?: unknown };
    if (typeof data.sub !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < Date.now() / 1000) return null;
    return data.sub;
  } catch {
    return null;
  }
}
