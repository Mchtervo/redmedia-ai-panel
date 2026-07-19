/**
 * Lead → Rezervasyon → Kapora → Çekim → Teslim → Gelir zinciri.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import {
  matchAttributionForContact,
  upsertMatchedAttribution,
} from "@/features/marketing/services/attribution-matcher.service";
import type { AttributionStatus } from "@/features/marketing/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type FunnelStage =
  | "dm"
  | "lead"
  | "reservation"
  | "kapora"
  | "shoot"
  | "delivery"
  | "revenue";

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  dm: "DM",
  lead: "Lead",
  reservation: "Rezervasyon",
  kapora: "Kapora",
  shoot: "Çekim",
  delivery: "Teslim",
  revenue: "Gelir",
};

export const FUNNEL_STAGE_ORDER: FunnelStage[] = [
  "dm",
  "lead",
  "reservation",
  "kapora",
  "shoot",
  "delivery",
  "revenue",
];

type FunnelEventRow =
  Database["public"]["Tables"]["attribution_funnel_events"]["Row"];

export async function listFunnelTimeline(
  supabase: TypedSupabaseClient,
  contactId: string
): Promise<FunnelEventRow[]> {
  const { data, error } = await supabase
    .from("attribution_funnel_events")
    .select("*")
    .eq("contact_id", contactId)
    .order("occurred_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function upsertFunnelEvent(
  supabase: TypedSupabaseClient,
  params: {
    contactId: string;
    reservationId: string | null;
    attributionId: string | null;
    stage: FunnelStage;
    occurredAt: string;
    amount?: number | null;
    campaignId?: string | null;
    adId?: string | null;
    attributionStatus?: AttributionStatus | null;
    attributionConfidence?: number | null;
    sourceRef?: string | null;
    metadata?: Json;
  }
): Promise<void> {
  const payload = {
    contact_id: params.contactId,
    reservation_id: params.reservationId,
    attribution_id: params.attributionId,
    stage: params.stage,
    occurred_at: params.occurredAt,
    amount: params.amount ?? null,
    campaign_id: params.campaignId ?? null,
    ad_id: params.adId ?? null,
    attribution_status: params.attributionStatus ?? null,
    attribution_confidence: params.attributionConfidence ?? null,
    source_ref: params.sourceRef ?? null,
    metadata: params.metadata ?? {},
  };

  let query = supabase
    .from("attribution_funnel_events")
    .select("id")
    .eq("contact_id", params.contactId)
    .eq("stage", params.stage);

  query = params.reservationId
    ? query.eq("reservation_id", params.reservationId)
    : query.is("reservation_id", null);

  const { data: existing } = await query.maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("attribution_funnel_events")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("attribution_funnel_events")
    .insert(payload);
  if (error) throw error;
}

/**
 * Contact için attribution eşleştir + rezervasyon durumundan funnel zincirini kur.
 */
