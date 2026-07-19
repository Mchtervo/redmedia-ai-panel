import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getCustomerProfileByContactId } from "@/features/customer-intelligence/repositories/customer-profiles.repository";
import { findDraftByConversation } from "@/features/reservations/repositories/reservations.repository";
import { inferLifecycleStage } from "@/features/smart-sales/services/lifecycle.service";
import { computeOpportunityScore } from "@/features/smart-sales/services/opportunity-score.service";
import { suggestSalesTags } from "@/features/smart-sales/services/tags.service";
import {
  appendTimelineEvent,
  updateProfileTagsAndScores,
} from "@/features/smart-sales/repositories/smart-sales.repository";
import type { LifecycleStage } from "@/features/smart-sales/types";

type TypedSupabaseClient = SupabaseClient<Database>;

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const event = new Date(`${dateStr}T12:00:00+03:00`).getTime();
  return Math.round((event - Date.now()) / 86400000);
}

/**
 * Her inbound sonrası: lifecycle, opportunity, tags güncelle.
 */
export async function refreshSmartSalesProfile(
  supabase: TypedSupabaseClient,
  params: {
    contactId: string;
    conversationId?: string | null;
    customerMessage?: string;
  }
) {
  const profile = await getCustomerProfileByContactId(
    supabase,
    params.contactId
  );
  if (!profile) return null;

  let reservationStatus: string | null = null;
  let depositStatus: string | null = null;
  if (params.conversationId) {
    const draft = await findDraftByConversation(
      supabase,
      params.conversationId
    );
    reservationStatus = draft?.status ?? null;
    depositStatus = draft?.deposit_status ?? null;
  }

  const msg = params.customerMessage ?? "";
  const negotiating =
    /indirim|pazarlık|pazarlik|ucuza|düşür|dusur/i.test(msg) ||
    /yüksek/i.test(profile.negotiation_tendency ?? "");
  const priceDiscussed =
    Boolean(profile.budget) ||
    /fiyat|kaç para|kac para|ücret|ucret|paket/i.test(msg) ||
    Boolean(profile.prior_quote_received);

  const daysSinceLast =
    profile.last_seen
      ? Math.round(
          (Date.now() - new Date(profile.last_seen).getTime()) / 86400000
        )
      : null;

  const stage = inferLifecycleStage({
    hasEventDate: Boolean(profile.event_date),
    hasPhone: Boolean(profile.phone),
    hasRequestedServices: (profile.requested_services?.length ?? 0) > 0,
    priceDiscussed,
    negotiating,
    reservationStatus,
    depositStatus,
    daysSinceLastMessage: daysSinceLast,
    cancelled: reservationStatus === "cancelled",
  });

  const replyGapHours = profile.last_ai_response
    ? Math.round(
        (Date.now() - new Date(profile.updated_at).getTime()) / 3600000
      )
    : null;

  const opportunity = computeOpportunityScore({
    totalMessages: profile.total_messages,
    hasPhone: Boolean(profile.phone),
    hasEventDate: Boolean(profile.event_date),
    hasServices: (profile.requested_services?.length ?? 0) > 0,
    bookingProbability: profile.booking_probability,
    negotiationTendency: profile.negotiation_tendency,
    priceSensitivity: profile.price_sensitivity,
    decisionSpeed: profile.decision_speed,
    daysUntilEvent: daysUntil(profile.event_date),
    replyGapHours,
    priorReservation: profile.prior_reservation,
    priorCancellation: profile.prior_cancellation,
    lifecycleStage: stage,
  });

  const tags = suggestSalesTags({
    opportunityScore: opportunity,
    leadScore: opportunity,
    budget: profile.budget,
    budgetRange: profile.budget_range,
    negotiationTendency: profile.negotiation_tendency,
    decisionSpeed: profile.decision_speed,
    priorReservation: profile.prior_reservation,
    daysUntilEvent: daysUntil(profile.event_date),
    lifecycleStage: stage,
    objections: profile.objections,
    tags: profile.tags ?? [],
  });

  const prevStage = (profile.lifecycle_stage as LifecycleStage | undefined) ??
    "new_customer";

  const updated = await updateProfileTagsAndScores(supabase, params.contactId, {
    lifecycleStage: stage,
    opportunityScore: opportunity,
    leadScore: opportunity,
    tags,
  });

  if (prevStage !== stage) {
    await appendTimelineEvent(supabase, {
      contactId: params.contactId,
      conversationId: params.conversationId,
      eventType: "lifecycle_change",
      title: `Aşama: ${stage}`,
      body: `${prevStage} → ${stage}`,
      actorType: "system",
      metadata: { from: prevStage, to: stage, opportunity },
    });
  }

  return updated;
}
