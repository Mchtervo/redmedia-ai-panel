/**
 * Reklam ↔ müşteri eşleşmesi — yalnızca doğrulanabilir sinyaller.
 * Doğrulanamazsa probable + güven %; uydurma exact yok.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { AttributionStatus, SourceType } from "@/features/marketing/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type MatchResult = {
  contactId: string;
  sourceType: SourceType;
  attributionStatus: AttributionStatus;
  attributionConfidence: number;
  attributionMethod: string;
  campaignId: string | null;
  adId: string | null;
  adSetId: string | null;
  metaCampaignId: string | null;
  metaAdId: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  fbclid: string | null;
  notes: string | null;
};

type LeadRow = {
  contact_id: string;
  source_campaign_id: string | null;
  source_ad_id: string | null;
  created_at: string;
};

type CampaignRow = { id: string; meta_campaign_id: string; name: string | null };
type AdRow = {
  id: string;
  meta_ad_id: string;
  ad_set_id: string;
  name: string | null;
};

/**
 * Lead profilindeki source_campaign_id / source_ad_id → exact.
 * Sinyal yoksa unknown; tek aktif kampanya + zaman penceresi → probable (düşük güven).
 */
export async function matchAttributionForContact(
  supabase: TypedSupabaseClient,
  contactId: string
): Promise<MatchResult> {
  const existing = await supabase
    .from("customer_attributions")
    .select("*")
    .eq("contact_id", contactId)
    .maybeSingle();

  // Manuel kayıtları otomatik ezme
  if (
    existing.data &&
    (existing.data.attribution_status === "manual" ||
      existing.data.attribution_method === "manual_staff")
  ) {
    return rowToMatch(existing.data);
  }

  const { data: lead } = await supabase
    .from("lead_profiles")
    .select("contact_id, source_campaign_id, source_ad_id, created_at")
    .eq("contact_id", contactId)
    .maybeSingle();

  if (lead?.source_ad_id) {
    const { data: ad } = await supabase
      .from("ads")
      .select("id, meta_ad_id, ad_set_id, name")
      .eq("id", lead.source_ad_id)
      .maybeSingle();
    if (ad) {
      const { data: set } = await supabase
        .from("ad_sets")
        .select("campaign_id")
        .eq("id", ad.ad_set_id)
        .maybeSingle();
      return {
        contactId,
        sourceType: "instagram_ad",
        attributionStatus: "exact",
        attributionConfidence: 98,
        attributionMethod: "lead_source_ad_id",
        campaignId: set?.campaign_id ?? null,
        adId: ad.id,
        adSetId: ad.ad_set_id,
        metaCampaignId: null,
        metaAdId: ad.meta_ad_id,
        utmSource: existing.data?.utm_source ?? null,
        utmCampaign: existing.data?.utm_campaign ?? null,
        fbclid: existing.data?.fbclid ?? null,
        notes: "Lead profilinde doğrulanmış source_ad_id",
      };
    }
  }

  if (lead?.source_campaign_id) {
    const { data: camp } = await supabase
      .from("campaigns")
      .select("id, meta_campaign_id, name")
      .eq("id", lead.source_campaign_id)
      .maybeSingle();
    if (camp) {
      return {
        contactId,
        sourceType: "instagram_ad",
        attributionStatus: "exact",
        attributionConfidence: 92,
        attributionMethod: "lead_source_campaign_id",
        campaignId: camp.id,
        adId: null,
        adSetId: null,
        metaCampaignId: camp.meta_campaign_id,
        metaAdId: null,
        utmSource: existing.data?.utm_source ?? null,
        utmCampaign: existing.data?.utm_campaign ?? null,
        fbclid: existing.data?.fbclid ?? null,
        notes: "Lead profilinde doğrulanmış source_campaign_id",
      };
    }
  }

  // Mevcut attribution'da fbclid + kampanya/ad → exact
  if (existing.data?.fbclid && (existing.data.ad_id || existing.data.campaign_id)) {
    return {
      contactId,
      sourceType: (existing.data.source_type as SourceType) || "facebook_ad",
      attributionStatus: "exact",
      attributionConfidence: 95,
      attributionMethod: "fbclid_linked",
      campaignId: existing.data.campaign_id,
      adId: existing.data.ad_id,
      adSetId: existing.data.ad_set_id,
      metaCampaignId: existing.data.meta_campaign_id,
      metaAdId: existing.data.meta_ad_id,
      utmSource: existing.data.utm_source,
      utmCampaign: existing.data.utm_campaign,
      fbclid: existing.data.fbclid,
      notes: "fbclid + bağlı kampanya/ad",
    };
  }

  // UTM campaign adı Meta kampanya adıyla birebir eşleşirse exact
  if (existing.data?.utm_campaign) {
    const utm = existing.data.utm_campaign.trim().toLowerCase();
    const { data: camps } = await supabase
      .from("campaigns")
      .select("id, meta_campaign_id, name");
    const hit = (camps ?? []).find(
      (c) => (c.name ?? "").trim().toLowerCase() === utm
    );
    if (hit) {
      return {
        contactId,
        sourceType: "instagram_ad",
        attributionStatus: "exact",
        attributionConfidence: 90,
        attributionMethod: "utm_campaign_name_match",
        campaignId: hit.id,
        adId: null,
        adSetId: null,
        metaCampaignId: hit.meta_campaign_id,
        metaAdId: null,
        utmSource: existing.data.utm_source,
        utmCampaign: existing.data.utm_campaign,
        fbclid: existing.data.fbclid,
        notes: "UTM campaign adı Meta kampanya adıyla eşleşti",
      };
    }
  }

  // Probable: tek aktif kampanya + lead/contact son 14 günde oluşmuş
  const probable = await tryProbableSingleActiveCampaign(
    supabase,
    contactId,
    lead
  );
  if (probable) return probable;

  return {
    contactId,
    sourceType: "unknown",
    attributionStatus: "unknown",
    attributionConfidence: 0,
    attributionMethod: "no_verifiable_signal",
    campaignId: null,
    adId: null,
    adSetId: null,
    metaCampaignId: null,
    metaAdId: null,
    utmSource: existing.data?.utm_source ?? null,
    utmCampaign: existing.data?.utm_campaign ?? null,
    fbclid: existing.data?.fbclid ?? null,
    notes: "Doğrulanabilir reklam sinyali yok",
  };
}

