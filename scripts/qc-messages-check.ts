/**
 * ad_daily_metrics.messages_started dağılımını kontrol eder.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-messages-check.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data } = await sb
    .from("ad_daily_metrics")
    .select("ad_id, date, messages_started, leads, purchases, revenue, spend");
  const rows = data ?? [];
  const totalMsg = rows.reduce((s, r) => s + Number(r.messages_started ?? 0), 0);
  const totalLeads = rows.reduce((s, r) => s + Number(r.leads ?? 0), 0);
  const totalSpend = rows.reduce((s, r) => s + Number(r.spend ?? 0), 0);
  const nonZeroMsg = rows.filter((r) => Number(r.messages_started ?? 0) > 0);
  console.log(`Satır: ${rows.length}`);
  console.log(`Toplam messages_started: ${totalMsg}`);
  console.log(`Toplam leads: ${totalLeads}`);
  console.log(`Toplam spend: ${totalSpend.toFixed(2)}`);
  console.log(`messages_started>0 satır: ${nonZeroMsg.length}`);
  const dates = rows.map((r) => r.date).sort();
  console.log(`Tarih aralığı: ${dates[0]} — ${dates[dates.length - 1]}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
