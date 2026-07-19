import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;

export async function appendTimelineEvent(
  supabase: TypedSupabaseClient,
  input: {
    contactId: string;
    conversationId?: string | null;
    reservationId?: string | null;
    eventType: string;
    title: string;
    body?: string | null;
    actorType?: "system" | "ai" | "staff" | "customer";
    metadata?: Json;
    occurredAt?: string;
  }
) {
  const { data, error } = await supabase
    .from("customer_timeline_events")
    .insert({
      contact_id: input.contactId,
      conversation_id: input.conversationId ?? null,
      reservation_id: input.reservationId ?? null,
      event_type: input.eventType,
      title: input.title,
      body: input.body ?? null,
      actor_type: input.actorType ?? "system",
      metadata: input.metadata ?? {},
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listTimelineEvents(
  supabase: TypedSupabaseClient,
  contactId: string,
  limit = 80
) {
  const { data, error } = await supabase
    .from("customer_timeline_events")
    .select("*")
    .eq("contact_id", contactId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listAdminNotes(
  supabase: TypedSupabaseClient,
  contactId: string
) {
  const { data, error } = await supabase
    .from("customer_admin_notes")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertAdminNote(
  supabase: TypedSupabaseClient,
  input: { contactId: string; body: string; authorId?: string | null }
) {
  const { data, error } = await supabase
    .from("customer_admin_notes")
    .insert({
      contact_id: input.contactId,
      body: input.body.trim(),
      author_id: input.authorId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  await appendTimelineEvent(supabase, {
    contactId: input.contactId,
    eventType: "admin_note",
    title: "Admin notu eklendi",
    body: input.body.trim().slice(0, 200),
    actorType: "staff",
  });

  return data;
}

export async function updateProfileTagsAndScores(
  supabase: TypedSupabaseClient,
  contactId: string,
  patch: {
    tags?: string[];
    lifecycleStage?: string;
    opportunityScore?: number;
    leadScore?: number;
    adminNotes?: string | null;
    lastOutboundAt?: string | null;
    satisfactionFlowStatus?: string | null;
  }
) {
  const update: Database["public"]["Tables"]["customer_profiles"]["Update"] = {};
  if (patch.tags) update.tags = patch.tags;
  if (patch.lifecycleStage) update.lifecycle_stage = patch.lifecycleStage as never;
  if (patch.opportunityScore != null) {
    update.opportunity_score = patch.opportunityScore;
  }
  if (patch.leadScore != null) update.lead_score = patch.leadScore;
  if (patch.adminNotes !== undefined) update.admin_notes = patch.adminNotes;
  if (patch.lastOutboundAt !== undefined) {
    update.last_outbound_at = patch.lastOutboundAt;
  }
  if (patch.satisfactionFlowStatus !== undefined) {
    update.satisfaction_flow_status = patch.satisfactionFlowStatus as never;
  }

  const { data, error } = await supabase
    .from("customer_profiles")
    .update(update)
    .eq("contact_id", contactId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