async function tryProbableSingleActiveCampaign(
  supabase: TypedSupabaseClient,
  contactId: string,
  lead: LeadRow | null
): Promise<MatchResult | null> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 14);
  const sinceIso = since.toISOString().slice(0, 10);

  const { data: spendRows } = await supabase
    .from("ad_daily_metrics")
    .select("ad_id, spend, date")
    .gte("date", sinceIso)
    .gt("spend", 0);

  if (!spendRows?.length) return null;

  const { data: ads } = await supabase
    .from("ads")
    .select("id, meta_ad_id, ad_set_id, name");
  const { data: sets } = await supabase
    .from("ad_sets")
    .select("id, campaign_id");
  const adMap = new Map((ads ?? []).map((a) => [a.id, a as AdRow]));
  const setMap = new Map((sets ?? []).map((s) => [s.id, s.campaign_id]));

  const campaignSpend = new Map<string, number>();
  for (const m of spendRows) {
    const ad = adMap.get(m.ad_id);
    if (!ad) continue;
    const campId = setMap.get(ad.ad_set_id);
    if (!campId) continue;
    campaignSpend.set(
      campId,
      (campaignSpend.get(campId) ?? 0) + Number(m.spend)
    );
  }

  if (campaignSpend.size !== 1) return null;

  const [campaignId] = [...campaignSpend.keys()];
  if (!campaignId) return null;

  const { data: camp } = await supabase
    .from("campaigns")
    .select("id, meta_campaign_id, name")
    .eq("id", campaignId)
    .maybeSingle();
  if (!camp) return null;

  const contactCreated = lead?.created_at
    ? new Date(lead.created_at).getTime()
    : null;
  const windowOk =
    contactCreated == null ||
    contactCreated >= since.getTime();

  if (!windowOk) return null;

  return {
    contactId,
    sourceType: "instagram_ad",
    attributionStatus: "probable",
    attributionConfidence: 45,
    attributionMethod: "single_active_campaign_window",
    campaignId: camp.id,
    adId: null,
    adSetId: null,
    metaCampaignId: camp.meta_campaign_id,
    metaAdId: null,
    utmSource: null,
    utmCampaign: null,
    fbclid: null,
    notes:
      "Olası kaynak: son 14 günde tek harcama yapan kampanya (doğrulanmadı)",
  };
}

function rowToMatch(
  row: Database["public"]["Tables"]["customer_attributions"]["Row"]
): MatchResult {
  return {
    contactId: row.contact_id,
    sourceType: row.source_type as SourceType,
    attributionStatus: row.attribution_status as AttributionStatus,
    attributionConfidence: Number(row.attribution_confidence ?? 0),
    attributionMethod: row.attribution_method ?? "manual_staff",
    campaignId: row.campaign_id,
    adId: row.ad_id,
    adSetId: row.ad_set_id,
    metaCampaignId: row.meta_campaign_id,
    metaAdId: row.meta_ad_id,
    utmSource: row.utm_source,
    utmCampaign: row.utm_campaign,
    fbclid: row.fbclid,
    notes: row.notes,
  };
}

/** Eşleşmeyi customer_attributions'a yazar (manuel ezilmez). */
export async function upsertMatchedAttribution(
  supabase: TypedSupabaseClient,
  match: MatchResult
): Promise<Database["public"]["Tables"]["customer_attributions"]["Row"]> {
  const existing = await supabase
    .from("customer_attributions")
    .select("*")
    .eq("contact_id", match.contactId)
    .maybeSingle();

  if (
    existing.data &&
    (existing.data.attribution_status === "manual" ||
      existing.data.attribution_method === "manual_staff")
  ) {
    return existing.data;
  }

  const payload = {
    contact_id: match.contactId,
    source_type: match.sourceType,
    attribution_status: match.attributionStatus,
    attribution_confidence: match.attributionConfidence,
    attribution_method: match.attributionMethod,
    campaign_id: match.campaignId,
    ad_id: match.adId,
    ad_set_id: match.adSetId,
    meta_campaign_id: match.metaCampaignId,
    meta_ad_id: match.metaAdId,
    utm_source: match.utmSource,
    utm_campaign: match.utmCampaign,
    fbclid: match.fbclid,
    notes: match.notes,
    first_touch_at:
      existing.data?.first_touch_at ?? new Date().toISOString(),
    last_touch_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("customer_attributions")
    .upsert(payload, { onConflict: "contact_id" })
    .select("*")
    .single();
  if (error) throw error;

  await supabase.from("attribution_audit_logs").insert({
    contact_id: match.contactId,
    attribution_id: data.id,
    actor_id: null,
    before_data: (existing.data ?? null) as unknown as Json,
    after_data: data as unknown as Json,
    reason: `Otomatik eşleşme: ${match.attributionMethod}`,
  });

  return data;
}

export async function rematchContactAttribution(
  supabase: TypedSupabaseClient,
  contactId: string
) {
  const match = await matchAttributionForContact(supabase, contactId);
  return upsertMatchedAttribution(supabase, match);
}

void (null as unknown as CampaignRow);
