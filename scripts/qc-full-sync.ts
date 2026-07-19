/**
 * İlk gerçek tam Meta senkronizasyonu — adım adım çalıştırır ve her adımda
 * Supabase'e yazılan gerçek satır sayısını (önce/sonra) doğrular.
 * "Başarılı ama 0 kayıt" durumlarını ayrıca işaretler.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-full-sync.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

type TableName = keyof Database["public"]["Tables"];

async function tableCount(
  sb: ReturnType<typeof createClient<Database>>,
  table: TableName
): Promise<number> {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

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

  const { runManualMetaSync } = await import(
    "../src/features/marketing/services/meta-connection.service"
  );

  const steps: Array<{
    kind: "campaigns" | "adsets" | "ads" | "insights" | "instagram";
    tables: TableName[];
  }> = [
    { kind: "campaigns", tables: ["campaigns", "ad_accounts"] },
    { kind: "adsets", tables: ["ad_sets"] },
    { kind: "ads", tables: ["ads", "ad_creatives"] },
    { kind: "insights", tables: ["ad_daily_metrics"] },
    { kind: "instagram", tables: ["instagram_media"] },
  ];

  const warnings: string[] = [];

  for (const step of steps) {
    const before: Record<string, number> = {};
    for (const t of step.tables) before[t] = await tableCount(sb, t);

    const started = Date.now();
    const r = await runManualMetaSync(sb, step.kind);
    const ms = Date.now() - started;

    const after: Record<string, number> = {};
    for (const t of step.tables) after[t] = await tableCount(sb, t);

    const deltas = step.tables
      .map((t) => `${t}: ${before[t]}→${after[t]}`)
      .join(", ");
    const fetched = r.parts.reduce((s, p) => s + p.records, 0);

    console.log(
      `\n=== ${step.kind.toUpperCase()} — ${r.ok ? "OK" : "FAIL"} (${ms}ms) ===`
    );
    console.log(`mesaj   : ${r.message}`);
    console.log(`API'den : ${fetched} kayıt`);
    console.log(`DB      : ${deltas}`);

    if (r.ok && fetched === 0) {
      warnings.push(
        `${step.kind}: başarılı log ama API 0 kayıt döndürdü — izin/ID/tarih aralığı kontrol edilmeli`
      );
    }
    const wroteNothing = step.tables.every((t) => after[t] === before[t]);
    if (r.ok && fetched > 0 && wroteNothing) {
      warnings.push(
        `${step.kind}: API ${fetched} kayıt döndürdü ama DB satır sayısı değişmedi — upsert güncelleme olabilir, kontrol edilmeli`
      );
    }
  }

  console.log("\n=== Nihai Sayılar ===\n");
  const finalTables: TableName[] = [
    "ad_accounts",
    "campaigns",
    "ad_sets",
    "ads",
    "ad_creatives",
    "ad_daily_metrics",
    "instagram_media",
    "customer_attributions",
    "attribution_funnel_events",
  ];
  for (const t of finalTables) {
    console.log(`${String(t).padEnd(28)} ${String(await tableCount(sb, t)).padStart(6)}`);
  }

  // Instagram medya tipi dağılımı (post / reels ayrımı için)
  const { data: media } = await sb
    .from("instagram_media")
    .select("media_type");
  const dist: Record<string, number> = {};
  for (const m of media ?? []) dist[m.media_type] = (dist[m.media_type] ?? 0) + 1;
  console.log("\nInstagram medya tipleri:", JSON.stringify(dist));

  // Insights gün sayısı
  const { data: days } = await sb
    .from("ad_daily_metrics")
    .select("date")
    .order("date", { ascending: true });
  const uniqueDays = new Set((days ?? []).map((d) => d.date));
  console.log(`Insight gün sayısı: ${uniqueDays.size}`);
  if (uniqueDays.size > 0) {
    const sorted = [...uniqueDays].sort();
    console.log(`Aralık: ${sorted[0]} → ${sorted[sorted.length - 1]}`);
  }

  if (warnings.length > 0) {
    console.log("\n=== İncelenmesi Gerekenler ===");
    for (const w of warnings) console.log(`! ${w}`);
  } else {
    console.log("\nUyarı yok — tüm adımlar veri yazdı.");
  }
}

main().catch((e) => {
  console.error("Tam senkron hatası:", e instanceof Error ? e.message : e);
  process.exit(1);
});
