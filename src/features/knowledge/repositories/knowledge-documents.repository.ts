import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  KnowledgeDocumentRow,
  KnowledgeReviewStatus,
} from "@/features/learning/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type InsertKnowledgeProposalParams = {
  title: string;
  category: string;
  content: string;
  faqQuestion?: string | null;
  suggestedAnswer?: string | null;
  exampleGoodReply?: string | null;
  exampleBadReply?: string | null;
  isPricingSensitive?: boolean;
  isCampaignClaim?: boolean;
  sourceConversationId?: string | null;
  sourceAnalysisId?: string | null;
  sourceType?: "manual" | "conversation_learning" | "import";
};

export async function insertPendingKnowledgeDocument(
  supabase: TypedSupabaseClient,
  params: InsertKnowledgeProposalParams
): Promise<KnowledgeDocumentRow> {
  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert({
      title: params.title,
      category: params.category,
      content: params.content,
      faq_question: params.faqQuestion ?? null,
      suggested_answer: params.suggestedAnswer ?? null,
      example_good_reply: params.exampleGoodReply ?? null,
      example_bad_reply: params.exampleBadReply ?? null,
      is_pricing_sensitive: params.isPricingSensitive ?? false,
      is_campaign_claim: params.isCampaignClaim ?? false,
      source_conversation_id: params.sourceConversationId ?? null,
      source_analysis_id: params.sourceAnalysisId ?? null,
      source_type: params.sourceType ?? "conversation_learning",
      review_status: "pending_review",
      is_active: false,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/** AI cevap bağlamı: yalnızca onaylı + aktif + kampanya iddiası olmayan. */
export async function listApprovedKnowledgeForReply(
  supabase: TypedSupabaseClient,
  limit = 12
): Promise<KnowledgeDocumentRow[]> {
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("review_status", "approved")
    .eq("is_active", true)
    .eq("is_campaign_claim", false)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function listKnowledgeByReviewStatus(
  supabase: TypedSupabaseClient,
  reviewStatus: KnowledgeReviewStatus,
  limit = 50
): Promise<KnowledgeDocumentRow[]> {
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("review_status", reviewStatus)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function countKnowledgeByReviewStatus(
  supabase: TypedSupabaseClient,
  reviewStatus: KnowledgeReviewStatus
): Promise<number> {
  const { count, error } = await supabase
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("review_status", reviewStatus);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function getKnowledgeDocumentById(
  supabase: TypedSupabaseClient,
  id: string
): Promise<KnowledgeDocumentRow | null> {
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export type UpdateKnowledgeReviewParams = {
  id: string;
  reviewStatus: KnowledgeReviewStatus;
  reviewedBy: string | null;
  title?: string;
  content?: string;
  category?: string;
  reviewNotes?: string | null;
};

export async function updateKnowledgeReview(
  supabase: TypedSupabaseClient,
  params: UpdateKnowledgeReviewParams
): Promise<KnowledgeDocumentRow> {
  const isApproved = params.reviewStatus === "approved";

  const { data, error } = await supabase
    .from("knowledge_documents")
    .update({
      review_status: params.reviewStatus,
      reviewed_by: params.reviewedBy,
      reviewed_at: new Date().toISOString(),
      is_active: isApproved,
      ...(params.title ? { title: params.title } : {}),
      ...(params.content ? { content: params.content } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.reviewNotes !== undefined
        ? { review_notes: params.reviewNotes }
        : {}),
    })
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function listKnowledgeWithExamples(
  supabase: TypedSupabaseClient,
  kind: "good" | "bad" | "faq" | "objection",
  limit = 20
): Promise<KnowledgeDocumentRow[]> {
  let query = supabase.from("knowledge_documents").select("*");

  if (kind === "good") {
    query = query.not("example_good_reply", "is", null);
  } else if (kind === "bad") {
    query = query.not("example_bad_reply", "is", null);
  } else if (kind === "faq") {
    query = query
      .eq("category", "sik_sorulan_sorular")
      .not("faq_question", "is", null);
  } else {
    query = query.eq("category", "itiraz_karsilama");
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}
