/**
 * Campaign → Ad Set → Ad hiyerarşisi + kural tabanlı İyi/Orta/Kötü skor.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { MarketingDateRange } from "@/features/marketing/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type AdHealthScore = "good" | "ok" | "bad";

export const AD_HEALTH_LABELS: Record<AdHealthScore, string> = {
  good: "İyi",
  ok: "Orta",
  bad: "Kötü",
};

export type EntityMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  messages: number;
  leads: number;
  revenue: number;
  ctr: number | null;
  costPerMessage: number | null;
  score: AdHealthScore;
};

export type HierarchyAd = {
  id: string;
  metaAdId: string;
  name: string;
  status: string | null;
  creativeImageUrl: string | null;
  creativeTitle: string | null;
  metrics: EntityMetrics;
};

export type HierarchyAdSet = {
  id: string;
  metaAdSetId: string;
  name: string;
  status: string | null;
  dailyBudget: number | null;
  metrics: EntityMetrics;
  ads: HierarchyAd[];
};

export type HierarchyCampaign = {
  id: string;
  metaCampaignId: string;
  name: string;
  status: string | null;
  objective: string | null;
  dailyBudget: number | null;
  metrics: EntityMetrics;
  adSets: HierarchyAdSet[];
};

export type AdsHierarchyBundle = {
  range: MarketingDateRange;
  totals: EntityMetrics;
  campaigns: HierarchyCampaign[];
  scored: { good: number; ok: number; bad: number };
};

const MIN_SPEND_FOR_SCORE = 200;

export function scoreEntityMetrics(input: {
  spend: number;
  impressions: number;
  clicks: number;
  messages: number;
}): AdHealthScore {
  const { spend, impressions, clicks, messages } = input;
  if (spend < MIN_SPEND_FOR_SCORE) return "ok";
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpm = messages > 0 ? spend / messages : null;
  if (messages === 0 && spend >= MIN_SPEND_FOR_SCORE) return "bad";
  if (cpm != null && cpm <= 90 && ctr >= 0.8) return "good";
  if (cpm != null && cpm > 220) return "bad";
  if (messages > 0 && cpm != null && cpm <= 140) return "good";
  return "ok";
}

function buildMetrics(agg: {
  spend: number;
  impressions: number;
  clicks: number;
  messages: number;
  leads: number;
  revenue: number;
}): EntityMetrics {
  const ctr =
    agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : null;
  const costPerMessage =
    agg.messages > 0 ? agg.spend / agg.messages : null;
  return {
    ...agg,
    ctr,
    costPerMessage,
    score: scoreEntityMetrics(agg),
  };
}

function emptyMetrics(): EntityMetrics {
  return buildMetrics({
    spend: 0,
    impressions: 0,
    clicks: 0,
    messages: 0,
    leads: 0,
    revenue: 0,
  });
}

function sumMetrics(list: EntityMetrics[]): EntityMetrics {
  return buildMetrics({
    spend: list.reduce((s, m) => s + m.spend, 0),
    impressions: list.reduce((s, m) => s + m.impressions, 0),
    clicks: list.reduce((s, m) => s + m.clicks, 0),
    messages: list.reduce((s, m) => s + m.messages, 0),
    leads: list.reduce((s, m) => s + m.leads, 0),
    revenue: list.reduce((s, m) => s + m.revenue, 0),
  });
}

export async function buildAdsHierarchy(
  supabase: TypedSupabaseClient,
  range: MarketingDateRange
): Promise<AdsHierarchyBundle> {
  const [{ data: campaigns }, { data: adSets }, { data: ads }, { data: creatives }, { data: metrics }] =
    await Promise.all([
      supabase
        .from("campaigns")
        .select(
          "id, meta_campaign_id, name, status, objective, daily_budget"
        )
        .order("name", { ascending: true }),
      supabase
        .from("ad_sets")
        .select("id, campaign_id, meta_ad_set_id, name, status, daily_budget")
        .order("name", { ascending: true }),
      supabase
        .from("ads")
        .select("id, ad_set_id, meta_ad_id, name, status")
        .order("name", { ascending: true }),
      supabase
        .from("ad_creatives")
        .select("ad_id, image_url, title")
        .order("created_at", { ascending: false }),
      supabase
        .from("ad_daily_metrics")
        .select(
          "ad_id, spend, impressions, clicks, messages_started, leads, revenue"
        )
        .gte("date", range.start)
        .lte("date", range.end),
    ]);

  const metricsByAd = new Map<
    string,
    {
      spend: number;
      impressions: number;
      clicks: number;
      messages: number;
      leads: number;
      revenue: number;
    }
  >();
  for (const row of metrics ?? []) {
    const prev = metricsByAd.get(row.ad_id) ?? {
      spend: 0,
      impressions: 0,
      clicks: 0,
      messages: 0,
      leads: 0,
      revenue: 0,
    };
    metricsByAd.set(row.ad_id, {
      spend: prev.spend + Number(row.spend ?? 0),
      impressions: prev.impressions + Number(row.impressions ?? 0),
      clicks: prev.clicks + Number(row.clicks ?? 0),
      messages: prev.messages + Number(row.messages_started ?? 0),
      leads: prev.leads + Number(row.leads ?? 0),
      revenue: prev.revenue + Number(row.revenue ?? 0),
    });
  }

  const creativeByAd = new Map<string, { image: string | null; title: string | null }>();
  for (const c of creatives ?? []) {
    if (creativeByAd.has(c.ad_id)) continue;
    creativeByAd.set(c.ad_id, {
      image: c.image_url,
      title: c.title,
    });
  }

  const adsBySet = new Map<string, HierarchyAd[]>();
  for (const ad of ads ?? []) {
    const agg = metricsByAd.get(ad.id) ?? {
      spend: 0,
      impressions: 0,
      clicks: 0,
      messages: 0,
      leads: 0,
      revenue: 0,
    };
    const creative = creativeByAd.get(ad.id);
    const node: HierarchyAd = {
      id: ad.id,
      metaAdId: ad.meta_ad_id,
      name: ad.name?.trim() || "Adsız reklam",
      status: ad.status,
      creativeImageUrl: creative?.image ?? null,
      creativeTitle: creative?.title ?? null,
      metrics: buildMetrics(agg),
    };
    const list = adsBySet.get(ad.ad_set_id) ?? [];
    list.push(node);
    adsBySet.set(ad.ad_set_id, list);
  }

  const setsByCampaign = new Map<string, HierarchyAdSet[]>();
  for (const set of adSets ?? []) {
    const childAds = adsBySet.get(set.id) ?? [];
    const setMetrics =
      childAds.length > 0
        ? sumMetrics(childAds.map((a) => a.metrics))
        : emptyMetrics();
    const node: HierarchyAdSet = {
      id: set.id,
      metaAdSetId: set.meta_ad_set_id,
      name: set.name?.trim() || "Adsız ad set",
      status: set.status,
      dailyBudget:
        set.daily_budget != null ? Number(set.daily_budget) : null,
      metrics: setMetrics,
      ads: childAds,
    };
    const list = setsByCampaign.get(set.campaign_id) ?? [];
    list.push(node);
    setsByCampaign.set(set.campaign_id, list);
  }

  const hierarchy: HierarchyCampaign[] = (campaigns ?? []).map((c) => {
    const childSets = setsByCampaign.get(c.id) ?? [];
    const campaignMetrics =
      childSets.length > 0
        ? sumMetrics(childSets.map((s) => s.metrics))
        : emptyMetrics();
    return {
      id: c.id,
      metaCampaignId: c.meta_campaign_id,
      name: c.name?.trim() || "Adsız kampanya",
      status: c.status,
      objective: c.objective,
      dailyBudget:
        c.daily_budget != null ? Number(c.daily_budget) : null,
      metrics: campaignMetrics,
      adSets: childSets,
    };
  });

  // Harcaması olanları üste
  hierarchy.sort((a, b) => b.metrics.spend - a.metrics.spend);

  const totals =
    hierarchy.length > 0
      ? sumMetrics(hierarchy.map((c) => c.metrics))
      : emptyMetrics();

  let good = 0;
  let ok = 0;
  let bad = 0;
  for (const c of hierarchy) {
    for (const s of c.adSets) {
      for (const a of s.ads) {
        if (a.metrics.score === "good") good += 1;
        else if (a.metrics.score === "bad") bad += 1;
        else ok += 1;
      }
    }
  }

  return {
    range,
    totals,
    campaigns: hierarchy,
    scored: { good, ok, bad },
  };
}
