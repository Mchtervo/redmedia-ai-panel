/**
 * meta_connections satırlarının güncel durumunu listeler (QC).
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-check-connections.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Supabase env eksik.");
    process.exit(1);
  }
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sb
    .from("meta_connections")
    .select("connection_type, status, display_name, last_error, last_synced_at, updated_at")
    .order("connection_type");
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  for (const c of data ?? []) {
    console.log(
      `${c.connection_type.padEnd(20)} | ${String(c.status).padEnd(14)} | ${c.display_name ?? "-"} | err=${c.last_error ? c.last_error.slice(0, 60) : "-"} | updated=${c.updated_at}`
    );
  }
}

main();
