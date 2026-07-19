import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { getTodayIsoInIstanbul } from "@/features/ai/prompts/simple-assistant";
import {
  AI_MISTAKE_TYPE_LABELS,
  PERSONALITY_TRAIT_TYPE_LABELS,
  SALES_PATTERN_TYPE_LABELS,
  type AiWeeklyReportRow,
} from "@/features/sales-learning/types";

type TypedSupabaseClient = SupabaseClient<Database>;

/** Bu süre boyunca tekrarlanmayan hata "düzeltildi" sayılır. */
const MISTAKE_RESOLVE_DAYS = 14;

export type GenerateWeeklyReportResult = {
  report: AiWeeklyReportRow;
  created: boolean;
};

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Verilen günün içinde bulunduğu haftanın Pazartesi'si (Europe/Istanbul). */
export function getWeekStart(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!, 12));
  const day = date.getUTCDay(); // 0 = Pazar
  const diff = day === 0 ? 6 : day - 1;
  return addDays(isoDate, -diff);
}

function jsonList(items: string[]): Json {
  return items as unknown as Json;
}

/**
 * Haftalık AI öz değerlendirme raporu (Quality Control).
 * Tamamen veritabanındaki gerçek kayıtlara dayanır; kanıt yoksa
 * "Yeterli veri bulunamadı." yazılır, uydurma içerik üretilmez.
 */
