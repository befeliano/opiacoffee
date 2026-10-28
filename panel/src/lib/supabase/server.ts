import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/** İstek kapsamlı istemci: kullanıcının oturumuyla çalışır (RLS ve yetki kontrolleri geçerli) */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component içinden çerez yazılamaz; oturum yenilemesini proxy üstlenir.
        }
      },
    },
  });
}

/**
 * Servis anahtarlı yönetici istemcisi — yalnızca sunucuda, yetkisi önceden
 * doğrulanmış işlemler (personel hesabı açma, şifre sıfırlama) için.
 */
export function createSupabaseAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY tanımlı değil.");
  return createClient(SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
