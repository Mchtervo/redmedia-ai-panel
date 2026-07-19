import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type {
  CeoActionItem,
  CeoDashboardPayload,
  CeoMetricsSnapshot,
  CeoRecommendationItem,
  CeoRiskItem,
} from "@/features/ceo-intelligence/types";
import { collectCeoMetrics } from "@/features/ceo-intelligence/services/metrics.service";
import {
  buildCeoActionItems,
  detectCeoRisks,
} from "@/features/ceo-intelligence/services/risks.service";
import {
  buildCeoRecommendations,
  buildSummaryBullets,
} from "@/features/ceo-intelligence/services/recommendations.service";
import { buildCeoIntelligenceBriefs } from "@/features/intelligence/services/ceo-briefs.service";
import { getTodayIsoInIstanbul } from "@/features/ai/prompts/simple-assistant";

type TypedSupabaseClient = SupabaseClient<Database>;

const BRIEF_TTL_MS = 20 * 60 * 1000;

function asJson(value: unknown): Json {
  return value as Json;
}

export async function buildCeoDashboard(
  supabase: TypedSupabaseClient
): Promise<CeoDashboardPayload> {
  const metrics = await collectCeoMetrics(supabase);
  const risks = await detectCeoRisks(supabase, metrics);
  const intelligenceBriefs = buildCeoIntelligenceBriefs(metrics, risks);
  const recommendations = buildCeoRecommendations(metrics, risks);
  const actionItems = buildCeoActionItems(metrics, risks);
  const summaryBullets = buildSummaryBullets(metrics);

  const { collectReservationBlockers } = await import(
    "@/features/sales-learning/services/reservation-blockers.service"
  );
  const reservationBlockers = await collectReservationBlockers(supabase, {
    days: 7,
  });

  const { narrative, briefGeneratedAt } = await upsertCeoBrief(supabase, {
    metrics,
    risks,
    recommendations,
    actionItems,
    summaryBullets,
    intelligenceBriefs,
  });

  const { data: latestReport } = await supabase
    .from("ceo_daily_reports")
    .select("id, report_date, content_markdown, generated_at")
    .order("report_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    metrics,
    risks,
    recommendations,
    actionItems,
    intelligenceBriefs,
    reservationBlockers,
    summaryBullets,
    narrative,
    briefGeneratedAt,
    latestDailyReport: latestReport
      ? {
          id: latestReport.id,
          reportDate: latestReport.report_date,
          contentMarkdown: latestReport.content_markdown,
          generatedAt: latestReport.generated_at,
        }
      : null,
  };
}

async function upsertCeoBrief(
  supabase: TypedSupabaseClient,
  input: {
    metrics: CeoMetricsSnapshot;
    risks: CeoRiskItem[];
    recommendations: CeoRecommendationItem[];
    actionItems: CeoActionItem[];
    summaryBullets: string[];
    intelligenceBriefs: unknown[];
  }
): Promise<{ narrative: string | null; briefGeneratedAt: string }> {
  const reportDate = input.metrics.reportDate;
  const { data: existing } = await supabase
    .from("ceo_daily_briefs")
    .select("id, generated_at, narrative, metrics")
    .eq("report_date", reportDate)
    .maybeSingle();

  const fresh =
    !existing ||
    Date.now() - new Date(existing.generated_at).getTime() > BRIEF_TTL_MS;

  const narrative = buildDeterministicNarrative(
    input.metrics,
    input.risks,
    input.actionItems
  );
  const generatedAt = new Date().toISOString();

  if (fresh) {
    await supabase.from("ceo_daily_briefs").upsert(
      {
        report_date: reportDate,
        metrics: asJson(input.metrics),
        summary_bullets: input.summaryBullets,
        narrative,
        risks: asJson(input.risks),
        recommendations: asJson({
          items: input.recommendations,
          intelligenceBriefs: input.intelligenceBriefs,
        }),
        action_items: asJson(input.actionItems),
        generated_at: generatedAt,
        model: null,
      },
      { onConflict: "report_date" }
    );
    return { narrative, briefGeneratedAt: generatedAt };
  }

  // Metrikler her açılışta canlı; brief kaydını da güncelle (TTL içinde bile sayılar taze kalsın)
  await supabase
    .from("ceo_daily_briefs")
    .update({
      metrics: asJson(input.metrics),
      summary_bullets: input.summaryBullets,
      narrative,
      risks: asJson(input.risks),
      recommendations: asJson({
        items: input.recommendations,
        intelligenceBriefs: input.intelligenceBriefs,
      }),
      action_items: asJson(input.actionItems),
      generated_at: generatedAt,
    })
    .eq("report_date", reportDate);

  return { narrative, briefGeneratedAt: generatedAt };
}

function buildDeterministicNarrative(
  metrics: CeoMetricsSnapshot,
  risks: CeoRiskItem[],
  actions: CeoActionItem[]
): string {
  const critical = risks.filter((r) => r.severity === "critical" || r.severity === "high");
  const parts = [
    `${getTodayIsoInIstanbul()} yönetim özeti: ${metrics.newCustomersToday} yeni müşteri, ${metrics.activeConversations} aktif konuşma, ${metrics.shootsToday} çekim.`,
    `Tahmini ciro bugün ${metrics.estimatedRevenueToday.toLocaleString("tr-TR")} TL, haftalık ${metrics.estimatedRevenueThisWeek.toLocaleString("tr-TR")} TL.`,
  ];
  if (critical.length > 0) {
    parts.push(
      `Dikkat: ${critical
        .slice(0, 3)
        .map((r) => r.title)
        .join("; ")}.`
    );
  }
  if (actions[0] && actions[0].id !== "all-clear") {
    parts.push(`Öncelikli iş: ${actions[0].title}.`);
  }
  return parts.join(" ");
}

export async function listCeoDailyReports(
  supabase: TypedSupabaseClient,
  limit = 14
) {
  const { data, error } = await supabase
    .from("ceo_daily_reports")
    .select("id, report_date, content_markdown, highlights, generated_at")
    .order("report_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
