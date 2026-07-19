/**
 * Outcome Intelligence — aksiyon odaklı dashboard verisi.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getTodayIsoInIstanbul } from "@/features/ai/prompts/simple-assistant";
import { getReplyAbStats } from "@/features/ai/services/reply-ab.service";
import { loadLatestRealDmBatch } from "@/features/ai/services/real-dm-batch.service";
import {
  listWorstConversations,
  type WorstConversationRow,
} from "@/features/ai/services/conversation-quality.service";
import {
  getAiStaffLeaderboard,
  getMonthlyReservationFunnel,
  type LeaderboardSnapshot,
  type ReservationFunnelSnapshot,
} from "@/features/ai/services/reservation-funnel.service";
import {
  buildTopImprovements,
  getHumanVsAiInsights,
  getLostHeatMapWithTrend,
  type HeatMapBundle,
  type HumanVsAiInsight,
  type ImprovementAction,
} from "@/features/ai/services/improvement-actions.service";
import {
  getSuggestionSuccessSnapshot,
  type SuggestionSuccessSnapshot,
} from "@/features/ai/services/suggestion-success.service";

type TypedSupabase = SupabaseClient<Database>;

export type OutcomeKpiSnapshot = {
  weekStart: string;
  weekEnd: string;
  totalConversations: number;
  replyRate: number;
  conversationRate: number;
  priceAcceptedRate: number;
  depositRate: number;
  reservationRate: number;
  avgReplySeconds: number | null;
  lostHeatMap: { reason: string; count: number }[];
  topRecommendation: string | null;
  conversionByCustomerType: {
    type: string;
    total: number;
    reservations: number;
    rate: number;
  }[];
  conversionByPackage: {
    package: string;
    total: number;
    reservations: number;
    rate: number;
  }[];
  humanVsAi: {
    humanAverage: number | null;
    aiAverage: number | null;
    topErrorMessageType: string | null;
  } | null;
};

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getWeekStart(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!, 12));
  const day = date.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  return addDays(isoDate, -diff);
}

function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 1000) / 10;
}

export async function getOutcomeKpiSnapshot(
  supabase: TypedSupabase,
  options?: { weekStart?: string }
): Promise<OutcomeKpiSnapshot> {
  const today = getTodayIsoInIstanbul();
  const weekStart = options?.weekStart ?? getWeekStart(addDays(today, -7));
  const weekEnd = addDays(weekStart, 6);
  const from = `${weekStart}T00:00:00Z`;
  const to = `${addDays(weekEnd, 1)}T00:00:00Z`;

  const { data: tags } = await supabase
    .from("conversation_outcome_tags")
    .select(
      "customer_replied, conversation_length, price_accepted, price_mentioned, deposit, reservation, customer_lost, lost_reason, recommendation"
    )
    .gte("updated_at", from)
    .lt("updated_at", to);

  const rows = tags ?? [];
  const total = rows.length;
  const replied = rows.filter((r) => r.customer_replied).length;
  const conversed = rows.filter((r) => r.conversation_length >= 4).length;
  const priceMentioned = rows.filter((r) => r.price_mentioned).length;
  const priceAccepted = rows.filter((r) => r.price_accepted === true).length;
  const deposits = rows.filter((r) => r.deposit).length;
  const reservations = rows.filter((r) => r.reservation).length;

  const heat = new Map<string, number>();
  for (const r of rows) {
    if (!r.customer_lost || !r.lost_reason) continue;
    heat.set(r.lost_reason, (heat.get(r.lost_reason) ?? 0) + 1);
  }
  const lostHeatMap = [...heat.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const topRec =
    rows.find((r) => r.recommendation)?.recommendation ?? null;

  const realBatch = await loadLatestRealDmBatch();

  if (realBatch && realBatch.analyzed > 0) {
    return {
      weekStart,
      weekEnd,
      totalConversations: realBatch.analyzed,
      replyRate: realBatch.kpis.replyRate,
      conversationRate: realBatch.kpis.conversationRate,
      priceAcceptedRate: realBatch.kpis.priceAcceptedRate,
      depositRate: realBatch.kpis.depositRate,
      reservationRate: realBatch.kpis.reservationRate,
      avgReplySeconds: realBatch.kpis.avgReplySeconds,
      lostHeatMap:
        realBatch.topLossReasons.length > 0
          ? realBatch.topLossReasons
          : lostHeatMap,
      topRecommendation: topRec,
      conversionByCustomerType: realBatch.conversionByCustomerType,
      conversionByPackage: realBatch.conversionByPackage,
      humanVsAi: {
        humanAverage: realBatch.humanVsAi.humanAverage,
        aiAverage: realBatch.humanVsAi.aiAverage,
        topErrorMessageType: realBatch.humanVsAi.topErrorMessageType,
      },
    };
  }

  return {
    weekStart,
    weekEnd,
    totalConversations: total,
    replyRate: pct(replied, total),
    conversationRate: pct(conversed, total),
    priceAcceptedRate: pct(priceAccepted, priceMentioned || total),
    depositRate: pct(deposits, total),
    reservationRate: pct(reservations, total),
    avgReplySeconds: null,
    lostHeatMap,
    topRecommendation: topRec,
    conversionByCustomerType: [],
    conversionByPackage: [],
    humanVsAi: null,
  };
}

export type OutcomeIntelligenceDashboard = {
  kpi: OutcomeKpiSnapshot;
  ab: Awaited<ReturnType<typeof getReplyAbStats>>;
  funnel: ReservationFunnelSnapshot;
  leaderboard: LeaderboardSnapshot;
  worstConversations: WorstConversationRow[];
  heat: HeatMapBundle;
  topImprovements: ImprovementAction[];
  humanVsAiInsight: HumanVsAiInsight;
  suggestionSuccess: SuggestionSuccessSnapshot;
};

export async function getOutcomeIntelligenceDashboard(
  supabase: TypedSupabase
): Promise<OutcomeIntelligenceDashboard> {
  const [
    kpi,
    ab,
    funnel,
    leaderboard,
    worstConversations,
    heat,
    suggestionSuccess,
  ] = await Promise.all([
    getOutcomeKpiSnapshot(supabase),
    getReplyAbStats(supabase),
    getMonthlyReservationFunnel(supabase),
    getAiStaffLeaderboard(supabase),
    listWorstConversations(supabase, 20).catch(() => []),
    getLostHeatMapWithTrend(supabase).catch(() => ({
      current: [],
      weeklyTrend: [],
    })),
    getSuggestionSuccessSnapshot(supabase).catch(() => ({
      applied: 0,
      customerReplied: 0,
      deposits: 0,
      reservations: 0,
      reservationRatePct: 0,
      byLossReason: [],
    })),
  ]);

  const topImprovements = buildTopImprovements({
    funnel,
    heat,
    worst: worstConversations,
  });

  const humanVsAiInsight = await getHumanVsAiInsights(supabase, kpi.humanVsAi);

  return {
    kpi,
    ab,
    funnel,
    leaderboard,
    worstConversations,
    heat,
    topImprovements,
    humanVsAiInsight,
    suggestionSuccess,
  };
}
