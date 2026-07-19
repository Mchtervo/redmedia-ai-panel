/**
 * Meta IGSID backfill — ilk sayfa (limit=1) güvenilir; next Timeout verebilir.
 * npx tsx --env-file=.env.local scripts/meta-igsid-backfill.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import {
  captureMetaIgsidFromLatestThread,
  syncMetaIgsidsFromConversations,
} from "../src/features/marketing/services/meta/meta-igsid-sync.service";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Supabase env eksik");
    process.exit(1);
  }

  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: probeErr } = await sb
    .from("contacts")
    .select("id,meta_igsid")
    .limit(1);
  if (probeErr) {
    console.error("migration eksik:", probeErr.message);
    process.exit(1);
  }

  console.log("--- latest thread ---");
  const latest = await captureMetaIgsidFromLatestThread(sb);
  console.log(JSON.stringify(latest, null, 2));

  console.log("\n--- sync (max 8, next timeout olabilir) ---");
  const sync = await syncMetaIgsidsFromConversations(sb, {
    maxConversations: 8,
  });
  console.log(JSON.stringify(sync, null, 2));

  const { count } = await sb
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .not("meta_igsid", "is", null);

  const { data: sample } = await sb
    .from("contacts")
    .select("username,meta_igsid")
    .not("meta_igsid", "is", null)
    .limit(20);

  console.log("\n=== Özet ===");
  console.log({ with_igsid: count ?? 0, sample });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
