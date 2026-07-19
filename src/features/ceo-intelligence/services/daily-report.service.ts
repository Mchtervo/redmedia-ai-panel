import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { getTodayIsoInIstanbul } from "@/features/ai/prompts/simple-assistant";
import { collectCeoMetrics } from "@/features/ceo-intelligence/services/metrics.service";
import {
  buildCeoActionItems,
  detectCeoRisks,
} from "@/features/ceo-intelligence/services/risks.service";
import {
  buildCeoRecommendations,
  buildSummaryBullets,
} from "@/features/ceo-intelligence/services/recommendations.service";
import { addDaysIso, formatTry } from "@/features/ceo-intelligence/utils/time";
import { LIFECYCLE_STAGE_LABELS } from "@/features/smart-sales/types";
import type { LifecycleStage } from "@/features/smart-sales/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type CeoDailyReportResult = {
  reportDate: string;
  id: string;
  created: boolean;
};

/**
 * Günlük yönetim raporu üretir / günceller. İşlem yapmaz; yalnızca yazar (rapor tablosu).
 */
export async function generateCeoDailyReport(
  supabase: TypedSupabaseClient,
  reportDate = getTodayIsoInIstanbul()
): Promise<CeoDailyReportResult> {
  const metrics = await collectCeoMetrics(supabase);
  // Force report date context: metrics always "today"; for historical we still use live today
  const risks = await detectCeoRisks(supabase, metrics);
  const recommendations = buildCeoRecommendations(metrics, risks);
  const actions = buildCeoActionItems(metrics, risks);
  const bullets = buildSummaryBullets(metrics);
  const tomorrow = addDaysIso(reportDate, 1);

  const tomorrowShoots = await supabase
    .from("reservations")
    .select("id, customer_full_name, event_type, start_time, status")
    .eq("event_date", tomorrow)
    .in("status", [
      "confirmed",
      "deposit_pending",
      "payment_review",
      "shoot_completed",
    ]);

  const bestConversation = await findBestConversation(supabase);
  const riskyCustomers = metrics.hotOpportunities
    .filter((h) => h.tags.includes("riskli müşteri"))
    .slice(0, 5);

  const md = [
    `# Redmedia Günlük Yönetim Raporu — ${reportDate}`,
    "",
    "## Özet",
    ...bullets.map((b) => `- ${b}`),
    "",
    "## Dönüşüm",
    `- Bu ay rezervasyon hattı: ${metrics.reservationsThisMonth}`,
    `- Bu ay iptal/kayıp: ${metrics.cancelledThisMonth}`,
    `- Dönüşüm oranı (ay): ${metrics.conversionRateMonth ?? "veri yok"}%`,
    `- Bugün doğrulanan kapora: ${metrics.depositsVerifiedToday}`,
    "",
    "## En sıcak fırsatlar",
    ...(metrics.hotOpportunities.length === 0
      ? ["- Kayıt yok"]
      : metrics.hotOpportunities.map(
          (h) =>
            `- ${h.name} — skor ${h.opportunityScore}, aşama: ${LIFECYCLE_STAGE_LABELS[h.lifecycleStage as LifecycleStage] ?? h.lifecycleStage}`
        )),
    "",
    "## Riskler",
    ...(risks.length === 0
      ? ["- Kritik risk yok"]
      : risks.slice(0, 10).map((r) => `- **${r.title}**: ${r.detail}`)),
    "",
    "## Öneriler (tavsiye)",
    ...recommendations.map((r) => `- **${r.title}**: ${r.detail}`),
    "",
    "## En başarılı konuşma sinyali",
    bestConversation
      ? `- ${bestConversation}`
      : "- Yeterli konuşma skoru verisi yok",
    "",
    "## İptal riski / riskli müşteriler",
    ...(riskyCustomers.length === 0
      ? ["- Etiketli riskli sıcak fırsat yok"]
      : riskyCustomers.map((r) => `- ${r.name} (skor ${r.opportunityScore})`)),
    "",
    "## Yarın yapılacaklar",
    ...(tomorrowShoots.data ?? []).length === 0
      ? ["- Yarın planlı çekim görünmüyor"]
      : (tomorrowShoots.data ?? []).map(
          (r) =>
            `- ${r.customer_full_name ?? "Müşteri"} — ${r.event_type ?? "?"} ${r.start_time ?? ""}`
        ),
    ...actions.slice(0, 5).map((a) => `- [ ] ${a.title}: ${a.detail}`),
    "",
    "## Ciro",
    `- Bugün tahmini: ${formatTry(metrics.estimatedRevenueToday)}`,
    `- Hafta tahmini: ${formatTry(metrics.estimatedRevenueThisWeek)}`,
    `- Bekleyen tahsilat: ${formatTry(metrics.pendingCollections)}`,
    "",
    "_Bu rapor salt okuma analizidir. Fiyat/kampanya/personel/ödeme/rezervasyon değiştirmez._",
  ].join("\n");

  const highlights = {
    newCustomers: metrics.newCustomersToday,
    reservationsMonth: metrics.reservationsThisMonth,
    deposits: metrics.depositsVerifiedToday,
    cancelled: metrics.cancelledThisMonth,
    conversionRate: metrics.conversionRateMonth,
    risks: risks.slice(0, 5),
    tomorrowShootCount: tomorrowShoots.data?.length ?? 0,
  };

  const { data: existing } = await supabase
    .from("ceo_daily_reports")
    .select("id")
    .eq("report_date", reportDate)
    .maybeSingle();

  const { data, error } = await supabase
    .from("ceo_daily_reports")
    .upsert(
      {
        report_date: reportDate,
        metrics: metrics as unknown as Json,
        content_markdown: md,
        highlights: highlights as unknown as Json,
        generated_at: new Date().toISOString(),
        model: null,
      },
      { onConflict: "report_date" }
    )
    .select("id")
    .single();

  if (error) throw error;

  return {
    reportDate,
    id: data.id,
    created: !existing,
  };
}

async function findBestConversation(
  supabase: TypedSupabaseClient
): Promise<string | null> {
  const { data } = await supabase
    .from("customer_profiles")
    .select("full_name, username, opportunity_score, last_summary, lifecycle_stage")
    .gte("opportunity_score", 50)
    .in("lifecycle_stage", [
      "reservation_confirmed",
      "awaiting_deposit",
      "awaiting_receipt",
      "completed",
    ])
    .order("opportunity_score", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const name = data.full_name || data.username || "Müşteri";
  const summary = data.last_summary?.slice(0, 160);
  return `${name} (skor ${data.opportunity_score})${summary ? ` — ${summary}` : ""}`;
}
