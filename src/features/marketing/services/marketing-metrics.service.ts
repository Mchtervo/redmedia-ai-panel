import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getTodayIsoInIstanbul } from "@/features/ai/prompts/simple-assistant";
import {
  addDaysIso,
  istanbulDayEnd,
  istanbulDayStart,
} from "@/features/ceo-intelligence/utils/time";
import type {
  DatePreset,
  DualPerformanceRow,
  MarketingDateRange,
  MarketingOverviewMetrics,
} from "@/features/marketing/types";
import { resolveMetaAccessToken } from "@/features/marketing/services/meta/token.service";

type TypedSupabaseClient = SupabaseClient<Database>;

export function resolveMarketingDateRange(
  preset: DatePreset,
  customStart?: string,
  customEnd?: string
): MarketingDateRange {
  const today = getTodayIsoInIstanbul();
  if (preset === "custom" && customStart && customEnd) {
    return { preset, start: customStart, end: customEnd };
  }
  const map: Record<Exclude<DatePreset, "custom">, number> = {
    today: 0,
    last_7: 6,
    last_30: 29,
    last_90: 89,
  };
  const days = map[preset === "custom" ? "last_30" : preset];
  return {
    preset: preset === "custom" ? "last_30" : preset,
    start: addDaysIso(today, -days),
    end: today,
  };
}

