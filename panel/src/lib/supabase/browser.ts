"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Yalnızca canlı güncellemeler (Realtime) için kullanılır; veri okuma/yazma sunucudan geçer. */
export function getBrowserSupabase(url: string, key: string): SupabaseClient {
  if (!client) client = createBrowserClient(url, key);
  return client;
}
