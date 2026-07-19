import type { Database } from "@/types/database";

export type CustomerProfile =
  Database["public"]["Tables"]["customer_profiles"]["Row"];

export type CustomerProfileStatus = CustomerProfile["status"];

export const CUSTOMER_PROFILE_STATUS_VALUES = [
  "new",
  "interested",
  "hot",
  "booked",
  "lost",
] as const satisfies readonly CustomerProfileStatus[];

export const CUSTOMER_PROFILE_STATUS_LABELS: Record<
  CustomerProfileStatus,
  string
> = {
  new: "Yeni",
  interested: "İlgili",
  hot: "Sıcak",
  booked: "Rezerve",
  lost: "Kayıp",
};

/** Prompt ve panel için sadeleştirilmiş CRM bellek görünümü. */
export type CrmMemorySnapshot = {
  fullName: string | null;
  username: string | null;
  phone: string | null;
  phoneVerified: boolean;
  status: CustomerProfileStatus;
  leadScore: number;
  bookingProbability: number | null;
  eventType: string | null;
  eventDate: string | null;
  venue: string | null;
  city: string;
  budget: string | null;
  requestedServices: string[];
  objections: string | null;
  lastSummary: string | null;
  lastAiResponse: string | null;
  tags: string[];
  totalMessages: number;
  totalConversations: number;
  memorySummary: string | null;
  negotiationTendency: string | null;
  priceSensitivity: string | null;
  rejectedServices: string[];
  preferredPackages: string[];
  budgetRange: string | null;
  decisionSpeed: string | null;
  priorQuoteReceived: boolean;
  priorReservation: boolean;
  priorCancellation: boolean;
  interestedCampaigns: string[];
  mentionedDates: string[];
  preferredStyle: string | null;
  communicationTone: string | null;
  usesEmoji: boolean | null;
  formality: string | null;
  frequentQuestions: string[];
  customerType: string | null;
  customerTypeConfidence: number | null;
  aiNotes: string | null;
  lifecycleStage: string | null;
  opportunityScore: number;
  /** Dahili — müşteriye söylenmez. */
  adminNotes: string | null;
};

export function toCrmMemorySnapshot(
  profile: CustomerProfile
): CrmMemorySnapshot {
  return {
    fullName: profile.full_name,
    username: profile.username,
    phone: profile.phone,
    phoneVerified: profile.phone_verified,
    status: profile.status,
    leadScore: profile.opportunity_score ?? profile.lead_score,
    bookingProbability: profile.booking_probability,
    eventType: profile.event_type,
    eventDate: profile.event_date,
    venue: profile.venue,
    city: profile.city,
    budget: profile.budget,
    requestedServices: profile.requested_services ?? [],
    objections: profile.objections,
    lastSummary: profile.memory_summary ?? profile.last_summary,
    lastAiResponse: profile.last_ai_response,
    tags: profile.tags ?? [],
    totalMessages: profile.total_messages,
    totalConversations: profile.total_conversations,
    memorySummary: profile.memory_summary,
    negotiationTendency: profile.negotiation_tendency,
    priceSensitivity: profile.price_sensitivity,
    rejectedServices: profile.rejected_services ?? [],
    preferredPackages: profile.preferred_packages ?? [],
    budgetRange: profile.budget_range,
    decisionSpeed: profile.decision_speed,
    priorQuoteReceived: profile.prior_quote_received,
    priorReservation: profile.prior_reservation,
    priorCancellation: profile.prior_cancellation,
    interestedCampaigns: profile.interested_campaigns ?? [],
    mentionedDates: profile.mentioned_dates ?? [],
    preferredStyle: profile.preferred_style,
    communicationTone: profile.communication_tone,
    usesEmoji: profile.uses_emoji,
    formality: profile.formality,
    frequentQuestions: profile.frequent_questions ?? [],
    customerType: profile.customer_type,
    customerTypeConfidence: profile.customer_type_confidence,
    aiNotes: profile.ai_notes,
    lifecycleStage: profile.lifecycle_stage ?? "new_customer",
    opportunityScore: profile.opportunity_score ?? profile.lead_score,
    adminNotes: profile.admin_notes,
  };
}
