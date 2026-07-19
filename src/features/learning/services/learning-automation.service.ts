import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { analyzeConversationForLearning } from "@/features/learning/services/extract-conversation.service";
import {
  createLearningRun,
  finishLearningRun,
} from "@/features/learning/repositories/learning-runs.repository";
import type { LearningTriggerSource } from "@/features/learning/types";

type TypedSupabaseClient = SupabaseClient<Database>;

const IDLE_HOURS = 24;
const DEFAULT_BATCH_LIMIT = 20;

export type RunLearningBatchResult = {
  runId: string;
  scanned: number;
  analyzed: number;
  knowledgeProposed: number;
  skipped: number;
  failed: number;
};

async function listConversationIdsNeedingLearning(
  supabase: TypedSupabaseClient,
  limit: number
): Promise<string[]> {
  const idleBefore = new Date(
    Date.now() - IDLE_HOURS * 60 * 60 * 1000
  ).toISOString();

  // 1) Hiç öğrenilmemiş konuşmalar (tarihsel DM backfill — öncelik)
  const { data: neverLearned, error: neverError } = await supabase
    .from("conversations")
    .select("id, last_message_at, last_learned_at")
    .is("last_learned_at", null)
    .not("last_message_at", "is", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (neverError) {
    throw neverError;
  }

  // 2) Kapalı veya 24s+ idle ve yeni mesajı olanlar
  const { data: closed, error: closedError } = await supabase
    .from("conversations")
    .select("id, last_message_at, last_learned_at")
    .eq("status", "closed")
    .not("last_learned_at", "is", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (closedError) {
    throw closedError;
  }

  const { data: idle, error: idleError } = await supabase
    .from("conversations")
    .select("id, last_message_at, last_learned_at")
    .neq("status", "closed")
    .lt("last_message_at", idleBefore)
    .not("last_learned_at", "is", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (idleError) {
    throw idleError;
  }

  const stale = [...(closed ?? []), ...(idle ?? [])].filter((row) => {
    if (!row.last_message_at || !row.last_learned_at) {
      return false;
    }
    return row.last_learned_at < row.last_message_at;
  });

  const candidates = [...(neverLearned ?? []), ...stale];
  const unique = Array.from(new Set(candidates.map((row) => row.id)));
  return unique.slice(0, limit);
}

/**
 * Kapalı veya 24 saat idle konuşmaları analiz eder.
 */
export async function runConversationLearningBatch(
  supabase: TypedSupabaseClient,
  options?: {
    triggerSource?: LearningTriggerSource;
    limit?: number;
    conversationIds?: string[];
    force?: boolean;
  }
): Promise<RunLearningBatchResult> {
  const triggerSource = options?.triggerSource ?? "cron";
  const limit = options?.limit ?? DEFAULT_BATCH_LIMIT;
  const run = await createLearningRun(supabase, triggerSource);

  const ids =
    options?.conversationIds ??
    (await listConversationIdsNeedingLearning(supabase, limit));

  let analyzed = 0;
  let knowledgeProposed = 0;
  let skipped = 0;
  let failed = 0;

  for (const conversationId of ids) {
    try {
      const result = await analyzeConversationForLearning(
        supabase,
        conversationId,
        { force: options?.force }
      );

      if (result.skipped) {
        skipped += 1;
        continue;
      }

      analyzed += 1;
      knowledgeProposed += result.knowledgeProposed;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "unknown";
      console.error(
        "[conversation-learning] analiz hatası:",
        conversationId,
        message
      );
    }
  }

  const status =
    failed === 0
      ? "completed"
      : analyzed > 0
        ? "partial"
        : ids.length === 0
          ? "completed"
          : "failed";

  await finishLearningRun(supabase, {
    id: run.id,
    status,
    conversationsScanned: ids.length,
    conversationsAnalyzed: analyzed,
    knowledgeProposed,
    details: { skipped, failed },
  });

  return {
    runId: run.id,
    scanned: ids.length,
    analyzed,
    knowledgeProposed,
    skipped,
    failed,
  };
}

/**
 * Konuşma kapatıldığında tek konuşma öğrenmesi.
 */
export async function learnOnConversationClosed(
  supabase: TypedSupabaseClient,
  conversationId: string
): Promise<RunLearningBatchResult> {
  const result = await runConversationLearningBatch(supabase, {
    triggerSource: "conversation_closed",
    conversationIds: [conversationId],
    force: true,
  });

  // Lost Sale Analyzer → Conversation Recorder (gerçek outcome etiketi)
  try {
    const { analyzeLostSale } = await import(
      "@/features/ai/services/lost-sale-analyzer.service"
    );
    await analyzeLostSale(supabase, conversationId);
  } catch (error) {
    console.error(
      "[learning] lost-sale analyzer:",
      error instanceof Error ? error.message : "bilinmeyen"
    );
  }

  try {
    const { recordConversationOutcomeTag } = await import(
      "@/features/ai/services/conversation-recorder.service"
    );
    await recordConversationOutcomeTag(supabase, conversationId);
  } catch (error) {
    console.error(
      "[learning] conversation recorder:",
      error instanceof Error ? error.message : "bilinmeyen"
    );
  }

  return result;
}
