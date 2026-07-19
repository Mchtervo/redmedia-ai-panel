/**
 * Canlı Graph API'den kampanya status/effective_status örneklemi alır ve
 * DB'deki değerle karşılaştırır (status eşleme doğrulaması).
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-meta-status-check.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { resolveMetaAccessToken } = await import(
    "../src/features/marketing/services/meta/token.service"
  );
  const { graphGet } = await import(
    "../src/features/marketing/services/meta/graph-client"
  );

  const token = await resolveMetaAccessToken(sb);
  if (!token) {
    console.error("Token yok.");
    process.exit(1);
  }

  // Son 7 günde harcaması olan reklamların kampanyalarını örnekle
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const { data: spent } = await sb
    .from("ad_daily_metrics")
    .select("ad_id")
    .gte("date", weekAgo)
    .gt("spend", 0)
    .limit(5);
  const adIds = [...new Set((spent ?? []).map((s) => s.ad_id))].slice(0, 3);

  for (const adId of adIds) {
    const { data: ad } = await sb
      .from("ads")
      .select("meta_ad_id, name, status")
      .eq("id", adId)
      .maybeSingle();
    if (!ad) continue;
    const remote = await graphGet<{
      id?: string;
      status?: string;
      effective_status?: string;
    }>({
      accessToken: token.accessToken,
      path: ad.meta_ad_id,
      params: { fields: "id,status,effective_status" },
    });
    console.log(
      `${ad.name?.slice(0, 40).padEnd(40)} | DB=${ad.status} | Meta status=${remote.status} | effective=${remote.effective_status}`
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
