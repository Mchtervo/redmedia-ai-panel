import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { getCustomerProfileByContactId } from "@/features/customer-intelligence/repositories/customer-profiles.repository";

type TypedSupabaseClient = SupabaseClient<Database>;

export type CustomerMemoryUpdate = {
  memorySummary?: string | null;
  negotiationTendency?: string | null;
  priceSensitivity?: string | null;
  rejectedServices?: string[];
  preferredPackages?: string[];
  budgetRange?: string | null;
  decisionSpeed?: string | null;
  priorQuoteReceived?: boolean;
  priorReservation?: boolean;
  priorCancellation?: boolean;
  interestedCampaigns?: string[];
  mentionedDates?: string[];
  preferredStyle?: string | null;
  communicationTone?: string | null;
  usesEmoji?: boolean | null;
  formality?: string | null;
  frequentQuestions?: string[];
  customerType?: string | null;
  customerTypeConfidence?: number | null;
  aiNotes?: string | null;
  objections?: string | null;
  budget?: string | null;
  bookingProbability?: number | null;
};

/**
 * Analiz / öğrenme çıktısından customer_profiles hafızasını günceller.
 * Ham konuşma yerine özet alanlar saklanır.
 */
export async function mergeCustomerMemory(
  supabase: TypedSupabaseClient,
  contactId: string,
  update: CustomerMemoryUpdate
) {
  const existing = await getCustomerProfileByContactId(supabase, contactId);
  if (!existing) return null;

  const patch: Database["public"]["Tables"]["customer_profiles"]["Update"] = {
    memory_updated_at: new Date().toISOString(),
  };

  if (update.memorySummary != null) patch.memory_summary = update.memorySummary;
  if (update.negotiationTendency != null) {
    patch.negotiation_tendency = update.negotiationTendency;
  }
  if (update.priceSensitivity != null) {
    patch.price_sensitivity = update.priceSensitivity;
  }
  if (update.rejectedServices) {
    patch.rejected_services = [
      ...new Set([
        ...(existing.rejected_services ?? []),
        ...update.rejectedServices,
      ]),
    ];
  }
  if (update.preferredPackages) {
    patch.preferred_packages = [
      ...new Set([
        ...(existing.preferred_packages ?? []),
        ...update.preferredPackages,
      ]),
    ];
  }
  if (update.budgetRange != null) patch.budget_range = update.budgetRange;
  if (update.decisionSpeed != null) patch.decision_speed = update.decisionSpeed;
  if (update.priorQuoteReceived != null) {
    patch.prior_quote_received = update.priorQuoteReceived;
  }
  if (update.priorReservation != null) {
    patch.prior_reservation = update.priorReservation;
  }
  if (update.priorCancellation != null) {
    patch.prior_cancellation = update.priorCancellation;
  }
  if (update.interestedCampaigns) {
    patch.interested_campaigns = [
      ...new Set([
        ...(existing.interested_campaigns ?? []),
        ...update.interestedCampaigns,
      ]),
    ];
  }
  if (update.mentionedDates) {
    patch.mentioned_dates = [
      ...new Set([...(existing.mentioned_dates ?? []), ...update.mentionedDates]),
    ];
  }
  if (update.preferredStyle != null) patch.preferred_style = update.preferredStyle;
  if (update.communicationTone != null) {
    patch.communication_tone = update.communicationTone;
  }
  if (update.usesEmoji != null) patch.uses_emoji = update.usesEmoji;
  if (update.formality != null) patch.formality = update.formality;
  if (update.frequentQuestions) {
    patch.frequent_questions = [
      ...new Set([
        ...(existing.frequent_questions ?? []),
        ...update.frequentQuestions,
      ]),
    ].slice(0, 20);
  }
  if (update.customerType != null) patch.customer_type = update.customerType;
  if (update.customerTypeConfidence != null) {
    patch.customer_type_confidence = update.customerTypeConfidence;
  }
  if (update.aiNotes != null) {
    patch.ai_notes = [existing.ai_notes, update.aiNotes]
      .filter(Boolean)
      .join("\n")
      .slice(0, 4000);
  }
  if (update.objections != null) patch.objections = update.objections;
  if (update.budget != null) patch.budget = update.budget;
  if (update.bookingProbability != null) {
    patch.booking_probability = update.bookingProbability;
  }

  // last_summary: memory_summary ile senkron (prompt uyumluluğu)
  if (update.memorySummary) {
    patch.last_summary = update.memorySummary.slice(0, 2000);
  }

  const { data, error } = await supabase
    .from("customer_profiles")
    .update(patch)
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Konuşma analizi satırından hafıza alanlarına kaba eşleme.
 */
export function memoryUpdateFromAnalysis(analysis: {
  summary?: string | null;
  objections?: string | null;
  budget_note?: string | null;
  sale_probability?: number | null;
  intent?: string | null;
  event_type?: string | null;
  services_mentioned?: string[] | null;
  good_reply_patterns?: string[] | null;
  metadata?: Json | null;
}): CustomerMemoryUpdate {
  const meta =
    analysis.metadata && typeof analysis.metadata === "object"
      ? (analysis.metadata as Record<string, unknown>)
      : {};

  return {
    memorySummary: analysis.summary ?? null,
    objections: analysis.objections ?? null,
    budget: analysis.budget_note ?? null,
    budgetRange: (meta.budget_range as string) ?? analysis.budget_note ?? null,
    bookingProbability: analysis.sale_probability ?? null,
    negotiationTendency: (meta.negotiation_tendency as string) ?? null,
    priceSensitivity: (meta.price_sensitivity as string) ?? null,
    decisionSpeed: (meta.decision_speed as string) ?? null,
    communicationTone: (meta.communication_tone as string) ?? null,
    formality: (meta.formality as string) ?? null,
    preferredStyle: (meta.preferred_style as string) ?? null,
    customerType: (meta.customer_type as string) ?? null,
    customerTypeConfidence:
      typeof meta.customer_type_confidence === "number"
        ? meta.customer_type_confidence
        : null,
    preferredPackages: analysis.services_mentioned ?? undefined,
    rejectedServices: Array.isArray(meta.rejected_services)
      ? (meta.rejected_services as string[])
      : undefined,
    priorQuoteReceived: Boolean(meta.prior_quote_received),
    priorReservation: Boolean(meta.prior_reservation),
    priorCancellation: Boolean(meta.prior_cancellation),
    aiNotes: (meta.ai_notes as string) ?? null,
  };
}
