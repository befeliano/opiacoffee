// Ortam değişkenleri. NEXT_PUBLIC_ ile başlayanlar tarayıcıya da gömülür;
// gizli anahtarlar (SUPABASE_SECRET_KEY) yalnızca sunucuda okunur.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export type DataBackend = "supabase" | "local" | "mysql";

/**
 * Veri kaynağı: DATABASE_URL tanımlıysa MySQL (Hostinger), Supabase anahtarları
 * tanımlıysa Supabase, değilse yerel geliştirme veritabanı (PGlite).
 * DATA_BACKEND ile zorlanabilir.
 */
export function dataBackend(): DataBackend {
  const forced = process.env.DATA_BACKEND;
  if (forced === "local" || forced === "supabase" || forced === "mysql") return forced;
  if (process.env.DATABASE_URL) return "mysql";
  if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) return "supabase";
  if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
    throw new Error("Supabase ortam değişkenleri tanımlı değil (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).");
  }
  return "local";
}
