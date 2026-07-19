"use server";

import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import {
  formatRealDmBatchReport,
  loadLatestRealDmBatch,
  runRealDmBatchAnalysis,
  type RealDmBatchSummary,
} from "@/features/ai/services/real-dm-batch.service";
import {
  formatHumanVsAiReport,
  runHumanVsAiBenchmark,
  type HumanVsAiResult,
} from "@/features/ai/benchmarks/human-vs-ai.service";
import { anonymizeDmText } from "@/features/ai/services/real-dm-anonymize";

async function requireSession(): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Oturum bulunamadı.");
}

const batchSchema = z.object({
  maxConversations: z.number().int().min(1).max(500).optional(),
  compareLimit: z.number().int().min(0).max(100).optional(),
  syncFirst: z.boolean().optional(),
});

export async function getLatestRealDmBatchAction(): Promise<
  | { success: true; data: RealDmBatchSummary | null }
  | { success: false; error: string }
> {
  try {
    await requireSession();
    return { success: true, data: await loadLatestRealDmBatch() };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Okuma başarısız",
    };
  }
}

export async function runRealDmBatchAction(
  input: z.infer<typeof batchSchema> = {}
): Promise<
  | { success: true; data: RealDmBatchSummary; reportText: string }
  | { success: false; error: string }
> {
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Geçersiz batch ayarı." };
  }

  try {
    await requireSession();
    const admin = createAdminClient();
    const summary = await runRealDmBatchAnalysis(admin, {
      maxConversations: parsed.data.maxConversations ?? 500,
      compareLimit: parsed.data.compareLimit ?? 0,
      syncFirst: parsed.data.syncFirst ?? true,
      maxHvATurns: 3,
    });
    return {
      success: true,
      data: summary,
      reportText: formatRealDmBatchReport(summary),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Gerçek DM analizi başarısız",
    };
  }
}

export async function compareRealDmConversationAction(
  conversationId: string
): Promise<
  | { success: true; data: HumanVsAiResult; reportText: string }
  | { success: false; error: string }
> {
  const id = z.string().uuid().safeParse(conversationId);
  if (!id.success) {
    return { success: false, error: "Geçersiz konuşma." };
  }

  try {
    await requireSession();
    const admin = createAdminClient();
    const result = await runHumanVsAiBenchmark(admin, id.data, {
      maxTurns: 4,
    });
    result.turns = result.turns.map((t) => ({
      ...t,
      customerMessage: anonymizeDmText(t.customerMessage),
      humanReply: anonymizeDmText(t.humanReply),
      aiReply: anonymizeDmText(t.aiReply),
      betterAlternative: t.betterAlternative
        ? anonymizeDmText(t.betterAlternative)
        : null,
    }));
    if (result.betterAlternativeOverall) {
      result.betterAlternativeOverall = anonymizeDmText(
        result.betterAlternativeOverall
      );
    }
    return {
      success: true,
      data: result,
      reportText: formatHumanVsAiReport(result),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Karşılaştırma başarısız",
    };
  }
}
