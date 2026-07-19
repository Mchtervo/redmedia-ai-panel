/**
 * Self Learning — haftalık kayıp özeti (veriye dayalı, kural yığını değil).
 * Claude/Cursor/insan için aksiyon raporu üretir.
 */

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getTodayIsoInIstanbul } from "@/features/ai/prompts/simple-assistant";
import {
  loadLatestLostSaleAnalyses,
  type LostSaleReason,
} from "@/features/ai/services/lost-sale-analyzer.service";

type TypedSupabase = SupabaseClient<Database>;

export type SelfLearningReasonCount = {
  reason: string;
  count: number;
};

export type SelfLearningWeeklyReport = {
  id: string;
  weekStart: string;
  weekEnd: string;
  createdAt: string;
  lostConversationCount: number;
  reasonCounts: SelfLearningReasonCount[];
  biggestProblem: string;
  narrative: string;
  recommendations: string[];
};

const LOCAL_DIR = path.join(process.cwd(), ".data", "self-learning");

const LOST_SALE_REASON_SET = new Set<string>([
  "price",
  "trust",
  "wrong_reply",
  "too_long",
  "late_price",
  "early_price",
  "wrong_nba",
  "competitor",
  "unknown",
]);

const REASON_LABELS: Record<string, string> = {
  price: "fiyat",
  trust: "güven",
  wrong_reply: "yanlış cevap",
  too_long: "çok uzun cevap",
  late_price: "geç fiyat",
  early_price: "erken fiyat",
  wrong_nba: "yanlış NBA",
  competitor: "rakip",
  misunderstood: "yanlış anlama",
  oversell: "fazla satış",
  unknown: "belirsiz",
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

function normalizeLossReason(raw: string | null | undefined): string {
  if (!raw) return "unknown";
  const n = raw.toLocaleLowerCase("tr-TR");
  if (/fiyat|price|pahalı|bütçe/.test(n)) return "price";
  if (/güven|trust|şüphe/.test(n)) return "trust";
  if (/uzun|dump|bilgi\s*yığ/.test(n)) return "too_long";
  if (/yanlış\s*anla|misunderstand/.test(n)) return "misunderstood";
  if (/erken\s*fiyat|early_price/.test(n)) return "early_price";
  if (/geç\s*fiyat|late_price/.test(n)) return "late_price";
  if (/rakip|competitor/.test(n)) return "competitor";
  if (/nba|yanlış\s*aksiyon/.test(n)) return "wrong_nba";
  if (/fazla\s*sat|oversell/.test(n)) return "oversell";
  if (LOST_SALE_REASON_SET.has(n as LostSaleReason)) return n;
  return "unknown";
}

/**
 * Geçen haftanın kayıp konuşmalarından Self Learning raporu.
 */
export async function generateSelfLearningWeeklyReport(
  supabase: TypedSupabase,
  options?: { weekStart?: string }
): Promise<SelfLearningWeeklyReport> {
  const today = getTodayIsoInIstanbul();
  const weekStart = options?.weekStart ?? getWeekStart(addDays(today, -7));
  const weekEnd = addDays(weekStart, 6);
  const weekStartTs = `${weekStart}T00:00:00Z`;
  const weekEndTs = `${addDays(weekEnd, 1)}T00:00:00Z`;

  const counts = new Map<string, number>();
  const seenConversationIds = new Set<string>();
  let lostConversationCount = 0;

  const bump = (reasonRaw: string | null | undefined) => {
    lostConversationCount += 1;
    const key = normalizeLossReason(reasonRaw);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  // Öncelik: Conversation Recorder etiketleri (gerçek outcome)
  const { data: tags } = await supabase
    .from("conversation_outcome_tags")
    .select("conversation_id, customer_lost, lost_reason, updated_at")
    .eq("customer_lost", true)
    .gte("updated_at", weekStartTs)
    .lt("updated_at", weekEndTs);

  for (const row of tags ?? []) {
    seenConversationIds.add(row.conversation_id);
    bump(row.lost_reason);
  }

  const { data: analyses } = await supabase
    .from("conversation_analyses")
    .select("id, sale_outcome, loss_reason, analyzed_at, conversation_id")
    .eq("sale_outcome", "lost")
    .gte("analyzed_at", weekStartTs)
    .lt("analyzed_at", weekEndTs);

  for (const row of analyses ?? []) {
    if (row.conversation_id && seenConversationIds.has(row.conversation_id)) {
      continue;
    }
    if (row.conversation_id) seenConversationIds.add(row.conversation_id);
    bump(row.loss_reason);
  }

  const { data: lostRows } = await supabase
    .from("lost_sale_analyses")
    .select("conversation_id, primary_reason, created_at")
    .gte("created_at", weekStartTs)
    .lt("created_at", weekEndTs);

  for (const row of lostRows ?? []) {
    if (row.conversation_id && seenConversationIds.has(row.conversation_id)) {
      continue;
    }
    if (row.conversation_id) seenConversationIds.add(row.conversation_id);
    bump(row.primary_reason);
  }

  // Migration yoksa yerel yedek
  if ((lostRows ?? []).length === 0) {
    const local = await loadLatestLostSaleAnalyses(200);
    for (const a of local) {
      if (a.createdAt < weekStartTs || a.createdAt >= weekEndTs) continue;
      if (seenConversationIds.has(a.conversationId)) continue;
      seenConversationIds.add(a.conversationId);
      bump(a.primaryReason);
    }
  }

  const reasonCounts: SelfLearningReasonCount[] = [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const top = reasonCounts[0];
  const biggestProblem = top
    ? `En büyük problem: ${REASON_LABELS[top.reason] ?? top.reason} (${top.count}).`
    : "Bu hafta kayıp konuşma verisi yetersiz.";

  const narrative =
    lostConversationCount === 0
      ? "Bu hafta etiketlenmiş kayıp konuşma bulunamadı. Gerçek DM'leri anonimleştirip Lost Sale Analyzer / learning batch ile besleyin."
      : [
          `Bu hafta ${lostConversationCount} konuşma kaybettim.`,
          "",
          "En çok sebep:",
          ...reasonCounts
            .slice(0, 6)
            .map((r) => `↓ ${r.count} ${REASON_LABELS[r.reason] ?? r.reason}`),
          "",
          biggestProblem,
          "",
          "Öneri: Yeni kural ekleme. Yalnızca bu kayıp etiketlerine göre ince ayar; Human vs AI ile gerçek DM farkını ölç.",
        ].join("\n");

  const recommendations: string[] = [];
  if (top?.reason === "price") {
    recommendations.push(
      "Fiyat itirazı: Strategist fiyat zamanlamasını gerçek DM'lerle kalibre et."
    );
  }
  if (top?.reason === "too_long") {
    recommendations.push(
      "Uzun cevap: Multi Judge dump bayrağı + maxLines disiplinini koru."
    );
  }
  if (top?.reason === "trust" || top?.reason === "misunderstood") {
    recommendations.push(
      "Güven/yanlış anlama: empathy_only ve build_trust hamlelerini kayıp turlarında benchmark et."
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Anonim gerçek DM → Human vs AI → kayıp etiketleri → yalnız zayıf noktaya müdahale."
    );
  }

  const report: SelfLearningWeeklyReport = {
    id: randomUUID(),
    weekStart,
    weekEnd,
    createdAt: new Date().toISOString(),
    lostConversationCount,
    reasonCounts,
    biggestProblem,
    narrative,
    recommendations,
  };

  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(
    path.join(LOCAL_DIR, `${weekStart}.json`),
    JSON.stringify(report, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(LOCAL_DIR, "latest.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  return report;
}

export async function loadLatestSelfLearningReport(): Promise<SelfLearningWeeklyReport | null> {
  try {
    const raw = await fs.readFile(path.join(LOCAL_DIR, "latest.json"), "utf8");
    return JSON.parse(raw) as SelfLearningWeeklyReport;
  } catch {
    return null;
  }
}

export function formatSelfLearningReportText(
  report: SelfLearningWeeklyReport
): string {
  return [
    `# Self Learning — ${report.weekStart} → ${report.weekEnd}`,
    "",
    report.narrative,
    "",
    "## Tavsiyeler",
    ...report.recommendations.map((r) => `- ${r}`),
  ].join("\n");
}
