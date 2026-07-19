/**
 * campaigns / ad_sets / ads status dağılımı.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-status-dist.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const t of ["campaigns", "ad_sets", "ads"] as const) {
    const { data, error } = await sb.from(t).select("status");
    if (error) {
      console.log(`${t}: HATA ${error.message}`);
      continue;
    }
    const dist: Record<string, number> = {};
    for (const r of data ?? []) dist[String(r.status)] = (dist[String(r.status)] ?? 0) + 1;
    console.log(`${t}: ${JSON.stringify(dist)}`);
  }

  // Son 7 günde harcaması olan reklam var mı (aktiflik sinyali)
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const { data: recent } = await sb
    .from("ad_daily_metrics")
    .select("ad_id, date, spend")
    .gte("date", weekAgo)
    .lte("date", today)
    .gt("spend", 0);
  console.log(`Son 7 günde harcamalı metrik satırı: ${recent?.length ?? 0}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
