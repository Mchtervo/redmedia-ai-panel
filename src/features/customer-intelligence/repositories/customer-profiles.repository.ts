import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { CustomerProfile } from "@/features/customer-intelligence/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export async function getCustomerProfileByContactId(
  supabase: TypedSupabaseClient,
  contactId: string
): Promise<CustomerProfile | null> {
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("*")
    .eq("contact_id", contactId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export type EnsureCustomerProfileParams = {
  contactId: string;
  instagramId?: string | null;
  username?: string | null;
  fullName?: string | null;
  phone?: string | null;
};

/**
 * Müşteri başına tek profil; yoksa oluşturur, varsa kimlik alanlarını tazeler.
 */
export async function ensureCustomerProfile(
  supabase: TypedSupabaseClient,
  params: EnsureCustomerProfileParams
): Promise<CustomerProfile> {
  const existing = await getCustomerProfileByContactId(
    supabase,
    params.contactId
  );

  if (existing) {
    const { data, error } = await supabase
      .from("customer_profiles")
      .update({
        instagram_id: params.instagramId ?? existing.instagram_id,
        username: params.username ?? existing.username,
        full_name: params.fullName ?? existing.full_name,
        phone: params.phone ?? existing.phone,
        last_seen: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("customer_profiles")
    .insert({
      contact_id: params.contactId,
      instagram_id: params.instagramId ?? null,
      username: params.username ?? null,
      full_name: params.fullName ?? null,
      phone: params.phone ?? null,
      first_seen: now,
      last_seen: now,
      city: "Ankara",
      status: "new",
      lead_score: 0,
      total_messages: 0,
      total_conversations: 0,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export type UpdateCustomerProfileFields = {
  username?: string | null;
  fullName?: string | null;
  phone?: string | null;
  phoneVerified?: boolean;
  eventType?: string | null;
  eventDate?: string | null;
  venue?: string | null;
  city?: string | null;
  budget?: string | null;
  requestedServices?: string[];
  objections?: string | null;
  lastSummary?: string | null;
  lastAiResponse?: string | null;
  notes?: string | null;
  tags?: string[];
  leadScore?: number;
  status?: CustomerProfile["status"];
  bookingProbability?: number | null;
  totalMessages?: number;
  totalConversations?: number;
  lastSeen?: string;
};

export async function updateCustomerProfile(
  supabase: TypedSupabaseClient,
  profileId: string,
  fields: UpdateCustomerProfileFields
): Promise<CustomerProfile> {
  const { data, error } = await supabase
    .from("customer_profiles")
    .update({
      ...(fields.username !== undefined ? { username: fields.username } : {}),
      ...(fields.fullName !== undefined ? { full_name: fields.fullName } : {}),
      ...(fields.phone !== undefined ? { phone: fields.phone } : {}),
      ...(fields.phoneVerified !== undefined
        ? { phone_verified: fields.phoneVerified }
        : {}),
      ...(fields.eventType !== undefined
        ? { event_type: fields.eventType }
        : {}),
      ...(fields.eventDate !== undefined
        ? { event_date: fields.eventDate }
        : {}),
      ...(fields.venue !== undefined ? { venue: fields.venue } : {}),
      ...(fields.city !== undefined && fields.city
        ? { city: fields.city }
        : {}),
      ...(fields.budget !== undefined ? { budget: fields.budget } : {}),
      ...(fields.requestedServices !== undefined
        ? { requested_services: fields.requestedServices }
        : {}),
      ...(fields.objections !== undefined
        ? { objections: fields.objections }
        : {}),
      ...(fields.lastSummary !== undefined
        ? { last_summary: fields.lastSummary }
        : {}),
      ...(fields.lastAiResponse !== undefined
        ? { last_ai_response: fields.lastAiResponse }
        : {}),
      ...(fields.notes !== undefined ? { notes: fields.notes } : {}),
      ...(fields.tags !== undefined ? { tags: fields.tags } : {}),
      ...(fields.leadScore !== undefined
        ? { lead_score: fields.leadScore }
        : {}),
      ...(fields.status !== undefined ? { status: fields.status } : {}),
      ...(fields.bookingProbability !== undefined
        ? { booking_probability: fields.bookingProbability }
        : {}),
      ...(fields.totalMessages !== undefined
        ? { total_messages: fields.totalMessages }
        : {}),
      ...(fields.totalConversations !== undefined
        ? { total_conversations: fields.totalConversations }
        : {}),
      ...(fields.lastSeen !== undefined ? { last_seen: fields.lastSeen } : {}),
    })
    .eq("id", profileId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
