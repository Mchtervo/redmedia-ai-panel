/**
 * Düzeltme sonrası insights + instagram senkronunu yeniden çalıştırır.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-resync-fixed.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { runManualMetaSync } = await import(
    "../src/features/marketing/services/meta-connection.service"
  );

  for (const kind of ["insights", "instagram"] as const) {
    const started = Date.now();
    const r = await runManualMetaSync(sb, kind);
    console.log(
      `${kind.toUpperCase()} — ${r.ok ? "OK" : "FAIL"} (${Date.now() - started}ms): ${r.message}`
    );
  }

  const { count: metricCount } = await sb
    .from("ad_daily_metrics")
    .select("*", { count: "exact", head: true });
  const { data: days } = await sb
    .from("ad_daily_metrics")
    .select("date");
  const uniqueDays = new Set((days ?? []).map((d) => d.date));
  const { data: media } = await sb
    .from("instagram_media")
    .select("media_type");
  const dist: Record<string, number> = {};
  for (const m of media ?? []) dist[m.media_type] = (dist[m.media_type] ?? 0) + 1;

  console.log(`\nad_daily_metrics satır: ${metricCount ?? 0}`);
  console.log(`Insight gün sayısı: ${uniqueDays.size}`);
  const sorted = [...uniqueDays].sort();
  if (sorted.length > 0)
    console.log(`Aralık: ${sorted[0]} → ${sorted[sorted.length - 1]}`);
  console.log(`Instagram medya tipleri: ${JSON.stringify(dist)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
