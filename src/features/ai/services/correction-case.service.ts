/**
 * Düzeltme vakası: konuşma + analiz + alternatif + takip tahmini + başarı oranı.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { listMessagesByConversation } from "@/features/conversations/repositories/messages.repository";
import type { Message } from "@/features/conversations/types";
import {
  analyzeLostSale,
  type LostSaleAnalysis,
} from "@/features/ai/services/lost-sale-analyzer.service";
import {
  buildSuggestedReply,
  computeConversationQualityScore,
  type ConversationQualityResult,
  upsertConversationQualityScore,
} from "@/features/ai/services/conversation-quality.service";
import { filterProductionConversationIds } from "@/features/ai/services/production-conversation-filter";
import {
  predictCustomerReply,
  type ReplyPrediction,
} from "@/features/ai/services/reply-prediction.service";
import {
  getSuggestionSuccessSnapshot,
  type SuggestionSuccessByReason,
} from "@/features/ai/services/suggestion-success.service";
import { RESERVATION_WON } from "@/features/ai/services/conversion-metrics.service";

type TypedSupabase = SupabaseClient<Database>;

export type CorrectionCase = {
  conversationId: string;
  contactId: string | null;
  contactName: string | null;
  externalConversationId: string | null;
  isProduction: boolean;
  messages: Message[];
  quality: ConversationQualityResult;
  lostSale: LostSaleAnalysis | null;
  alternativeReply: string;
  lossReasonLabel: string;
  prediction: ReplyPrediction | null;
  successForReason: SuggestionSuccessByReason | null;
  overallSuccessRatePct: number;
  alreadyApplied: boolean;
  linkedReservation: {
    id: string;
    status: string;
    depositStatus: string;
  } | null;
};

export async function getCorrectionCase(
  supabase: TypedSupabase,
  conversationId: string,
  options?: { refreshLostSale?: boolean }
): Promise<CorrectionCase | null> {
  const { data: conv } = await supabase
    .from("conversations")
    .select(
      "id, contact_id, external_conversation_id, contact:contacts(full_name, username)"
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) return null;

  const production = await filterProductionConversationIds(supabase, [
    conversationId,
  ]);
  const isProduction = production.includes(conversationId);

  const messages = await listMessagesByConversation(supabase, conversationId);
  let quality = await computeConversationQualityScore(supabase, conversationId);
  await upsertConversationQualityScore(supabase, quality);

  let lostSale: LostSaleAnalysis | null = null;
  const { data: existing } = await supabase
    .from("lost_sale_analyses")
    .select(
      "id, conversation_id, primary_reason, reasons, why_lost, first_mistake_turn_index, alternative_conversation, reservation_lift_pct, created_at"
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.conversation_id) {
    lostSale = {
      id: existing.id,
      conversationId: existing.conversation_id,
      primaryReason: existing.primary_reason as LostSaleAnalysis["primaryReason"],
      reasons: (existing.reasons ?? []) as LostSaleAnalysis["reasons"],
      whyLost: existing.why_lost ?? "",
      firstMistakeTurnIndex: existing.first_mistake_turn_index,
      alternativeConversation: existing.alternative_conversation ?? "",
      reservationLiftPct: existing.reservation_lift_pct ?? 0,
      createdAt: existing.created_at,
    };
  } else if (options?.refreshLostSale && quality.score < 75) {
    lostSale = await analyzeLostSale(supabase, conversationId);
  }

  const lastCustomer =
    [...messages].reverse().find((m) => m.sender_type === "customer")
      ?.content ?? null;

  const alternativeReply =
    (lostSale?.alternativeConversation &&
    lostSale.alternativeConversation.trim().length > 0
      ? lostSale.alternativeConversation
      : null) ??
    quality.suggestedReply ??
    buildSuggestedReply({
      lossReason: quality.lossReason,
      primaryIssue: quality.primaryIssue,
      lastCustomerText: lastCustomer,
    });

  const contact = conv.contact as
    | { full_name: string | null; username: string | null }
    | { full_name: string | null; username: string | null }[]
    | null;
  const one = Array.isArray(contact) ? contact[0] : contact;

  const lossReasonLabel =
    quality.lossReason ??
    (lostSale?.whyLost ? lostSale.whyLost.slice(0, 80) : null) ??
    quality.primaryIssue ??
    "Belirsiz";

  if (!quality.suggestedReply && alternativeReply) {
    quality = { ...quality, suggestedReply: alternativeReply };
    await upsertConversationQualityScore(supabase, quality);
  }

  let prediction: ReplyPrediction | null = null;
  try {
    prediction = await predictCustomerReply(supabase, conversationId);
  } catch {
    prediction = null;
  }

  let successSnap = null;
  try {
    successSnap = await getSuggestionSuccessSnapshot(supabase);
  } catch {
    successSnap = null;
  }

  const successForReason =
    successSnap?.byLossReason.find(
      (r) =>
        r.lossReason === lossReasonLabel ||
        lossReasonLabel.includes(r.lossReason) ||
        r.lossReason.includes(lossReasonLabel.slice(0, 12))
    ) ?? null;

  const { data: applied } = await supabase
    .from("suggestion_applications")
    .select("id")
    .eq("conversation_id", conversationId)
    .limit(1)
    .maybeSingle();

  let linkedReservation: CorrectionCase["linkedReservation"] = null;
  const { data: resRows } = await supabase
    .from("reservations")
    .select("id, status, deposit_status")
    .eq("conversation_id", conversationId)
    .limit(3);
  const pick =
    (resRows ?? []).find((r) => RESERVATION_WON.has(r.status)) ??
    (resRows ?? []).find((r) => r.deposit_status === "verified") ??
    resRows?.[0];
  if (pick) {
    linkedReservation = {
      id: pick.id,
      status: pick.status,
      depositStatus: pick.deposit_status,
    };
  }

  return {
    conversationId,
    contactId: conv.contact_id,
    contactName: one?.full_name ?? one?.username ?? null,
    externalConversationId: conv.external_conversation_id,
    isProduction,
    messages,
    quality,
    lostSale,
    alternativeReply,
    lossReasonLabel,
    prediction,
    successForReason,
    overallSuccessRatePct: successSnap?.reservationRatePct ?? 0,
    alreadyApplied: Boolean(applied),
    linkedReservation,
  };
}
