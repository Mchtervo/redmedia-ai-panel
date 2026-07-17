import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service role key ile çalışan yönetimsel Supabase istemcisi.
 * RLS'yi bypass eder — bu dosya YALNIZCA sunucu tarafı kodda
 * (Server Action, Route Handler) import edilebilir; hiçbir Client
 * Component bu modülü doğrudan veya dolaylı olarak import etmemelidir
 * (bkz. .cursor/rules/02-security.mdc).
 *
 * Service role key hiçbir zaman loglanmaz veya istemciye gönderilmez.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() yalnizca sunucu tarafinda cagrilabilir."
    );
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
