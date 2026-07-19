import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  countKnowledgeByReviewStatus,
  listKnowledgeByReviewStatus,
  listKnowledgeWithExamples,
} from "@/features/knowledge/repositories/knowledge-documents.repository";
import {
  countAnalyses,
  listRecentAnalyses,
} from "@/features/learning/repositories/conversation-analyses.repository";
import type { LearningDashboardData } from "@/features/learning/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export async function getLearningDashboardData(
  supabase: TypedSupabaseClient
): Promise<LearningDashboardData> {
  const [
    analyzedConversationCount,
    pendingKnowledgeCount,
    approvedKnowledgeCount,
    rejectedKnowledgeCount,
    pendingKnowledge,
    faqs,
    objections,
    goodReplies,
    badReplies,
    recentAnalyses,
  ] = await Promise.all([
    countAnalyses(supabase),
    countKnowledgeByReviewStatus(supabase, "pending_review"),
    countKnowledgeByReviewStatus(supabase, "approved"),
    countKnowledgeByReviewStatus(supabase, "rejected"),
    listKnowledgeByReviewStatus(supabase, "pending_review", 40),
    listKnowledgeWithExamples(supabase, "faq", 20),
    listKnowledgeWithExamples(supabase, "objection", 20),
    listKnowledgeWithExamples(supabase, "good", 20),
    listKnowledgeWithExamples(supabase, "bad", 20),
    listRecentAnalyses(supabase, 15),
  ]);

  return {
    stats: {
      analyzedConversationCount,
      pendingKnowledgeCount,
      approvedKnowledgeCount,
      rejectedKnowledgeCount,
      proposedKnowledgeCount:
        pendingKnowledgeCount + approvedKnowledgeCount + rejectedKnowledgeCount,
    },
    pendingKnowledge,
    faqs,
    objections,
    goodReplies,
    badReplies,
    recentAnalyses,
  };
}
