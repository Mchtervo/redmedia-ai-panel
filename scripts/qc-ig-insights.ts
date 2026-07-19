/**
 * instagram_media alanları ve instagram_media_insights doluluk kontrolü.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-ig-insights.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count: mediaCount } = await sb
    .from("instagram_media")
    .select("id", { count: "exact", head: true });
  const { count: insightCount } = await sb
    .from("instagram_media_insights")
    .select("id", { count: "exact", head: true });
  console.log(`instagram_media: ${mediaCount}`);
  console.log(`instagram_media_insights: ${insightCount}`);

  const { data: sample } = await sb
    .from("instagram_media_insights")
    .select("*")
    .limit(3);
  console.log("Örnek insight satırları:", JSON.stringify(sample, null, 2));

  const { data: media } = await sb
    .from("instagram_media")
    .select("media_type")
    .limit(1000);
  const types: Record<string, number> = {};
  for (const m of media ?? []) types[m.media_type ?? "null"] = (types[m.media_type ?? "null"] ?? 0) + 1;
  console.log(`Media tipleri: ${JSON.stringify(types)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
