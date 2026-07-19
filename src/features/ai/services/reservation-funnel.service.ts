/**
 * Funnel + leaderboard — gerçek verified kapora / won rezervasyon.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getTodayIsoInIstanbul } from "@/features/ai/prompts/simple-assistant";
import {
  getRealConversionMetrics,
  RESERVATION_WON,
  type ConversionMetrics,
} from "@/features/ai/services/conversion-metrics.service";
import { listProductionInstagramConversationIds } from "@/features/ai/services/production-conversation-filter";

type TypedSupabase = SupabaseClient<Database>;

export type ReservationFunnelSnapshot = {
  periodLabel: string;
  monthStart: string;
  monthEnd: string;
  conversations: number;
  priceGiven: number;
  followUp: number;
  /** verified kapora */
  deposit: number;
  /** confirmed+ rezervasyon */
  reservation: number;
  /** pipeline (deposit_pending+) — bilgi amaçlı */
  reservationPipeline: number;
  conversionPct: number;
  depositRatePct: number;
  bySource: ConversionMetrics["bySource"];
  biggestDrop: {
    from: string;
    to: string;
    lost: number;
    rate: number;
  } | null;
};

export type LeaderboardSnapshot = {
  weekStart: string;
  weekEnd: string;
  aiReservations: number;
  staffReservations: number;
  aiDeposits: number;
  staffDeposits: number;
  aiAvgQuality: number | null;
  staffAvgQuality: number | null;
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

function monthBounds(todayIso: string): { start: string; end: string } {
  const [y, m] = todayIso.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth =
    m === 12
      ? `${y! + 1}-01-01`
      : `${y}-${String(m! + 1).padStart(2, "0")}-01`;
  const end = addDays(nextMonth, -1);
  return { start, end };
}

export async function getMonthlyReservationFunnel(
  supabase: TypedSupabase
): Promise<ReservationFunnelSnapshot> {
  const today = getTodayIsoInIstanbul();
  const { start, end } = monthBounds(today);
  const metrics = await getRealConversionMetrics(supabase);

  const stages: [string, number][] = [
    ["Konuşma", metrics.conversations],
    ["Fiyat verildi", metrics.priceGiven],
    ["Takip", metrics.followUp],
    ["Kapora (verified)", metrics.depositVerified],
    ["Rezervasyon", metrics.reservationWon],
  ];

  let biggestDrop: ReservationFunnelSnapshot["biggestDrop"] = null;
  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i]!;
    const to = stages[i + 1]!;
    const lost = Math.max(0, from[1] - to[1]);
    const rate = pct(lost, from[1] || 1);
    if (!biggestDrop || lost > biggestDrop.lost) {
      biggestDrop = { from: from[0], to: to[0], lost, rate };
    }
  }

  return {
    periodLabel: "Gerçek dönüşüm",
    monthStart: start,
    monthEnd: end,
    conversations: metrics.conversations,
    priceGiven: metrics.priceGiven,
    followUp: metrics.followUp,
    deposit: metrics.depositVerified,
    reservation: metrics.reservationWon,
    reservationPipeline: metrics.reservationPipeline,
    conversionPct: metrics.conversionPct,
    depositRatePct: metrics.depositRatePct,
    bySource: metrics.bySource,
    biggestDrop,
  };
}

export async function getAiStaffLeaderboard(
  supabase: TypedSupabase
): Promise<LeaderboardSnapshot> {
  const today = getTodayIsoInIstanbul();
  const weekStart = getWeekStart(today);
  const weekEnd = addDays(weekStart, 6);
  const from = `${weekStart}T00:00:00Z`;
  const to = `${addDays(weekEnd, 1)}T00:00:00Z`;

  const { data: reservations } = await supabase
    .from("reservations")
    .select("id, source, status, deposit_status")
    .gte("created_at", from)
    .lt("created_at", to);

  const rows = reservations ?? [];
  const won = rows.filter((r) => RESERVATION_WON.has(r.status));
  const deposits = rows.filter((r) => r.deposit_status === "verified");

  const aiReservations = won.filter((r) => r.source === "instagram_ai").length;
  const staffReservations = won.filter((r) =>
    ["manual", "admin_panel"].includes(r.source)
  ).length;
  const aiDeposits = deposits.filter((r) => r.source === "instagram_ai").length;
  const staffDeposits = deposits.filter((r) =>
    ["manual", "admin_panel"].includes(r.source)
  ).length;

  const productionIds = await listProductionInstagramConversationIds(supabase, {
    limit: 400,
  });

  let aiAvgQuality: number | null = null;
  let staffAvgQuality: number | null = null;

  if (productionIds.length > 0) {
    const { data: scores } = await supabase
      .from("conversation_quality_scores")
      .select("conversation_id, score")
      .in("conversation_id", productionIds)
      .limit(400);

    if (scores?.length) {
      const ids = scores.map((s) => s.conversation_id);
      const { data: msgs } = await supabase
        .from("messages")
        .select("conversation_id, sender_type")
        .in("conversation_id", ids)
        .in("sender_type", ["ai", "staff"]);

      const aiCount = new Map<string, number>();
      const staffCount = new Map<string, number>();
      for (const m of msgs ?? []) {
        if (m.sender_type === "ai") {
          aiCount.set(
            m.conversation_id,
            (aiCount.get(m.conversation_id) ?? 0) + 1
          );
        } else if (m.sender_type === "staff") {
          staffCount.set(
            m.conversation_id,
            (staffCount.get(m.conversation_id) ?? 0) + 1
          );
        }
      }

      const aiScores: number[] = [];
      const staffScores: number[] = [];
      for (const s of scores) {
        const a = aiCount.get(s.conversation_id) ?? 0;
        const b = staffCount.get(s.conversation_id) ?? 0;
        if (a === 0 && b === 0) continue;
        if (a >= b) aiScores.push(s.score);
        else staffScores.push(s.score);
      }

      if (aiScores.length) {
        aiAvgQuality =
          Math.round(
            (aiScores.reduce((x, y) => x + y, 0) / aiScores.length) * 10
          ) / 10;
      }
      if (staffScores.length) {
        staffAvgQuality =
          Math.round(
            (staffScores.reduce((x, y) => x + y, 0) / staffScores.length) * 10
          ) / 10;
      }
    }
  }

  return {
    weekStart,
    weekEnd,
    aiReservations,
    staffReservations,
    aiDeposits,
    staffDeposits,
    aiAvgQuality,
    staffAvgQuality,
  };
}
