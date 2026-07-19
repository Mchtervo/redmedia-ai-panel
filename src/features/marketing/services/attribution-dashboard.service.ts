/**
 * Attribution Dashboard — kampanya bazlı DM / Lead / Rezervasyon / Kapora / Çekim / Gelir / ROI.
 * Gelir ve ROI yalnızca exact|manual attribution ile bağlanan rezervasyonlardan.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  istanbulDayEnd,
  istanbulDayStart,
} from "@/features/ceo-intelligence/utils/time";
import {
  resolveMarketingDateRange,
} from "@/features/marketing/services/marketing-metrics.service";
import type { DatePreset, MarketingDateRange } from "@/features/marketing/types";
import { getAttributionSummary } from "@/features/marketing/services/attribution.service";

type TypedSupabaseClient = SupabaseClient<Database>;

export type CampaignAttributionRow = {
  campaignId: string;
  campaignName: string;
  spend: number;
  dm: number;
  lead: number;
  reservation: number;
  kapora: number;
  shoot: number;
  revenue: number;
  /** (gelir - harcama) / harcama — exact gelir üzerinden */
  roi: number | null;
  exactAttributed: number;
  probableAttributed: number;
};

export type AttributionDashboard = {
  range: MarketingDateRange;
  summary: {
    totalSpend: number;
    dm: number;
    lead: number;
    reservation: number;
    kapora: number;
    shoot: number;
    revenueExact: number;
    revenueProbableExcluded: number;
    roi: number | null;
    byStatus: Record<string, number>;
  };
  campaigns: CampaignAttributionRow[];
  emptyMessage: string | null;
};

