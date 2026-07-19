/**
 * Geçmiş DM konuşmalarını öğrenme motoruna çeker (paralel).
 * npx tsx scripts/run-dm-learning-batch.ts
 * npx tsx scripts/run-dm-learning-batch.ts --limit=60 --concurrency=3
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "@/server/supabase/admin";
import { runConversationLearningBatch } from "@/features/learning/services/learning-automation.service";
import { analyzeConversationForLearning } from "@/features/learning/services/extract-conversation.service";
import {
  createLearningRun,
  finishLearningRun,
} from "@/features/learning/repositories/learning-runs.repository";

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

function argNum(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const n = Number(hit.split("=")[1]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]!, i);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  loadEnv();
  const limit = argNum("limit", 40);
  const concurrency = argNum("concurrency", 3);
  const supabase = createAdminClient();

  // Hiç öğrenilmemiş + en az 2 mesajı olan konuşmalar
  const fetchLimit = Math.max(limit * 4, 80);
  const { data: rows, error } = await supabase
    .from("conversations")
    .select("id, last_message_at")
    .is("last_learned_at", null)
    .not("last_message_at", "is", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(fetchLimit);

  if (error) throw error;

  const ids: string[] = [];
  for (const row of rows ?? []) {
    if (ids.length >= limit) break;
    const { count, error: countError } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", row.id);
    if (countError) throw countError;
    if ((count ?? 0) >= 2) {
      ids.push(row.id);
    }
  }
  console.log(
    JSON.stringify({
      mode: "parallel-dm-backfill",
      limit,
      concurrency,
      queued: ids.length,
    })
  );

  if (ids.length === 0) {
    // Fallback: standart batch
    const result = await runConversationLearningBatch(supabase, {
      triggerSource: "manual",
      limit,
      force: true,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const run = await createLearningRun(supabase, "manual");
  let analyzed = 0;
  let knowledgeProposed = 0;
  let skipped = 0;
  let failed = 0;

  await mapPool(ids, concurrency, async (conversationId, index) => {
    const label = `[${index + 1}/${ids.length}] ${conversationId.slice(0, 8)}`;
    try {
      const result = await analyzeConversationForLearning(
        supabase,
        conversationId,
        { force: true }
      );
      if (result.skipped) {
        skipped += 1;
        console.log(label, "skipped", result.reason);
        return;
      }
      analyzed += 1;
      knowledgeProposed += result.knowledgeProposed;
      console.log(
        label,
        "ok",
        `knowledge=${result.knowledgeProposed}`
      );
    } catch (e) {
      failed += 1;
      console.error(
        label,
        "FAIL",
        e instanceof Error ? e.message : e
      );
    }
  });

  const status =
    failed === 0
      ? "completed"
      : analyzed > 0
        ? "partial"
        : "failed";

  await finishLearningRun(supabase, {
    id: run.id,
    status,
    conversationsScanned: ids.length,
    conversationsAnalyzed: analyzed,
    knowledgeProposed,
    details: { skipped, failed, concurrency },
  });

  console.log(
    JSON.stringify(
      {
        runId: run.id,
        status,
        scanned: ids.length,
        analyzed,
        knowledgeProposed,
        skipped,
        failed,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
