import "server-only";
import type { LiveConfig } from "@/components/pos/live";
import { dataBackend, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/** Canlı güncelleme ayarı (yayınlanabilir anahtar zaten tarayıcıya açıktır) */
export function liveConfig(): LiveConfig {
  return dataBackend() === "supabase" ? { mode: "supabase", url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY } : { mode: "local" };
}
