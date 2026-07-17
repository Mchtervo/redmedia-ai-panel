import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Sunucu tarafında (Server Component, Server Action, Route Handler)
 * kullanılacak Supabase istemcisi. `anon` key + istek çerezleri (cookies)
 * üzerinden oturum bilgisini okur; RLS politikalarına tabidir.
 *
 * Service role key bu dosyada asla kullanılmaz (bkz. src/server/supabase/admin.ts
 * ve .cursor/rules/02-security.mdc).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component içinden çerez yazılamaz; oturum yenileme
            // src/proxy.ts (Next.js 16 rota koruması) tarafından yapıldığı
            // için bu durum güvenle yok sayılabilir.
          }
        },
      },
    }
  );
}
