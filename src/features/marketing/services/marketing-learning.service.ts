import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rebuildAttributionFunnelForContact } from "@/features/marketing/services/attribution-funnel.service";

type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Tek reklam sonucundan validated öğrenim oluşturulmaz.
 * supporting_experiment_count < 2 ise validated'a yükseltilmez.
 */
export async function createLearning(
  supabase: TypedSupabaseClient,
  params: {
    title: string;
    description: string;
    rationale: string;
    confidenceLevel: number;
    supportingExperimentCount: number;
    status?: Database["public"]["Tables"]["marketing_learnings"]["Insert"]["status"];
    createdBy: string | null;
    relatedCampaignIds?: string[];
    relatedAdIds?: string[];
    sourceReservationId?: string | null;
    sourceContactId?: string | null;
  }
) {
  let status = params.status ?? "hypothesis";
  if (
    status === "validated" &&
    params.supportingExperimentCount < 2
  ) {
    status = "hypothesis";
  }

  const { data, error } = await supabase
    .from("marketing_learnings")
    .insert({
      title: params.title,
      description: params.description,
      rationale: params.rationale,
      confidence_level: params.confidenceLevel,
      supporting_experiment_count: params.supportingExperimentCount,
      status,
      created_by: params.createdBy,
      related_campaign_ids: params.relatedCampaignIds ?? [],
      related_ad_ids: params.relatedAdIds ?? [],
      source_reservation_id: params.sourceReservationId ?? null,
      source_contact_id: params.sourceContactId ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Tamamlanan rezervasyondan sonra marketing learning güncelle/oluştur.
 * Probable attribution validated sayılmaz.
 */
export async function learnFromCompletedReservation(
  supabase: TypedSupabaseClient,
  reservationId: string
): Promise<{ created: boolean; skippedReason?: string }> {
  const { data: reservation } = await supabase
    .from("reservations")
    .select(
      "id, contact_id, status, total_price, deposit_amount, deposit_status, event_type"
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation?.contact_id) {
    return { created: false, skippedReason: "contact_yok" };
  }
  if (reservation.status !== "completed") {
    return { created: false, skippedReason: "henuz_completed_degil" };
  }

  const { events: funnel, attributionStatus } =
    await rebuildAttributionFunnelForContact(
      supabase,
      reservation.contact_id
    );

  const { data: attr } = await supabase
    .from("customer_attributions")
    .select("campaign_id, ad_id, attribution_status, attribution_confidence, source_type")
    .eq("contact_id", reservation.contact_id)
    .maybeSingle();

  const { data: existing } = await supabase
    .from("marketing_learnings")
    .select("id")
    .eq("source_reservation_id", reservationId)
    .maybeSingle();

  if (existing?.id) {
    return { created: false, skippedReason: "zaten_var" };
  }

  const isExact =
    attributionStatus === "exact" || attributionStatus === "manual";
  const revenue = Number(reservation.total_price ?? 0);
  const stages = funnel.map((e) => e.stage).join(" → ");

  const title = isExact
    ? `Tamamlanan rezervasyon — kesin kaynak (${attr?.source_type ?? "reklam"})`
    : `Tamamlanan rezervasyon — olası kaynak (güven %${attr?.attribution_confidence ?? 0})`;

  const description = [
    `Rezervasyon ${reservationId.slice(0, 8)} tamamlandı.`,
    `Funnel: ${stages || "yok"}.`,
    `Gelir kaydı: ${revenue} TRY.`,
    `Kapora: ${reservation.deposit_status}.`,
    isExact
      ? "Kaynak exact/manual — gelir attribution dashboard'a dahil."
      : "Kaynak probable/unknown — gelir exact ROI'ye dahil edilmez.",
  ].join(" ");

  await createLearning(supabase, {
    title,
    description,
    rationale: isExact
      ? "Doğrulanmış attribution + tamamlanan rezervasyon."
      : "Rezervasyon tamamlandı ancak reklam eşleşmesi doğrulanamadı (probable/unknown).",
    confidenceLevel: isExact
      ? Math.min(85, Number(attr?.attribution_confidence ?? 70))
      : Math.min(50, Number(attr?.attribution_confidence ?? 30)),
    supportingExperimentCount: 0,
    status: "hypothesis",
    createdBy: null,
    relatedCampaignIds: attr?.campaign_id ? [attr.campaign_id] : [],
    relatedAdIds: attr?.ad_id ? [attr.ad_id] : [],
    sourceReservationId: reservationId,
    sourceContactId: reservation.contact_id,
  });

  return { created: true };
}

export async function listLearnings(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("marketing_learnings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}
