import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getCatalogLabSummary,
  type CatalogLabSummary,
} from "@/features/ai/services/catalog-prompt.service";
import { listRecentLearningRuns } from "@/features/learning/repositories/learning-runs.repository";
import type { LearningRunRow } from "@/features/learning/types";
import { loadSalesLearningContext } from "@/features/sales-learning/services/sales-context.service";
import type {
  AiMistakeRow,
  CompanyPersonalityTraitRow,
  SalesPatternRow,
} from "@/features/sales-learning/types";
import { isOpenAiConfigured } from "@/lib/ai/openai-client";
import { isAiFeatureEnabled } from "@/features/settings/services/ai-feature-flags.service";

type TypedSupabaseClient = SupabaseClient<Database>;

export type AssistantLabLearningStatus = {
  patternCount: number;
  personalityCount: number;
  activeMistakeCount: number;
  bestConversationCount: number;
  pendingLearnApprox: number;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunAnalyzed: number | null;
};

export type AssistantLabDashboardData = {
  catalog: CatalogLabSummary;
  personality: CompanyPersonalityTraitRow[];
  topPatterns: SalesPatternRow[];
  activeMistakes: AiMistakeRow[];
  recentLearningRuns: LearningRunRow[];
  learningStatus: AssistantLabLearningStatus;
  learningScheduleNote: string;
  labReady: boolean;
  labReadyReason: string | null;
};

async function countConversationsNeedingLearning(
  supabase: TypedSupabaseClient
): Promise<number> {
  // Hiç öğrenilmemiş + mesajı olan konuşmalar (DM backfill kuyruğu)
  const { count, error } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .is("last_learned_at", null)
    .not("last_message_at", "is", null);
  if (error) {
    console.error("[assistant-lab] pending learn count:", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Asistan Laboratuvarı: katalog + karakter + öğrenme koşuları + test hazırlığı.
 */
export async function getAssistantLabDashboardData(
  supabase: TypedSupabaseClient
): Promise<AssistantLabDashboardData> {
  const [catalog, salesCtx, recentLearningRuns, masterOn, pendingLearnApprox] =
    await Promise.all([
      getCatalogLabSummary(supabase),
      loadSalesLearningContext(supabase).catch(() => ({
        patterns: [] as SalesPatternRow[],
        personality: [] as CompanyPersonalityTraitRow[],
        activeMistakes: [] as AiMistakeRow[],
        bestConversations: [],
      })),
      listRecentLearningRuns(supabase, 8),
      isAiFeatureEnabled(supabase, "AI_MASTER"),
      countConversationsNeedingLearning(supabase),
    ]);

  const openAiOk = isOpenAiConfigured();
  let labReady = true;
  let labReadyReason: string | null = null;
  if (!openAiOk) {
    labReady = false;
    labReadyReason = "OpenAI yapılandırılmamış.";
  } else if (!masterOn) {
    labReady = false;
    labReadyReason = "AI_MASTER kapalı (Ayarlar).";
  }

  const lastRun = recentLearningRuns[0] ?? null;

  return {
    catalog,
    personality: salesCtx.personality.slice(0, 12),
    topPatterns: salesCtx.patterns.slice(0, 8),
    activeMistakes: salesCtx.activeMistakes.slice(0, 6),
    recentLearningRuns,
    learningStatus: {
      patternCount: salesCtx.patterns.length,
      personalityCount: salesCtx.personality.length,
      activeMistakeCount: salesCtx.activeMistakes.length,
      bestConversationCount: salesCtx.bestConversations.length,
      pendingLearnApprox,
      lastRunAt: lastRun?.started_at ?? null,
      lastRunStatus: lastRun?.status ?? null,
      lastRunAnalyzed: lastRun?.conversations_analyzed ?? null,
    },
    learningScheduleNote:
      "Cron her saat çalışır; kapalı veya 24 saattir mesaj gelmeyen konuşmaları analiz eder. Hafıza: satış kalıpları, şirket kişiliği, hatalar, en iyi konuşmalar. Manuel: aşağıdaki «Şimdi öğren» ile tetikleyin.",
    labReady,
    labReadyReason,
  };
}
