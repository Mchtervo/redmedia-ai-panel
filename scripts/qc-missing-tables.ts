/**
 * PGRST205 şüphesi olan tabloları canlı REST API üzerinde tek tek dener.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-missing-tables.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

const SUSPECT_TABLES = [
  "conversation_analyses",
  "conversation_summaries",
  "conversation_learning_runs",
  "follow_up_tasks",
  "satisfaction_tasks",
  "conversation_outcomes",
  "reminder_jobs",
  "payment_receipts",
  "payment_accounts",
  "reservations",
  "customer_profiles",
] as const;

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

  for (const table of SUSPECT_TABLES) {
    // Tip listesinde olmayan adları da denemek istiyoruz; tablo adı
    // çalışma zamanında REST'e gider, bu yüzden daraltılmış cast gerekli.
    const { count, error } = await sb
      .from(table as keyof Database["public"]["Tables"])
      .select("*", { count: "exact", head: true });
    console.log(
      error
        ? `FAIL | ${table.padEnd(28)} | ${error.code ?? "?"} ${error.message.slice(0, 90)}`
        : `OK   | ${table.padEnd(28)} | rows=${count ?? 0}`
    );
  }
}

main();
