/**
 * Tüm contact'lar için attribution eşleştirme + funnel rebuild çalıştırır.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-attribution-rebuild.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { rebuildAttributionFunnelForContact } = await import(
    "../src/features/marketing/services/attribution-funnel.service"
  );

  const { data: contacts, error } = await sb
    .from("contacts")
    .select("id, username, full_name");
  if (error) throw error;

  let ok = 0;
  let fail = 0;
  for (const c of contacts ?? []) {
    try {
      const r = await rebuildAttributionFunnelForContact(sb, c.id);
      ok += 1;
      console.log(
        `OK   | ${(c.full_name ?? c.username ?? c.id).slice(0, 24).padEnd(24)} | status=${r.attributionStatus} | events=${r.events.length}`
      );
    } catch (e) {
      fail += 1;
      console.log(
        `FAIL | ${(c.full_name ?? c.username ?? c.id).slice(0, 24).padEnd(24)} | ${e instanceof Error ? e.message.slice(0, 100) : "hata"}`
      );
    }
  }

  const { count: attrCount } = await sb
    .from("customer_attributions")
    .select("*", { count: "exact", head: true });
  const { count: funnelCount } = await sb
    .from("attribution_funnel_events")
    .select("*", { count: "exact", head: true });
  const { data: byStatus } = await sb
    .from("customer_attributions")
    .select("attribution_status");
  const dist: Record<string, number> = {};
  for (const a of byStatus ?? [])
    dist[a.attribution_status] = (dist[a.attribution_status] ?? 0) + 1;

  console.log(`\nContact: ${ok} başarılı, ${fail} hata`);
  console.log(`customer_attributions: ${attrCount ?? 0} | dağılım: ${JSON.stringify(dist)}`);
  console.log(`attribution_funnel_events: ${funnelCount ?? 0}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
