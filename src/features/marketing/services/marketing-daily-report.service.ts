/**
 * Günlük AI Marketing Report — öneri üretir, kampanya kapatmaz / bütçe değiştirmez.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { getTodayIsoInIstanbul } from "@/features/ai/prompts/simple-assistant";
import { buildAttributionDashboard } from "@/features/marketing/services/attribution-dashboard.service";
import { listLearnings } from "@/features/marketing/services/marketing-learning.service";
import { formatTry } from "@/features/ceo-intelligence/utils/time";
import { AI_MARKETING_HARD_RULES } from "@/features/marketing/types";
import { buildMarketingIntelligenceBriefs } from "@/features/intelligence/services/marketing-briefs.service";
import { INTELLIGENCE_QUESTIONS } from "@/features/intelligence/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type MarketingDailyReportResult = {
  reportDate: string;
  id: string;
  created: boolean;
};

function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export async function generateMarketingDailyReport(
  supabase: TypedSupabaseClient,
  reportDate = getTodayIsoInIstanbul()
): Promise<MarketingDailyReportResult> {
  const dash = await buildAttributionDashboard(supabase, "last_30");
  const learnings = await listLearnings(supabase);
  const intelligenceBriefs = buildMarketingIntelligenceBriefs(dash);

  const top = dash.campaigns.slice(0, 5);
  const probableNote =
    dash.summary.revenueProbableExcluded > 0
      ? `Olası kaynak geliri hariç tutuldu: ${formatTry(dash.summary.revenueProbableExcluded)}`
      : "Olası kaynak geliri yok veya 0.";

  const bullets = [
    `30g harcama: ${formatTry(dash.summary.totalSpend)}`,
    `DM: ${dash.summary.dm} · Lead: ${dash.summary.lead} · Rezervasyon: ${dash.summary.reservation}`,
    `Kapora: ${dash.summary.kapora} · Çekim: ${dash.summary.shoot}`,
    `Kesin gelir: ${formatTry(dash.summary.revenueExact)} · ROI: ${pct(dash.summary.roi)}`,
    probableNote,
    `Attribution: exact ${dash.summary.byStatus.exact ?? 0}, probable ${dash.summary.byStatus.probable ?? 0}, unknown ${dash.summary.byStatus.unknown ?? 0}`,
  ];

  const recommendations: string[] = [];
  if (dash.summary.byStatus.unknown && dash.summary.byStatus.unknown > 5) {
    recommendations.push(
      "Bilinmeyen kaynak sayısı yüksek — müşteri detayından manuel kaynak veya UTM/fbclid toplama güçlendirilsin (öneri)."
    );
  }
  if (dash.summary.roi != null && dash.summary.roi < 0) {
    recommendations.push(
      "Son 30g ROI negatif (kesin gelir bazlı). Düşük kapora dönüşümlü kampanyalar gözden geçirilsin — otomatik kapatma yok."
    );
  }
  if (top[0] && top[0].kapora > 0) {
    recommendations.push(
      `En yüksek kesin gelir/kapora: ${top[0].campaignName}. Benzer kreatif test önerilir (deney).`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Yeterli güvenilir karar için daha fazla exact attribution ve kapora verisi gerekli."
    );
  }

  const sufficiency =
    dash.campaigns.length === 0
      ? "insufficient"
      : dash.summary.revenueExact > 0 || dash.summary.kapora > 0
        ? "sufficient"
        : "partial";

  const confidence =
    sufficiency === "sufficient" ? 70 : sufficiency === "partial" ? 45 : 20;

  const md = [
    `# Redmedia AI Marketing Report — ${reportDate}`,
    "",
    "> Kampanya otomatik kapatılmaz / bütçe değiştirilmez. Yalnızca analiz ve öneri.",
    "",
    "## Özet",
    ...bullets.map((b) => `- ${b}`),
    "",
    "## Kampanya özeti (top)",
    ...(top.length === 0
      ? ["- Veri yok"]
      : top.map(
          (c) =>
            `- **${c.campaignName}**: harcama ${formatTry(c.spend)}, DM ${c.dm}, lead ${c.lead}, rez ${c.reservation}, kapora ${c.kapora}, çekim ${c.shoot}, gelir ${formatTry(c.revenue)}, ROI ${pct(c.roi)} (probable: ${c.probableAttributed})`
        )),
    "",
    "## Öğrenimler (son)",
    ...(learnings.length === 0
      ? ["- Kayıtlı marketing learning yok"]
      : learnings
          .slice(0, 5)
          .map(
            (l) =>
              `- ${l.title} (${l.status}, güven %${l.confidence_level ?? "—"})`
          )),
    "",
    "## AI Intelligence",
    ...intelligenceBriefs.flatMap((b) => [
      `### ${b.title}`,
      `- Özet: ${b.summary}`,
      `- Confidence: %${b.confidence} (${b.confidenceBand})`,
      `- Priority: ${b.priority}`,
      `- ${INTELLIGENCE_QUESTIONS.why} ${b.why}`,
      `- ${INTELLIGENCE_QUESTIONS.whatNext} ${b.whatNext}`,
      `- ${INTELLIGENCE_QUESTIONS.doNow} ${b.doNow}`,
      `- Evidence: ${
        b.evidence.length > 0
          ? b.evidence.map((e) => `${e.label}=${e.value}`).join("; ")
          : "Yeterli veri bulunamadı."
      }`,
      "",
    ]),
    "## Öneriler",
    ...recommendations.map((r) => `- ${r}`),
    "",
    "## Kurallar",
    "```",
    AI_MARKETING_HARD_RULES,
    "```",
  ].join("\n");

  const metrics = {
    totalSpend: dash.summary.totalSpend,
    dm: dash.summary.dm,
    lead: dash.summary.lead,
    reservation: dash.summary.reservation,
    kapora: dash.summary.kapora,
    shoot: dash.summary.shoot,
    revenueExact: dash.summary.revenueExact,
    roi: dash.summary.roi,
    byStatus: dash.summary.byStatus,
    intelligenceBriefs,
  } as unknown as Json;

  const campaignRows = top.map((c) => ({
    campaignId: c.campaignId,
    name: c.campaignName,
    spend: c.spend,
    dm: c.dm,
    lead: c.lead,
    reservation: c.reservation,
    kapora: c.kapora,
    shoot: c.shoot,
    revenue: c.revenue,
    roi: c.roi,
  })) as unknown as Json;

  const learningsSnapshot = learnings.slice(0, 10).map((l) => ({
    id: l.id,
    title: l.title,
    status: l.status,
    confidence: l.confidence_level,
  })) as unknown as Json;

  const { data: existing } = await supabase
    .from("marketing_daily_reports")
    .select("id")
    .eq("report_date", reportDate)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("marketing_daily_reports")
      .update({
        summary_md: md,
        metrics,
        campaign_rows: campaignRows,
        learnings_snapshot: learningsSnapshot,
        data_sufficiency: sufficiency,
        overall_confidence: confidence,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return { reportDate, id: existing.id, created: false };
  }

  const { data, error } = await supabase
    .from("marketing_daily_reports")
    .insert({
      report_date: reportDate,
      summary_md: md,
      metrics,
      campaign_rows: campaignRows,
      learnings_snapshot: learningsSnapshot,
      data_sufficiency: sufficiency,
      overall_confidence: confidence,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { reportDate, id: data.id, created: true };
}

export async function listMarketingDailyReports(
  supabase: TypedSupabaseClient,
  limit = 14
) {
  const { data, error } = await supabase
    .from("marketing_daily_reports")
    .select("id, report_date, data_sufficiency, overall_confidence, created_at")
    .order("report_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getMarketingDailyReport(
  supabase: TypedSupabaseClient,
  reportDate: string
) {
  const { data, error } = await supabase
    .from("marketing_daily_reports")
    .select("*")
    .eq("report_date", reportDate)
    .maybeSingle();
  if (error) throw error;
  return data;
}
