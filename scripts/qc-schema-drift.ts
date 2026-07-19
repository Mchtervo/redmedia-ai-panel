/**
 * Canlı DB'de kod tipleriyle (Database) şema kayması var mı — kolon bazlı probe.
 * Her tabloda tip tanımındaki kolonları tek tek seçmeyi dener; 42703 = eksik kolon.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-schema-drift.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

// Sayfalarda aktif kullanılan kritik tablolar ve kod tarafının beklediği kolonlar
const EXPECTED: Record<string, string[]> = {
  knowledge_documents: [
    "id",
    "title",
    "category",
    "content",
    "review_status",
    "source_type",
    "source_conversation_id",
    "source_analysis_id",
    "faq_question",
    "suggested_answer",
    "example_good_reply",
    "example_bad_reply",
    "is_pricing_sensitive",
    "is_campaign_claim",
    "reviewed_by",
    "reviewed_at",
    "review_notes",
    "is_active",
  ],
  conversation_analyses: [
    "id",
    "conversation_id",
    "learning_status",
    "analyzed_at",
    "lead_score",
    "intent",
    "next_action",
  ],
  conversation_summaries: ["id", "conversation_id", "summary"],
  conversation_learning_runs: ["id", "status", "started_at"],
  contacts: ["id", "display_name", "username"],
  campaigns: ["id", "name", "status", "meta_campaign_id"],
  ad_daily_metrics: ["id", "metric_date", "spend", "impressions", "frequency", "cpm"],
  instagram_media: ["id", "meta_media_id", "media_type", "published_at"],
  customer_attributions: ["id", "contact_id", "attribution_status", "attribution_confidence"],
  attribution_funnel_events: ["id", "contact_id", "stage", "occurred_at"],
  marketing_daily_reports: ["id", "report_date", "summary_md"],
  reservations: ["id", "contact_id", "status", "event_date"],
  customer_profiles: ["id", "contact_id", "lifecycle_stage"],
  follow_up_tasks: ["id", "status", "due_at"],
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const missing: Record<string, string[]> = {};
  const tableErrors: string[] = [];

  for (const [table, cols] of Object.entries(EXPECTED)) {
    for (const col of cols) {
      const { error } = await sb
        .from(table as keyof Database["public"]["Tables"])
        .select(col)
        .limit(1);
      if (error) {
        if (error.code === "42703") {
          (missing[table] ??= []).push(col);
        } else {
          tableErrors.push(
            `${table}.${col}: ${error.code ?? "?"} ${error.message.slice(0, 80)}`
          );
        }
      }
    }
  }

  console.log("\n=== Eksik Kolonlar (42703) ===\n");
  if (Object.keys(missing).length === 0) console.log("Yok.");
  for (const [t, cols] of Object.entries(missing)) {
    console.log(`${t}: ${cols.join(", ")}`);
  }

  console.log("\n=== Diğer Hatalar ===\n");
  if (tableErrors.length === 0) console.log("Yok.");
  for (const e of tableErrors) console.log(`- ${e}`);
}

main();
