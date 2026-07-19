/**
 * Onay bekleyen tekrarlı knowledge önerilerini reddeder (aynı başlıktan 1 kalır).
 * npx tsx scripts/dedupe-pending-knowledge.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "@/server/supabase/admin";
import { normalizeKnowledgeTitle } from "@/features/learning/utils/dedupe-knowledge";

function loadEnv(): void {
  const raw = readFileSync(resolve(".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k && !(k in process.env)) process.env[k] = v;
  }
}

async function main(): Promise<void> {
  loadEnv();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("id, title, created_at")
    .eq("review_status", "pending_review")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const keep = new Set<string>();
  const rejectIds: string[] = [];

  for (const row of data ?? []) {
    const key = normalizeKnowledgeTitle(row.title);
    if (!key) {
      rejectIds.push(row.id);
      continue;
    }
    if (keep.has(key)) {
      rejectIds.push(row.id);
    } else {
      keep.add(key);
    }
  }

  console.log(
    JSON.stringify(
      {
        pending: data?.length ?? 0,
        uniqueTitles: keep.size,
        toReject: rejectIds.length,
      },
      null,
      2
    )
  );

  // Batch update
  const chunk = 50;
  for (let i = 0; i < rejectIds.length; i += chunk) {
    const ids = rejectIds.slice(i, i + chunk);
    const { error: updError } = await supabase
      .from("knowledge_documents")
      .update({
        review_status: "rejected",
        review_notes: "Otomatik dedupe: aynı başlıklı tekrar öneri",
      })
      .in("id", ids);
    if (updError) throw updError;
  }

  console.log("dedupe ok");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