export async function buildAttributionDashboard(
  supabase: TypedSupabaseClient,
  preset: DatePreset = "last_30",
  customStart?: string,
  customEnd?: string
): Promise<AttributionDashboard> {
  const range = resolveMarketingDateRange(preset, customStart, customEnd);
  const startIso = istanbulDayStart(range.start).toISOString();
  const endIso = istanbulDayEnd(range.end).toISOString();

  const attrSummary = await getAttributionSummary(supabase);

  const { data: metrics } = await supabase
    .from("ad_daily_metrics")
    .select("spend, messages_started, leads, ad_id, date")
    .gte("date", range.start)
    .lte("date", range.end);

  const { data: ads } = await supabase
    .from("ads")
    .select("id, ad_set_id");
  const { data: sets } = await supabase
    .from("ad_sets")
    .select("id, campaign_id");
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name");

  const adToCampaign = new Map<string, string>();
  const setToCampaign = new Map(
    (sets ?? []).map((s) => [s.id, s.campaign_id])
  );
  for (const ad of ads ?? []) {
    const c = setToCampaign.get(ad.ad_set_id);
    if (c) adToCampaign.set(ad.id, c);
  }

  const spendByCampaign = new Map<string, number>();
  const metaDmByCampaign = new Map<string, number>();
  const metaLeadByCampaign = new Map<string, number>();

  for (const m of metrics ?? []) {
    const campId = adToCampaign.get(m.ad_id);
    if (!campId) continue;
    spendByCampaign.set(
      campId,
      (spendByCampaign.get(campId) ?? 0) + Number(m.spend ?? 0)
    );
    metaDmByCampaign.set(
      campId,
      (metaDmByCampaign.get(campId) ?? 0) + Number(m.messages_started ?? 0)
    );
    metaLeadByCampaign.set(
      campId,
      (metaLeadByCampaign.get(campId) ?? 0) + Number(m.leads ?? 0)
    );
  }

  const { data: funnel } = await supabase
    .from("attribution_funnel_events")
    .select(
      "stage, amount, campaign_id, attribution_status, contact_id, occurred_at"
    )
    .gte("occurred_at", startIso)
    .lte("occurred_at", endIso);

  type Acc = {
    dm: number;
    lead: number;
    reservation: number;
    kapora: number;
    shoot: number;
    revenue: number;
    exact: number;
    probable: number;
  };

  const byCamp = new Map<string, Acc>();
  const ensure = (id: string): Acc => {
    let a = byCamp.get(id);
    if (!a) {
      a = {
        dm: 0,
        lead: 0,
        reservation: 0,
        kapora: 0,
        shoot: 0,
        revenue: 0,
        exact: 0,
        probable: 0,
      };
      byCamp.set(id, a);
    }
    return a;
  };

  let revenueProbableExcluded = 0;

  for (const e of funnel ?? []) {
    if (!e.campaign_id) continue;
    const acc = ensure(e.campaign_id);
    const status = e.attribution_status;
    const verified =
      status === "exact" || status === "manual";

    switch (e.stage) {
      case "dm":
        acc.dm += 1;
        break;
      case "lead":
        acc.lead += 1;
        break;
      case "reservation":
        acc.reservation += 1;
        break;
      case "kapora":
        if (verified) acc.kapora += 1;
        break;
      case "shoot":
        if (verified) acc.shoot += 1;
        break;
      case "revenue": {
        const amt = Number(e.amount ?? 0);
        if (verified) {
          acc.revenue += amt;
        } else if (status === "probable") {
          revenueProbableExcluded += amt;
        }
        break;
      }
      default:
        break;
    }
    if (status === "exact" || status === "manual") acc.exact += 1;
    if (status === "probable") acc.probable += 1;
  }

  // CRM lead sayısı (exact+probable) attribution tablosundan kampanya bazlı
  const { data: attrs } = await supabase
    .from("customer_attributions")
    .select("campaign_id, attribution_status, first_touch_at")
    .not("campaign_id", "is", null)
    .gte("first_touch_at", startIso)
    .lte("first_touch_at", endIso);

  for (const a of attrs ?? []) {
    if (!a.campaign_id) continue;
    const acc = ensure(a.campaign_id);
    if (a.attribution_status === "probable") acc.probable += 1;
    if (
      a.attribution_status === "exact" ||
      a.attribution_status === "manual"
    ) {
      acc.exact += 1;
    }
  }

  const campName = new Map(
    (campaigns ?? []).map((c) => [c.id, c.name ?? "Kampanya"])
  );

  const allCampIds = new Set([
    ...spendByCampaign.keys(),
    ...byCamp.keys(),
  ]);

  const rows: CampaignAttributionRow[] = [];
  for (const id of allCampIds) {
    const acc = byCamp.get(id) ?? {
      dm: 0,
      lead: 0,
      reservation: 0,
      kapora: 0,
      shoot: 0,
      revenue: 0,
      exact: 0,
      probable: 0,
    };
    const spend = spendByCampaign.get(id) ?? 0;
    const dm = Math.max(acc.dm, metaDmByCampaign.get(id) ?? 0);
    const lead = Math.max(acc.lead, metaLeadByCampaign.get(id) ?? 0);
    const roi =
      spend > 0 ? (acc.revenue - spend) / spend : acc.revenue > 0 ? null : null;

    rows.push({
      campaignId: id,
      campaignName: campName.get(id) ?? "Kampanya",
      spend,
      dm,
      lead,
      reservation: acc.reservation,
      kapora: acc.kapora,
      shoot: acc.shoot,
      revenue: acc.revenue,
      roi: spend > 0 ? (acc.revenue - spend) / spend : null,
      exactAttributed: acc.exact,
      probableAttributed: acc.probable,
    });
    void roi;
  }

  rows.sort((a, b) => {
    if (b.revenue !== a.revenue) return b.revenue - a.revenue;
    if (b.kapora !== a.kapora) return b.kapora - a.kapora;
    return b.spend - a.spend;
  });

  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

  return {
    range,
    summary: {
      totalSpend,
      dm: rows.reduce((s, r) => s + r.dm, 0),
      lead: rows.reduce((s, r) => s + r.lead, 0),
      reservation: rows.reduce((s, r) => s + r.reservation, 0),
      kapora: rows.reduce((s, r) => s + r.kapora, 0),
      shoot: rows.reduce((s, r) => s + r.shoot, 0),
      revenueExact: totalRevenue,
      revenueProbableExcluded,
      roi: totalSpend > 0 ? (totalRevenue - totalSpend) / totalSpend : null,
      byStatus: attrSummary.byStatus,
    },
    campaigns: rows,
    emptyMessage:
      rows.length === 0
        ? "Yeterli attribution / kampanya verisi bulunmuyor."
        : null,
  };
}
