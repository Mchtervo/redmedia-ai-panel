/**
 * Tek bir IG medya için insights metriklerini canlı API'de dener.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-ig-insight-probe.ts
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
  const token = await resolveMetaAccessToken(sb);
  if (!token) throw new Error("Token yok");

  const { data: media } = await sb
    .from("instagram_media")
    .select("meta_media_id, media_type")
    .in("media_type", ["REELS", "IMAGE"])
    .limit(4);

  const metricSets = [
    "reach,saved,shares,plays,total_interactions",
    "reach,saved,shares,views,total_interactions",
    "views",
  ];

  for (const m of media ?? []) {
    console.log(`\n--- ${m.media_type} ${m.meta_media_id} ---`);
    for (const metrics of metricSets) {
      const res = await fetch(
        `https://graph.facebook.com/v23.0/${m.meta_media_id}/insights?metric=${metrics}&access_token=${token.accessToken}`
      );
      const body: unknown = await res.json();
      const obj = body as {
        error?: { message?: string };
        data?: Array<{ name?: string; values?: Array<{ value?: number }> }>;
      };
      if (obj.error) {
        console.log(`  [${metrics}] HATA: ${obj.error.message}`);
      } else {
        const vals = (obj.data ?? [])
          .map((d) => `${d.name}=${d.values?.[0]?.value}`)
          .join(", ");
        console.log(`  [${metrics}] OK: ${vals}`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