async function countAdsRows(supabase: TypedSupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("ads")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

async function countMetricRows(
  supabase: TypedSupabaseClient,
  range: MarketingDateRange
): Promise<number> {
  const { count } = await supabase
    .from("ad_daily_metrics")
    .select("id", { count: "exact", head: true })
    .gte("date", range.start)
    .lte("date", range.end);
  return count ?? 0;
}

export async function buildMarketingOverview(
  supabase: TypedSupabaseClient,
  preset: DatePreset = "last_30",
  customStart?: string,
  customEnd?: string
): Promise<MarketingOverviewMetrics> {
  const range = resolveMarketingDateRange(preset, customStart, customEnd);
  const token = await resolveMetaAccessToken(supabase);
  const connected = Boolean(token);
  const adCount = await countAdsRows(supabase);
  const metricCount = await countMetricRows(supabase, range);

  if (!connected && adCount === 0) {
    return emptyOverview(
      range,
      false,
      "Meta hesabı henüz bağlanmadı"
    );
  }

  if (metricCount === 0 && adCount === 0) {
    return emptyOverview(range, connected, "Yeterli veri bulunmuyor");
  }

  const { data: metrics } = await supabase
    .from("ad_daily_metrics")
    .select("spend, messages_started, leads, purchases, revenue, ad_id")
    .gte("date", range.start)
    .lte("date", range.end);

  const rows = metrics ?? [];
  if (rows.length === 0) {
    return emptyOverview(range, connected, "Yeterli veri bulunmuyor");
  }

  const totalSpend = rows.reduce((s, r) => s + Number(r.spend ?? 0), 0);

  const startIso = istanbulDayStart(range.start).toISOString();
  const endIso = istanbulDayEnd(range.end).toISOString();

  const { count: customersFromAds } = await supabase
    .from("customer_attributions")
    .select("id", { count: "exact", head: true })
    .in("source_type", ["instagram_ad", "facebook_ad"])
    .in("attribution_status", ["exact", "manual", "probable"])
    .gte("first_touch_at", startIso)
    .lte("first_touch_at", endIso);

  const { count: unknownSourceCount } = await supabase
    .from("customer_attributions")
    .select("id", { count: "exact", head: true })
    .eq("attribution_status", "unknown");

  // İş metrikleri: rezervasyon / kapora (tarih aralığında confirmed deposit)
  const { data: reservations } = await supabase
    .from("reservations")
    .select("id, status, deposit_status, total_price, created_at")
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  const resRows = reservations ?? [];
  const reservationCount = resRows.filter((r) =>
    ["confirmed", "completed", "shoot_completed", "deposit_pending", "payment_review"].includes(
      r.status
    )
  ).length;
  const depositCount = resRows.filter(
    (r) => r.deposit_status === "verified"
  ).length;

  const cust = customersFromAds ?? 0;
  const costPerCustomer =
    cust > 0 ? totalSpend / cust : totalSpend > 0 ? null : 0;
  const costPerReservation =
    reservationCount > 0 ? totalSpend / reservationCount : null;
  const costPerDeposit =
    depositCount > 0 ? totalSpend / depositCount : null;

  // En başarılı: attribution + deposits by campaign (basit)
  const { data: attrByCampaign } = await supabase
    .from("customer_attributions")
    .select("campaign_id")
    .not("campaign_id", "is", null)
    .in("attribution_status", ["exact", "manual"]);

  const campaignCounts = new Map<string, number>();
  for (const a of attrByCampaign ?? []) {
    if (!a.campaign_id) continue;
    campaignCounts.set(
      a.campaign_id,
      (campaignCounts.get(a.campaign_id) ?? 0) + 1
    );
  }
  let bestCampaign: MarketingOverviewMetrics["bestCampaign"] = null;
  if (campaignCounts.size > 0) {
    const topId = [...campaignCounts.entries()].sort((a, b) => b[1] - a[1])[0]!;
    const { data: camp } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("id", topId[0])
      .maybeSingle();
    if (camp) {
      bestCampaign = {
        id: camp.id,
        name: camp.name ?? "Kampanya",
        deposits: topId[1],
      };
    }
  }

  const adSpend = new Map<string, number>();
  for (const r of rows) {
    adSpend.set(r.ad_id, (adSpend.get(r.ad_id) ?? 0) + Number(r.spend ?? 0));
  }
  // Business ranking prefers deposits via attribution ad_id
  const { data: attrAds } = await supabase
    .from("customer_attributions")
    .select("ad_id")
    .not("ad_id", "is", null)
    .in("attribution_status", ["exact", "manual"]);
  const adCust = new Map<string, number>();
  for (const a of attrAds ?? []) {
    if (!a.ad_id) continue;
    adCust.set(a.ad_id, (adCust.get(a.ad_id) ?? 0) + 1);
  }
  let bestAd: MarketingOverviewMetrics["bestAd"] = null;
  if (adCust.size > 0) {
    const top = [...adCust.entries()].sort((a, b) => b[1] - a[1])[0]!;
    const { data: ad } = await supabase
      .from("ads")
      .select("id, name")
      .eq("id", top[0])
      .maybeSingle();
    if (ad) {
      bestAd = { id: ad.id, name: ad.name ?? "Reklam", deposits: top[1] };
    }
  }

  return {
    connected,
    hasData: true,
    emptyMessage: "",
    totalSpend,
    customersFromAds: cust,
    reservations: reservationCount,
    deposits: depositCount,
    costPerCustomer,
    costPerReservation,
    costPerDeposit,
    bestCampaign,
    bestAd,
    unknownSourceCount: unknownSourceCount ?? 0,
    range,
  };
}

function emptyOverview(
  range: MarketingDateRange,
  connected: boolean,
  emptyMessage: string
): MarketingOverviewMetrics {
  return {
    connected,
    hasData: false,
    emptyMessage,
    totalSpend: null,
    customersFromAds: null,
    reservations: null,
    deposits: null,
    costPerCustomer: null,
    costPerReservation: null,
    costPerDeposit: null,
    bestCampaign: null,
    bestAd: null,
    unknownSourceCount: null,
    range,
  };
}

export type MarketingDailyPoint = {
  date: string;
  spend: number;
  clicks: number;
  impressions: number;
  messages: number;
  leads: number;
};

/**
 * Günlük harcama/tıklama/mesaj serisi — overview grafiği için.
 * Veri yoksa boş dizi döner (sahte veri üretilmez).
 */
export async function listMarketingDailySeries(
  supabase: TypedSupabaseClient,
  range: MarketingDateRange
): Promise<MarketingDailyPoint[]> {
  const { data } = await supabase
    .from("ad_daily_metrics")
    .select("date, spend, clicks, impressions, messages_started, leads")
    .gte("date", range.start)
    .lte("date", range.end)
    .order("date", { ascending: true });

  if (!data?.length) return [];

  const byDate = new Map<string, MarketingDailyPoint>();
  for (const row of data) {
    const cur = byDate.get(row.date) ?? {
      date: row.date,
      spend: 0,
      clicks: 0,
      impressions: 0,
      messages: 0,
      leads: 0,
    };
    cur.spend += Number(row.spend ?? 0);
    cur.clicks += Number(row.clicks ?? 0);
    cur.impressions += Number(row.impressions ?? 0);
    cur.messages += Number(row.messages_started ?? 0);
    cur.leads += Number(row.leads ?? 0);
    byDate.set(row.date, cur);
  }
  return [...byDate.values()];
}

/**
 * Hiyerarşi satırları — veri yoksa boş dizi (sahte yok).
 * Sıralama ipucu: kapora > rezervasyon > gelir > müşteri maliyeti > mesaj.
 */
export async function listDualPerformance(
  supabase: TypedSupabaseClient,
  range: MarketingDateRange
): Promise<DualPerformanceRow[]> {
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name")
    .order("name");
  if (!campaigns?.length) return [];

  const { data: metrics } = await supabase
    .from("ad_daily_metrics")
    .select("*")
    .gte("date", range.start)
    .lte("date", range.end);

  if (!metrics?.length) return [];

  const { data: ads } = await supabase
    .from("ads")
    .select("id, name, ad_set_id");
  const { data: adSets } = await supabase
    .from("ad_sets")
    .select("id, name, campaign_id");
  const { data: creatives } = await supabase
    .from("ad_creatives")
    .select("id, ad_id, title");

  const adMap = new Map((ads ?? []).map((a) => [a.id, a]));
  const setMap = new Map((adSets ?? []).map((s) => [s.id, s]));

  const byAd = new Map<
    string,
    {
      spend: number;
      impressions: number;
      reach: number;
      clicks: number;
      messages: number;
      leads: number;
      revenue: number;
    }
  >();

  for (const m of metrics) {
    const cur = byAd.get(m.ad_id) ?? {
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      messages: 0,
      leads: 0,
      revenue: 0,
    };
    cur.spend += Number(m.spend);
    cur.impressions += Number(m.impressions);
    cur.reach += Number(m.reach);
    cur.clicks += Number(m.clicks);
    cur.messages += Number(m.messages_started);
    cur.leads += Number(m.leads);
    cur.revenue += Number(m.revenue);
    byAd.set(m.ad_id, cur);
  }

  const { data: attrs } = await supabase
    .from("customer_attributions")
    .select("ad_id, campaign_id, attribution_status")
    .in("attribution_status", ["exact", "manual", "probable"]);

  const crmByAd = new Map<string, number>();
  for (const a of attrs ?? []) {
    if (!a.ad_id) continue;
    crmByAd.set(a.ad_id, (crmByAd.get(a.ad_id) ?? 0) + 1);
  }

  const rows: DualPerformanceRow[] = [];

  for (const [adId, m] of byAd) {
    const ad = adMap.get(adId);
    if (!ad) continue;
    const set = setMap.get(ad.ad_set_id);
    const frequency =
      m.reach > 0 ? m.impressions / m.reach : null;
    const cpm =
      m.impressions > 0 ? (m.spend / m.impressions) * 1000 : null;
    const cpc = m.clicks > 0 ? m.spend / m.clicks : null;
    const ctr =
      m.impressions > 0 ? m.clicks / m.impressions : null;
    const crm = crmByAd.get(adId) ?? 0;
    const roas = m.spend > 0 ? m.revenue / m.spend : null;

    rows.push({
      id: adId,
      name: ad.name ?? "Reklam",
      level: "ad",
      parentId: ad.ad_set_id,
      meta: {
        spend: m.spend,
        impressions: m.impressions,
        reach: m.reach,
        frequency,
        cpm,
        cpc,
        ctr,
        messages: m.messages,
        leads: m.leads,
      },
      business: {
        crmCustomers: crm,
        reservations: 0,
        deposits: 0,
        revenue: m.revenue,
        roas,
        costPerCustomer: crm > 0 ? m.spend / crm : null,
        costPerReservation: null,
        costPerDeposit: null,
      },
    });

    void set;
    void creatives;
    void campaigns;
  }

  // İş başarısı sıralaması: deposits > reservations > revenue > cost/customer > messages
  rows.sort((a, b) => {
    if (b.business.deposits !== a.business.deposits) {
      return b.business.deposits - a.business.deposits;
    }
    if (b.business.reservations !== a.business.reservations) {
      return b.business.reservations - a.business.reservations;
    }
    if (b.business.revenue !== a.business.revenue) {
      return b.business.revenue - a.business.revenue;
    }
    const ca = a.business.costPerCustomer ?? Number.POSITIVE_INFINITY;
    const cb = b.business.costPerCustomer ?? Number.POSITIVE_INFINITY;
    if (ca !== cb) return ca - cb;
    // Mesaj sayısı çoktan aza (yanlış yönde sıralanınca 0 mesajlı
    // reklamlar en üstte görünüyordu).
    return b.meta.messages - a.meta.messages;
  });

  return rows;
}
