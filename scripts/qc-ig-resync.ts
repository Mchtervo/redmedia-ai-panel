/**
 * Instagram senkronunu (views düzeltmesi sonrası) yeniden çalıştırır.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-ig-resync.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { syncInstagramMedia } = await import(
    "../src/features/marketing/services/meta/meta-instagram-sync.service"
  );
  const res = await syncInstagramMedia(sb);
  console.log("Sonuç:", JSON.stringify(res));

  const { data } = await sb
    .from("instagram_media_insights")
    .select("reach, plays, saves, shares");
  const rows = data ?? [];
  const reach = rows.reduce((s, r) => s + (r.reach ?? 0), 0);
  const plays = rows.reduce((s, r) => s + (r.plays ?? 0), 0);
  const saves = rows.reduce((s, r) => s + (r.saves ?? 0), 0);
  console.log(
    `Toplam reach=${reach}, views(plays)=${plays}, saves=${saves}, satır=${rows.length}`
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
