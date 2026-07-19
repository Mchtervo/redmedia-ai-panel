/**
 * clicks>impressions olan metrik satırını ve campaign status dağılımını inceler.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-anomaly-row.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: metrics } = await sb
    .from("ad_daily_metrics")
    .select("ad_id, date, spend, impressions, clicks, reach, ctr, cpm, cpc");
  for (const m of metrics ?? []) {
    if (Number(m.clicks) > Number(m.impressions)) {
      console.log("Anomali satır:", JSON.stringify(m));
      const { data: ad } = await sb
        .from("ads")
        .select("name, meta_ad_id")
        .eq("id", m.ad_id)
        .maybeSingle();
      console.log("Reklam:", JSON.stringify(ad));
    }
  }

  const { data: camps } = await sb.from("campaigns").select("status");
  const dist: Record<string, number> = {};
  for (const c of camps ?? []) {
    const k = `status=${c.status}`;
    dist[k] = (dist[k] ?? 0) + 1;
  }
  console.log("\nCampaign status dağılımı:");
  for (const [k, n] of Object.entries(dist)) console.log(`  ${k}: ${n}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
