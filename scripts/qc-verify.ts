/**
 * Kalite kontrol: migration tablolarını, veri sayılarını ve status
 * constraint'lerini canlı Supabase üzerinde doğrular. Secret loglanmaz.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-verify.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

type TableName = keyof Database["public"]["Tables"];

const TABLES: Array<{ table: TableName; migration: string }> = [
  { table: "profiles", migration: "000002" },
  { table: "ad_accounts", migration: "000003" },
  { table: "campaigns", migration: "000003" },
  { table: "ad_sets", migration: "000003" },
  { table: "ads", migration: "000003" },
  { table: "ad_creatives", migration: "000003" },
  { table: "ad_daily_metrics", migration: "000003" },
  { table: "contacts", migration: "000004" },
  { table: "conversations", migration: "000004" },
  { table: "lead_profiles", migration: "000005" },
  { table: "knowledge_documents", migration: "000006" },
  { table: "ai_runs", migration: "000007" },
  { table: "attribution_events", migration: "000009" },
  { table: "conversation_analyses", migration: "000011" },
  { table: "customer_profiles", migration: "000012" },
  { table: "reservations", migration: "000013" },
  { table: "payment_receipts", migration: "000014" },
  { table: "follow_up_tasks", migration: "000015" },
  { table: "staff_members", migration: "000017" },
  { table: "knowledge_candidates", migration: "000018" },
  { table: "customer_timeline_events", migration: "000019" },
  { table: "ceo_daily_briefs", migration: "000020" },
  { table: "ceo_daily_reports", migration: "000020" },
  { table: "meta_connections", migration: "000021" },
  { table: "instagram_media", migration: "000021" },
  { table: "customer_attributions", migration: "000021" },
  { table: "attribution_audit_logs", migration: "000021" },
  { table: "marketing_strategies", migration: "000021" },
  { table: "marketing_learnings", migration: "000021" },
  { table: "marketing_sync_logs", migration: "000021" },
  { table: "meta_oauth_tokens", migration: "000022" },
  { table: "attribution_funnel_events", migration: "000024" },
  { table: "marketing_daily_reports", migration: "000024" },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Supabase env eksik.");
    process.exit(1);
  }
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("\n=== 1) Migration / Tablo Doğrulama ===\n");
  const missing: string[] = [];
  for (const { table, migration } of TABLES) {
    const started = Date.now();
    const { count, error } = await sb
      .from(table)
      .select("*", { count: "exact", head: true });
    const ms = Date.now() - started;
    if (error) {
      missing.push(`${table} (${migration}): ${error.message.slice(0, 80)}`);
      console.log(`FAIL | ${String(table).padEnd(28)} | ${error.message.slice(0, 80)}`);
    } else {
      console.log(
        `OK   | ${String(table).padEnd(28)} | rows=${String(count ?? 0).padStart(5)} | ${ms}ms`
      );
    }
  }

  // 000023: configured status constraint kontrolü
  console.log("\n=== 2) Migration 000023 (configured status) ===\n");
  const probe = await sb
    .from("meta_connections")
    .update({ status: "configured" })
    .eq("connection_type", "conversions_api")
    .select("connection_type, status");
  if (probe.error) {
    console.log(`FAIL | configured status reddedildi: ${probe.error.message.slice(0, 120)}`);
    missing.push("meta_connections.status 'configured' (000023 uygulanmamış olabilir)");
  } else {
    console.log("OK   | 'configured' status kabul edildi (000023 uygulanmış)");
  }

  // marketing_learnings yeni kolonlar (000024)
  const learnCol = await sb
    .from("marketing_learnings")
    .select("id, source_reservation_id, source_contact_id")
    .limit(1);
  console.log(
    learnCol.error
      ? `FAIL | marketing_learnings.source_* kolonları: ${learnCol.error.message.slice(0, 100)}`
      : "OK   | marketing_learnings.source_reservation_id / source_contact_id mevcut"
  );
  if (learnCol.error) missing.push("marketing_learnings source_* kolonları (000024)");

  // ad_daily_metrics genişletme (000021)
  const admCol = await sb
    .from("ad_daily_metrics")
    .select("id, frequency, cpm, cpc, ctr")
    .limit(1);
  console.log(
    admCol.error
      ? `FAIL | ad_daily_metrics frequency/cpm/cpc/ctr: ${admCol.error.message.slice(0, 100)}`
      : "OK   | ad_daily_metrics frequency/cpm/cpc/ctr mevcut"
  );
  if (admCol.error) missing.push("ad_daily_metrics ek kolonlar (000021)");

  console.log("\n=== 3) Veri Durumu Özeti ===\n");
  const counts: Record<string, number> = {};
  for (const t of [
    "contacts",
    "conversations",
    "customer_profiles",
    "reservations",
    "campaigns",
    "ad_sets",
    "ads",
    "ad_daily_metrics",
    "instagram_media",
    "customer_attributions",
    "attribution_funnel_events",
    "marketing_daily_reports",
    "ceo_daily_reports",
    "meta_oauth_tokens",
    "marketing_sync_logs",
  ] as TableName[]) {
    const { count } = await sb
      .from(t)
      .select("*", { count: "exact", head: true });
    counts[t] = count ?? 0;
  }
  for (const [t, c] of Object.entries(counts)) {
    console.log(`${t.padEnd(28)} ${String(c).padStart(6)}`);
  }

  const { data: activeToken } = await sb
    .from("meta_oauth_tokens")
    .select("id, expires_at, is_active, updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log(
    `\nAktif OAuth token: ${
      activeToken
        ? `VAR (expires=${activeToken.expires_at ?? "uzun ömürlü"})`
        : "YOK — panelden Meta'ya Bağlan gerekli"
    }`
  );

  const { data: lastLogs } = await sb
    .from("marketing_sync_logs")
    .select("sync_type, api_endpoint_kind, status, records_fetched, error_message, started_at")
    .order("started_at", { ascending: false })
    .limit(8);
  console.log("\nSon sync logları:");
  for (const l of lastLogs ?? []) {
    console.log(
      `- ${l.started_at} | ${l.sync_type}${l.api_endpoint_kind ? "/" + l.api_endpoint_kind : ""} | ${l.status} | rec=${l.records_fetched}${l.error_message ? " | " + l.error_message.slice(0, 60) : ""}`
    );
  }

  console.log("\n=== Sonuç ===");
  if (missing.length === 0) {
    console.log("Tüm migration tabloları/kolonları canlı veritabanında doğrulandı.");
  } else {
    console.log(`${missing.length} eksik/sorunlu öğe:`);
    for (const m of missing) console.log(`- ${m}`);
  }
  process.exit(missing.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("QC doğrulama hatası:", e instanceof Error ? e.message : e);
  process.exit(1);
});
