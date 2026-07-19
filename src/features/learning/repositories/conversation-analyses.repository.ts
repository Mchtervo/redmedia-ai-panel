import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { ConversationAnalysisRow } from "@/features/learning/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type UpsertConversationAnalysisParams = {
  conversationId: string;
  customerIntent?: string | null;
  eventType?: string | null;
  eventDateText?: string | null;
  venueType?: string | null;
  requestedServices?: string | null;
  budgetOrPriceQuestion?: string | null;
  objections?: string | null;
  phoneCollected?: boolean;
  saleOutcome?: ConversationAnalysisRow["sale_outcome"];
  advancingReply?: string | null;
  losingReply?: string | null;
  frequentQuestion?: string | null;
  recommendedAnswer?: string | null;
  leadScore?: number | null;
  saleProbability?: number | null;
  leadTemperature?: ConversationAnalysisRow["lead_temperature"];
  lossReason?: string | null;
  nextAction?: string | null;
  messageCount?: number;
  lastMessageAtSnapshot?: string | null;
  extraction?: Json | null;
  learningStatus?: ConversationAnalysisRow["learning_status"];
  scoreSalesQuality?: number | null;
  scoreEmpathy?: number | null;
  scoreSpeed?: number | null;
  scorePersuasion?: number | null;
  scoreClosing?: number | null;
  scoreNotes?: string | null;
  firstCustomerQuestion?: string | null;
  firstReplyGiven?: string | null;
  dropOffPoint?: string | null;
  reservationCreated?: boolean;
  depositReceived?: boolean;
  isBestConversation?: boolean;
};

export async function upsertConversationAnalysis(
  supabase: TypedSupabaseClient,
  params: UpsertConversationAnalysisParams
): Promise<ConversationAnalysisRow> {
  const payload = {
    conversation_id: params.conversationId,
    customer_intent: params.customerIntent ?? null,
    event_type: params.eventType ?? null,
    event_date_text: params.eventDateText ?? null,
    venue_type: params.venueType ?? null,
    requested_services: params.requestedServices ?? null,
    budget_or_price_question: params.budgetOrPriceQuestion ?? null,
    objections: params.objections ?? null,
    phone_collected: params.phoneCollected ?? false,
    sale_outcome: params.saleOutcome ?? "unknown",
    advancing_reply: params.advancingReply ?? null,
    losing_reply: params.losingReply ?? null,
    frequent_question: params.frequentQuestion ?? null,
    recommended_answer: params.recommendedAnswer ?? null,
    lead_score: params.leadScore ?? null,
    sale_probability: params.saleProbability ?? null,
    lead_temperature: params.leadTemperature ?? null,
    loss_reason: params.lossReason ?? null,
    next_action: params.nextAction ?? null,
    message_count: params.messageCount ?? 0,
    last_message_at_snapshot: params.lastMessageAtSnapshot ?? null,
    extraction: params.extraction ?? null,
    learning_status: params.learningStatus ?? "completed",
    score_sales_quality: params.scoreSalesQuality ?? null,
    score_empathy: params.scoreEmpathy ?? null,
    score_speed: params.scoreSpeed ?? null,
    score_persuasion: params.scorePersuasion ?? null,
    score_closing: params.scoreClosing ?? null,
    score_notes: params.scoreNotes ?? null,
    first_customer_question: params.firstCustomerQuestion ?? null,
    first_reply_given: params.firstReplyGiven ?? null,
    drop_off_point: params.dropOffPoint ?? null,
    reservation_created: params.reservationCreated ?? false,
    deposit_received: params.depositReceived ?? false,
    is_best_conversation: params.isBestConversation ?? false,
    analyzed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("conversation_analyses")
    .upsert(payload, { onConflict: "conversation_id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getAnalysisByConversationId(
  supabase: TypedSupabaseClient,
  conversationId: string
): Promise<ConversationAnalysisRow | null> {
  const { data, error } = await supabase
    .from("conversation_analyses")
    .select("*")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function countAnalyses(
  supabase: TypedSupabaseClient
): Promise<number> {
  const { count, error } = await supabase
    .from("conversation_analyses")
    .select("id", { count: "exact", head: true })
    .eq("learning_status", "completed");

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function listRecentAnalyses(
  supabase: TypedSupabaseClient,
  limit = 20
): Promise<ConversationAnalysisRow[]> {
  const { data, error } = await supabase
    .from("conversation_analyses")
    .select("*")
    .eq("learning_status", "completed")
    .order("analyzed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}
