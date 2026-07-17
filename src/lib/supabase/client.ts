import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Tarayıcıda (Client Component) kullanılacak Supabase istemcisi.
 * Yalnızca `anon` key kullanır; RLS politikalarına tabidir.
 * Service role key bu dosyada asla kullanılmaz (bkz. .cursor/rules/02-security.mdc).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