export async function rebuildAttributionFunnelForContact(
  supabase: TypedSupabaseClient,
  contactId: string
): Promise<{ events: FunnelEventRow[]; attributionStatus: AttributionStatus }> {
  const match = await matchAttributionForContact(supabase, contactId);
  const attr = await upsertMatchedAttribution(supabase, match);

  // DM: konuşma var mı?
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, created_at")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (conv) {
    await upsertFunnelEvent(supabase, {
      contactId,
      reservationId: null,
      attributionId: attr.id,
      stage: "dm",
      occurredAt: conv.created_at,
      campaignId: attr.campaign_id,
      adId: attr.ad_id,
      attributionStatus: attr.attribution_status as AttributionStatus,
      attributionConfidence: Number(attr.attribution_confidence ?? 0),
      sourceRef: conv.id,
    });
  }

  // Lead
  const { data: lead } = await supabase
    .from("lead_profiles")
    .select("id, created_at")
    .eq("contact_id", contactId)
    .maybeSingle();

  if (lead) {
    await upsertFunnelEvent(supabase, {
      contactId,
      reservationId: null,
      attributionId: attr.id,
      stage: "lead",
      occurredAt: lead.created_at,
      campaignId: attr.campaign_id,
      adId: attr.ad_id,
      attributionStatus: attr.attribution_status as AttributionStatus,
      attributionConfidence: Number(attr.attribution_confidence ?? 0),
      sourceRef: lead.id,
    });
  }

  const { data: reservations } = await supabase
    .from("reservations")
    .select(
      "id, status, deposit_status, deposit_amount, deposit_verified_at, total_price, remaining_payment_status, created_at, updated_at"
    )
    .eq("contact_id", contactId)
    .order("created_at", { ascending: true });

  for (const r of reservations ?? []) {
    await upsertFunnelEvent(supabase, {
      contactId,
      reservationId: r.id,
      attributionId: attr.id,
      stage: "reservation",
      occurredAt: r.created_at,
      amount: Number(r.total_price ?? 0) || null,
      campaignId: attr.campaign_id,
      adId: attr.ad_id,
      attributionStatus: attr.attribution_status as AttributionStatus,
      attributionConfidence: Number(attr.attribution_confidence ?? 0),
      sourceRef: r.id,
    });

    if (r.deposit_status === "verified") {
      await upsertFunnelEvent(supabase, {
        contactId,
        reservationId: r.id,
        attributionId: attr.id,
        stage: "kapora",
        occurredAt: r.deposit_verified_at ?? r.updated_at,
        amount: Number(r.deposit_amount ?? 0) || null,
        campaignId: attr.campaign_id,
        adId: attr.ad_id,
        attributionStatus: attr.attribution_status as AttributionStatus,
        attributionConfidence: Number(attr.attribution_confidence ?? 0),
        sourceRef: r.id,
      });
    }

    if (["shoot_completed", "completed"].includes(r.status)) {
      await upsertFunnelEvent(supabase, {
        contactId,
        reservationId: r.id,
        attributionId: attr.id,
        stage: "shoot",
        occurredAt: r.updated_at,
        campaignId: attr.campaign_id,
        adId: attr.ad_id,
        attributionStatus: attr.attribution_status as AttributionStatus,
        attributionConfidence: Number(attr.attribution_confidence ?? 0),
        sourceRef: r.id,
      });
    }

    // Teslim: lifecycle delivery veya completed
    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("lifecycle_stage, updated_at")
      .eq("contact_id", contactId)
      .maybeSingle();

    if (
      profile?.lifecycle_stage === "delivery" ||
      r.status === "completed"
    ) {
      await upsertFunnelEvent(supabase, {
        contactId,
        reservationId: r.id,
        attributionId: attr.id,
        stage: "delivery",
        occurredAt: profile?.updated_at ?? r.updated_at,
        campaignId: attr.campaign_id,
        adId: attr.ad_id,
        attributionStatus: attr.attribution_status as AttributionStatus,
        attributionConfidence: Number(attr.attribution_confidence ?? 0),
        sourceRef: r.id,
      });
    }

    // Gelir: kapora + kalan ödendi veya completed
    const revenueRecognized =
      r.status === "completed" ||
      (r.deposit_status === "verified" &&
        r.remaining_payment_status === "paid");

    if (revenueRecognized) {
      const amount =
        Number(r.total_price ?? 0) ||
        Number(r.deposit_amount ?? 0) ||
        null;
      await upsertFunnelEvent(supabase, {
        contactId,
        reservationId: r.id,
        attributionId: attr.id,
        stage: "revenue",
        occurredAt: r.updated_at,
        amount,
        campaignId: attr.campaign_id,
        adId: attr.ad_id,
        attributionStatus: attr.attribution_status as AttributionStatus,
        attributionConfidence: Number(attr.attribution_confidence ?? 0),
        sourceRef: r.id,
        metadata: {
          deposit_status: r.deposit_status,
          remaining_payment_status: r.remaining_payment_status,
        },
      });
    }
  }

  const events = await listFunnelTimeline(supabase, contactId);
  return {
    events,
    attributionStatus: attr.attribution_status as AttributionStatus,
  };
}

/**
 * Tek rezervasyon tamamlandığında ilgili contact funnel'ını yenile.
 */
export async function syncFunnelAfterReservationChange(
  supabase: TypedSupabaseClient,
  contactId: string | null
): Promise<void> {
  if (!contactId) return;
  await rebuildAttributionFunnelForContact(supabase, contactId);
}
