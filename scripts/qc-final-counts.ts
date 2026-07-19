/**
 * Nihai senkron sayıları — rapor için.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-final-counts.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tables = [
    "campaigns",
    "ad_sets",
    "ads",
    "ad_creatives",
    "ad_daily_metrics",
    "instagram_media",
    "customer_attributions",
    "attribution_funnel_events",
  ] as const;
  for (const t of tables) {
    const { count } = await sb.from(t).select("*", { count: "exact", head: true });
    console.log(`${t.padEnd(28)} ${String(count ?? 0).padStart(6)}`);
  }

  const { data: days } = await sb.from("ad_daily_metrics").select("date");
  console.log(`insight_gun_sayisi           ${new Set((days ?? []).map((d) => d.date)).size}`);

  const { data: media } = await sb.from("instagram_media").select("media_type");
  const dist: Record<string, number> = {};
  for (const m of media ?? []) dist[m.media_type] = (dist[m.media_type] ?? 0) + 1;
  console.log(`instagram_tipleri            ${JSON.stringify(dist)}`);

  const { data: attrs } = await sb
    .from("customer_attributions")
    .select("attribution_status");
  const adist: Record<string, number> = {};
  for (const a of attrs ?? [])
    adist[a.attribution_status] = (adist[a.attribution_status] ?? 0) + 1;
  console.log(`attribution_dagilimi         ${JSON.stringify(adist)}`);

  const { data: logs } = await sb
    .from("marketing_sync_logs")
    .select("sync_type, api_endpoint_kind, status, records_fetched, started_at")
    .order("started_at", { ascending: false })
    .limit(12);
  console.log("\nSon sync logları:");
  for (const l of logs ?? []) {
    console.log(
      `- ${l.started_at?.slice(0, 19)} | ${l.sync_type}${l.api_endpoint_kind ? "/" + l.api_endpoint_kind : ""} | ${l.status} | rec=${l.records_fetched}`
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