export async function generateAiWeeklyReport(
  supabase: TypedSupabaseClient,
  options?: { weekStart?: string; force?: boolean }
): Promise<GenerateWeeklyReportResult> {
  const today = getTodayIsoInIstanbul();
  const weekStart = options?.weekStart ?? getWeekStart(addDays(today, -7));
  const weekEnd = addDays(weekStart, 6);

  const { data: existing, error: existingError } = await supabase
    .from("ai_weekly_reports")
    .select("*")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing && !options?.force) {
    return { report: existing, created: false };
  }

  const weekStartTs = `${weekStart}T00:00:00Z`;
  const weekEndTs = `${addDays(weekEnd, 1)}T00:00:00Z`;

  // 1) Uzun süre tekrarlanmayan hataları otomatik çöz (Self Improvement).
  const resolveBefore = new Date(
    Date.now() - MISTAKE_RESOLVE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: autoResolved, error: resolveError } = await supabase
    .from("ai_mistakes")
    .update({
      is_resolved: true,
      resolved_note: `Son ${MISTAKE_RESOLVE_DAYS} günde tekrarlanmadı.`,
    })
    .eq("is_resolved", false)
    .lt("last_seen_at", resolveBefore)
    .select("id, mistake_type, trigger_context, correct_approach");
  if (resolveError) throw resolveError;

  // 2) Haftanın verileri.
  const [analysesRes, newPatternsRes, newTraitsRes, weekMistakesRes, fixedRes] =
    await Promise.all([
      supabase
        .from("conversation_analyses")
        .select(
          "id, customer_intent, sale_outcome, score_sales_quality, score_empathy, score_speed, score_persuasion, score_closing, advancing_reply, losing_reply, reservation_created, deposit_received, analyzed_at"
        )
        .gte("analyzed_at", weekStartTs)
        .lt("analyzed_at", weekEndTs)
        .eq("learning_status", "completed"),
      supabase
        .from("sales_patterns")
        .select("pattern_type, pattern_text, success_rate, seen_count")
        .gte("first_seen_at", weekStartTs)
        .lt("first_seen_at", weekEndTs)
        .order("success_rate", { ascending: false, nullsFirst: false })
        .limit(20),
      supabase
        .from("company_personality_traits")
        .select("trait_type, trait_text, evidence_count")
        .gte("first_seen_at", weekStartTs)
        .lt("first_seen_at", weekEndTs)
        .limit(20),
      supabase
        .from("ai_mistakes")
        .select("mistake_type, trigger_context, correct_approach, occurrence_count")
        .gte("last_seen_at", weekStartTs)
        .lt("last_seen_at", weekEndTs)
        .limit(20),
      supabase
        .from("ai_mistakes")
        .select("mistake_type, trigger_context, correct_approach")
        .eq("is_resolved", true)
        .gte("updated_at", weekStartTs)
        .limit(20),
    ]);

  if (analysesRes.error) throw analysesRes.error;
  if (newPatternsRes.error) throw newPatternsRes.error;
  if (newTraitsRes.error) throw newTraitsRes.error;
  if (weekMistakesRes.error) throw weekMistakesRes.error;
  if (fixedRes.error) throw fixedRes.error;

  const analyses = analysesRes.data ?? [];
  const newPatterns = newPatternsRes.data ?? [];
  const newTraits = newTraitsRes.data ?? [];
  const weekMistakes = weekMistakesRes.data ?? [];
  const fixedMistakes = [
    ...(fixedRes.data ?? []),
    ...(autoResolved ?? []),
  ].slice(0, 20);

  // 3) Rapor içeriği.
  const learnedItems = [
    ...newTraits.map(
      (t) =>
        `[${PERSONALITY_TRAIT_TYPE_LABELS[t.trait_type]}] ${t.trait_text}`
    ),
    ...newPatterns
      .filter(
        (p) => p.pattern_type !== "failure" && p.pattern_type !== "leave_reason"
      )
      .map(
        (p) => `[${SALES_PATTERN_TYPE_LABELS[p.pattern_type]}] ${p.pattern_text}`
      ),
  ];

  const newTechniques = newPatterns
    .filter(
      (p) =>
        (p.pattern_type === "price_explanation" ||
          p.pattern_type === "objection_response" ||
          p.pattern_type === "closing" ||
          p.pattern_type === "trust_building" ||
          p.pattern_type === "opening") &&
        (p.success_rate == null || p.success_rate >= 50)
    )
    .map(
      (p) =>
        `[${SALES_PATTERN_TYPE_LABELS[p.pattern_type]}] ${p.pattern_text}` +
        (p.success_rate != null ? ` (başarı %${Math.round(p.success_rate)})` : "")
    );

  const mistakesMade = weekMistakes.map(
    (m) =>
      `[${AI_MISTAKE_TYPE_LABELS[m.mistake_type]}] ${m.trigger_context} (${m.occurrence_count} kez)`
  );

  const mistakesFixed = fixedMistakes.map(
    (m) =>
      `[${AI_MISTAKE_TYPE_LABELS[m.mistake_type]}] ${m.trigger_context} → ${m.correct_approach}`
  );

  const scored = analyses.filter((a) => a.score_sales_quality != null);
  const bestReplies = [...scored]
    .sort((a, b) => (b.score_sales_quality ?? 0) - (a.score_sales_quality ?? 0))
    .slice(0, 5)
    .filter((a) => a.advancing_reply)
    .map(
      (a) => `(${a.score_sales_quality}/100) ${a.advancing_reply}`
    );

  const worstReplies = [...scored]
    .sort((a, b) => (a.score_sales_quality ?? 0) - (b.score_sales_quality ?? 0))
    .slice(0, 5)
    .filter((a) => a.losing_reply)
    .map((a) => `(${a.score_sales_quality}/100) ${a.losing_reply}`);

  const avg = (values: Array<number | null>): number | null => {
    const nums = values.filter((v): v is number => v != null);
    if (nums.length === 0) return null;
    return Math.round(nums.reduce((sum, v) => sum + v, 0) / nums.length);
  };

  const { collectReservationBlockers, formatReservationBlockersMarkdown } =
    await import(
      "@/features/sales-learning/services/reservation-blockers.service"
    );
  const reservationBlockers = await collectReservationBlockers(supabase, {
    days: 7,
  });

  const metrics = {
    analyzedConversations: analyses.length,
    wonCount: analyses.filter((a) => a.sale_outcome === "won").length,
    lostCount: analyses.filter((a) => a.sale_outcome === "lost").length,
    reservationCount: analyses.filter((a) => a.reservation_created).length,
    depositCount: analyses.filter((a) => a.deposit_received).length,
    avgSalesQuality: avg(analyses.map((a) => a.score_sales_quality)),
    avgEmpathy: avg(analyses.map((a) => a.score_empathy)),
    avgSpeed: avg(analyses.map((a) => a.score_speed)),
    avgPersuasion: avg(analyses.map((a) => a.score_persuasion)),
    avgClosing: avg(analyses.map((a) => a.score_closing)),
    newPatternCount: newPatterns.length,
    newTraitCount: newTraits.length,
    mistakeCount: weekMistakes.length,
    fixedMistakeCount: fixedMistakes.length,
    reservationBlockers: {
      analyzedWithoutReservation:
        reservationBlockers.analyzedWithoutReservation,
      lostCount: reservationBlockers.lostCount,
      openCount: reservationBlockers.openCount,
      topReasons: reservationBlockers.topReasons.slice(0, 5),
      topDropOffs: reservationBlockers.topDropOffs.slice(0, 5),
      dataSufficiency: reservationBlockers.dataSufficiency,
    },
  };

  const dataSufficiency: AiWeeklyReportRow["data_sufficiency"] =
    analyses.length >= 10
      ? "sufficient"
      : analyses.length >= 3
        ? "partial"
        : "insufficient";

  const section = (title: string, items: string[]): string =>
    items.length === 0
      ? `## ${title}\nYeterli veri bulunamadı.`
      : `## ${title}\n${items.map((item) => `- ${item}`).join("\n")}`;

  const summaryMd = [
    `# AI Haftalık Öz Değerlendirme (${weekStart} – ${weekEnd})`,
    "",
    `Bu hafta ${analyses.length} konuşma analiz edildi. ` +
      (metrics.avgSalesQuality != null
        ? `Ortalama satış kalitesi ${metrics.avgSalesQuality}/100.`
        : "Puanlanmış konuşma yok."),
    "",
    section("Bu hafta öğrendiklerim", learnedItems.slice(0, 15)),
    "",
    section("Yaptığım hatalar", mistakesMade.slice(0, 10)),
    "",
    section("Düzelttiğim hatalar", mistakesFixed.slice(0, 10)),
    "",
    section("Yeni öğrendiğim satış teknikleri", newTechniques.slice(0, 10)),
    "",
    section("En başarılı cevaplar", bestReplies),
    "",
    section("En başarısız cevaplar", worstReplies),
    "",
    formatReservationBlockersMarkdown(reservationBlockers),
  ].join("\n");

  const payload = {
    week_start: weekStart,
    week_end: weekEnd,
    summary_md: summaryMd,
    learned_items: jsonList(learnedItems.slice(0, 30)),
    mistakes_made: jsonList(mistakesMade),
    mistakes_fixed: jsonList(mistakesFixed),
    new_techniques: jsonList(newTechniques),
    best_replies: jsonList(bestReplies),
    worst_replies: jsonList(worstReplies),
    metrics: metrics as unknown as Json,
    data_sufficiency: dataSufficiency,
  };

  const { data: report, error: upsertError } = await supabase
    .from("ai_weekly_reports")
    .upsert(payload, { onConflict: "week_start" })
    .select("*")
    .single();
  if (upsertError) throw upsertError;

  return { report, created: !existing };
}

export async function getLatestWeeklyReport(
  supabase: TypedSupabaseClient
): Promise<AiWeeklyReportRow | null> {
  const { data, error } = await supabase
    .from("ai_weekly_reports")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
