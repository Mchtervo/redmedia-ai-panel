import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  listActiveMistakes,
  listBestConversations,
  listPersonalityTraits,
  listTopPatterns,
} from "@/features/sales-learning/repositories/sales-learning.repository";
import { getLatestWeeklyReport } from "@/features/sales-learning/services/weekly-report.service";
import { collectReservationBlockers } from "@/features/sales-learning/services/reservation-blockers.service";
import { listPlaybooks } from "@/features/playbooks/repositories/playbooks.repository";
import type { SalesLearningDashboardData } from "@/features/sales-learning/types";

type TypedSupabaseClient = SupabaseClient<Database>;

async function countTable(
  supabase: TypedSupabaseClient,
  table: "sales_patterns" | "company_personality_traits"
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (error) throw error;
  return count ?? 0;
}

export async function getSalesLearningDashboardData(
  supabase: TypedSupabaseClient
): Promise<SalesLearningDashboardData> {
  const [
    patternCount,
    personalityCount,
    activeMistakes,
    bestConversations,
    topPatterns,
    personality,
    latestWeeklyReport,
    playbooks,
    scoredRes,
    bestCountRes,
    reservationBlockers,
  ] = await Promise.all([
    countTable(supabase, "sales_patterns"),
    countTable(supabase, "company_personality_traits"),
    listActiveMistakes(supabase, 12),
    listBestConversations(supabase, 8),
    listTopPatterns(supabase, { limit: 18 }),
    listPersonalityTraits(supabase, 18),
    getLatestWeeklyReport(supabase),
    listPlaybooks(supabase, 12),
    supabase
      .from("conversation_analyses")
      .select(
        "id, conversation_id, customer_intent, score_sales_quality, score_empathy, score_speed, score_persuasion, score_closing, score_notes, sale_outcome, analyzed_at"
      )
      .not("score_sales_quality", "is", null)
      .order("analyzed_at", { ascending: false })
      .limit(12),
    supabase
      .from("conversation_analyses")
      .select("id", { count: "exact", head: true })
      .eq("is_best_conversation", true),
    collectReservationBlockers(supabase, { days: 7 }),
  ]);

  if (scoredRes.error) throw scoredRes.error;
  if (bestCountRes.error) throw bestCountRes.error;

  return {
    patternCount,
    personalityCount,
    activeMistakeCount: activeMistakes.length,
    bestConversationCount: bestCountRes.count ?? 0,
    topPatterns,
    personality,
    activeMistakes,
    bestConversations,
    scoredAnalyses: (scoredRes.data ?? []).map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      customerIntent: row.customer_intent,
      scoreSalesQuality: row.score_sales_quality,
      scoreEmpathy: row.score_empathy,
      scoreSpeed: row.score_speed,
      scorePersuasion: row.score_persuasion,
      scoreClosing: row.score_closing,
      scoreNotes: row.score_notes,
      saleOutcome: row.sale_outcome,
      analyzedAt: row.analyzed_at,
    })),
    latestWeeklyReport,
    playbooks,
    reservationBlockers,
  };
}
