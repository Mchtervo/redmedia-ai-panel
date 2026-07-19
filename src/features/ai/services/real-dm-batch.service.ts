/**
 * Gerçek Instagram DM batch analizi.
 * Kaynak: ChatPlace MCP sync (salt okuma) → panel DB.
 * Meta Graph mesaj geçmişi yok; gönderim YOK.
 */

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { syncChatPlaceConversations } from "@/features/conversations/services/chatplace-sync.service";
import { isChatPlaceMcpConfigured } from "@/server/chatplace/mcp-client";
import { listMessagesByConversation } from "@/features/conversations/repositories/messages.repository";
import { qualifyRealCustomerConversation } from "@/features/ai/services/real-dm-qualify.service";
import {
  computeAvgReplySeconds,
  tagRealDmConversation,
  type RealDmTag,
} from "@/features/ai/services/real-dm-tagger.service";
import {
  anonymizeCustomerLabel,
  anonymizeDmText,
} from "@/features/ai/services/real-dm-anonymize";
import {
  formatHumanVsAiReport,
  runHumanVsAiBenchmark,
  type HumanVsAiResult,
} from "@/features/ai/benchmarks/human-vs-ai.service";
import { isOpenAiConfigured } from "@/lib/ai/openai-client";

type TypedSupabase = SupabaseClient<Database>;

const LOCAL_DIR = path.join(process.cwd(), ".data", "real-dm-batches");

export type RealDmConversationRow = {
  conversationId: string;
  label: string;
  lastMessageAt: string | null;
  statusLabel: string;
  tags: RealDmTag[];
  primaryLossReason: string | null;
  hasStaff: boolean;
  reservation: boolean;
  deposit: boolean;
  customerTypeGuess: string | null;
  packageLean: string | null;
  messageCount: number;
  avgReplySeconds: number | null;
  rejected: boolean;
  rejectReason: string | null;
};

export type RealDmBatchSummary = {
  id: string;
  createdAt: string;
  source: "chatplace_instagram";
  sync: {
    status: string;
    chatsScanned: number;
    chatsSynced: number;
    messagesImported: number;
    errors: string[];
  };
  found: number;
  analyzed: number;
  rejected: number;
  rejectBreakdown: Record<string, number>;
  reservations: number;
  deposits: number;
  topLossReasons: { reason: string; count: number }[];
  kpis: {
    replyRate: number;
    conversationRate: number;
    priceAcceptedRate: number;
    depositRate: number;
    reservationRate: number;
    avgReplySeconds: number | null;
  };
  conversionByCustomerType: { type: string; total: number; reservations: number; rate: number }[];
  conversionByPackage: { package: string; total: number; reservations: number; rate: number }[];
  humanVsAi: {
    compared: number;
    humanAverage: number | null;
    aiAverage: number | null;
    humanWins: number;
    aiWins: number;
    topErrorMessageType: string | null;
  };
  conversations: RealDmConversationRow[];
  comparisons: HumanVsAiResult[];
  connectorReport: string[];
};

function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.round((n / d) * 1000) / 10;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
}

async function listRecentInstagramConversations(
  supabase: TypedSupabase,
  limit: number
): Promise<
  {
    id: string;
    status: string;
    last_message_at: string | null;
    assigned_to: string | null;
  }[]
> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, status, last_message_at, assigned_to")
    .eq("channel", "instagram")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

async function reservationFlags(
  supabase: TypedSupabase,
  conversationId: string
): Promise<{ reservation: boolean; deposit: boolean }> {
  const { data } = await supabase
    .from("reservations")
    .select("status, deposit_status")
    .eq("conversation_id", conversationId)
    .limit(5);

  const reservation = (data ?? []).some((r) =>
    [
      "deposit_pending",
      "payment_review",
      "confirmed",
      "completed",
      "shoot_completed",
    ].includes(r.status)
  );
  const deposit = (data ?? []).some((r) => r.deposit_status === "verified");
  return { reservation, deposit };
}

function guessErrorMessageType(result: HumanVsAiResult): string {
  const behind = result.turns.find(
    (t) =>
      t.turnIndex === result.firstBehindTurnIndex ||
      ((t.aiScore ?? 0) < (t.humanScore ?? 0) - 5)
  );
  if (!behind) return "genel";
  const msg = behind.customerMessage.toLocaleLowerCase("tr-TR");
  if (/fiyat|kaç|ne kadar|ücret/.test(msg)) return "fiyat sorusu";
  if (/eş|nişanlı|soracağım/.test(msg)) return "eş danışma";
  if (/pahalı|bütçe|indirim/.test(msg)) return "fiyat itirazı";
  if (/örnek|referans|video/.test(msg)) return "örnek/referans";
  if (/plato|drone|album|albüm/.test(msg)) return "paket/hizmet";
  return "genel satış";
}

/**
 * Son N Instagram DM'yi sync + filtre + etiket (+ opsiyonel Human vs AI).
 * Mesaj gönderilmez.
 */
export async function runRealDmBatchAnalysis(
  supabase: TypedSupabase,
  options: {
    maxConversations?: number;
    compareLimit?: number;
    syncFirst?: boolean;
    maxHvATurns?: number;
  } = {}
): Promise<RealDmBatchSummary> {
  const maxConversations = Math.min(500, options.maxConversations ?? 500);
  const compareLimit = Math.min(100, options.compareLimit ?? 0);
  const syncFirst = options.syncFirst !== false;

  const connectorReport = [
    "Instagram DM geçmişi: ChatPlace MCP (chats_list / chats_messages) — salt okuma.",
    "Servis: syncChatPlaceConversations (chatplace-sync.service.ts).",
    "Meta Graph: OAuth + IGSID + outbound send; mesaj geçmişi sync YOK.",
    "Canlı AI cevap: ayrı feature flag (AI_DM_ASSISTANT); bu pipeline göndermez.",
  ];

  let syncResult = {
    status: "skipped",
    chatsScanned: 0,
    chatsSynced: 0,
    messagesImported: 0,
    errors: [] as string[],
  };

  if (syncFirst && isChatPlaceMcpConfigured()) {
    console.info(
      `[real-dm] ChatPlace sync başlıyor (maxChats=${maxConversations})…`
    );
    const sync = await syncChatPlaceConversations(supabase, {
      mode: "incremental",
      maxChats: Math.min(maxConversations, 200),
      maxMessagePagesPerChat: 4,
    });
    syncResult = {
      status: sync.status,
      chatsScanned: sync.chatsScanned,
      chatsSynced: sync.chatsSynced,
      messagesImported: sync.messagesImported,
      errors: sync.errors.slice(0, 10),
    };
    console.info(
      `[real-dm] sync bitti: scanned=${sync.chatsScanned} imported=${sync.messagesImported}`
    );
  } else if (!isChatPlaceMcpConfigured()) {
    syncResult.errors.push("ChatPlace MCP yapılandırılmamış — yalnızca DB.");
    connectorReport.push("UYARI: ChatPlace env yok; mevcut DB kayıtları kullanıldı.");
  }

  const convs = await listRecentInstagramConversations(
    supabase,
    maxConversations
  );
  console.info(`[real-dm] DB'den ${convs.length} Instagram konuşması`);

  const rejectBreakdown: Record<string, number> = {};
  const rows: RealDmConversationRow[] = [];
  const analyzedRows: RealDmConversationRow[] = [];
  let rejected = 0;

  for (let i = 0; i < convs.length; i++) {
    if (i > 0 && i % 50 === 0) {
      console.info(`[real-dm] etiketleme ${i}/${convs.length}…`);
    }
    const conv = convs[i]!;
    const messages = await listMessagesByConversation(supabase, conv.id);
    const qualify = qualifyRealCustomerConversation({ messages });

    if (!qualify.ok) {
      rejected += 1;
      rejectBreakdown[qualify.reason] =
        (rejectBreakdown[qualify.reason] ?? 0) + 1;
      rows.push({
        conversationId: conv.id,
        label: anonymizeCustomerLabel({
          conversationId: conv.id,
          index: i,
        }),
        lastMessageAt: conv.last_message_at,
        statusLabel: "Elendi",
        tags: [],
        primaryLossReason: null,
        hasStaff: messages.some((m) => m.sender_type === "staff"),
        reservation: false,
        deposit: false,
        customerTypeGuess: null,
        packageLean: null,
        messageCount: messages.length,
        avgReplySeconds: null,
        rejected: true,
        rejectReason: qualify.reason,
      });
      continue;
    }

    const flags = await reservationFlags(supabase, conv.id);
    const tagged = tagRealDmConversation({
      messages,
      hasReservation: flags.reservation,
      hasDeposit: flags.deposit,
      conversationStatus: conv.status,
    });

    // Outcome tag yaz (anonim rapor için)
    try {
      await supabase.from("conversation_outcome_tags").upsert(
        {
          conversation_id: conv.id,
          reservation: flags.reservation,
          deposit: flags.deposit,
          customer_lost: tagged.tags.includes("customer_lost"),
          lost_reason: tagged.primaryLossReason,
          conversation_length: messages.length,
          customer_type: tagged.customerTypeGuess,
          confidence: tagged.primaryLossReason ? 0.75 : 0.5,
          customer_replied: messages.filter((m) => m.sender_type === "customer")
            .length >= 2,
          price_mentioned: /fiyat|11\.?000|14\.?000|21\.?000/i.test(
            messages.map((m) => m.content ?? "").join("\n")
          ),
          price_accepted: tagged.tags.includes("price_objection")
            ? false
            : flags.reservation
              ? true
              : null,
          tag: {
            tags: tagged.tags,
            status: tagged.statusLabel,
            package: tagged.packageLean,
            source: "real_dm_batch",
          } as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "conversation_id" }
      );
    } catch {
      /* tablo yoksa devam */
    }

    const row: RealDmConversationRow = {
      conversationId: conv.id,
      label: anonymizeCustomerLabel({ conversationId: conv.id, index: i }),
      lastMessageAt: conv.last_message_at,
      statusLabel: tagged.statusLabel,
      tags: tagged.tags,
      primaryLossReason: tagged.primaryLossReason,
      hasStaff: messages.some((m) => m.sender_type === "staff"),
      reservation: flags.reservation,
      deposit: flags.deposit,
      customerTypeGuess: tagged.customerTypeGuess,
      packageLean: tagged.packageLean,
      messageCount: messages.length,
      avgReplySeconds: computeAvgReplySeconds(messages),
      rejected: false,
      rejectReason: null,
    };
    rows.push(row);
    analyzedRows.push(row);
  }

  // Human vs AI karşılaştırması (yalnız personel cevabı olanlar)
  const comparisons: HumanVsAiResult[] = [];
  const compareCandidates = analyzedRows
    .filter((r) => r.hasStaff)
    .slice(0, compareLimit);

  if (compareLimit > 0 && isOpenAiConfigured()) {
    for (const c of compareCandidates) {
      try {
        const result = await runHumanVsAiBenchmark(supabase, c.conversationId, {
          maxTurns: options.maxHvATurns ?? 3,
        });
        // Anonimleştir çıktılar
        result.turns = result.turns.map((t) => ({
          ...t,
          customerMessage: anonymizeDmText(t.customerMessage),
          humanReply: anonymizeDmText(t.humanReply),
          aiReply: anonymizeDmText(t.aiReply),
        }));
        comparisons.push(result);
      } catch {
        /* personel çifti yok / hata */
      }
    }
  }

  const lossMap = new Map<string, number>();
  for (const r of analyzedRows) {
    if (r.primaryLossReason) {
      lossMap.set(
        r.primaryLossReason,
        (lossMap.get(r.primaryLossReason) ?? 0) + 1
      );
    }
  }
  const topLossReasons = [...lossMap.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const replied = analyzedRows.filter((r) => r.messageCount >= 2).length;
  const conversed = analyzedRows.filter((r) => r.messageCount >= 4).length;
  const priceMentioned = analyzedRows.filter((r) =>
    r.tags.includes("price_objection") || r.reservation
  ).length;
  const priceOk = analyzedRows.filter(
    (r) => r.reservation && !r.tags.includes("price_objection")
  ).length;
  const reservations = analyzedRows.filter((r) => r.reservation).length;
  const deposits = analyzedRows.filter((r) => r.deposit).length;
  const replySecs = analyzedRows
    .map((r) => r.avgReplySeconds)
    .filter((n): n is number => n != null);
  const avgReplySeconds =
    replySecs.length > 0
      ? Math.round(replySecs.reduce((a, b) => a + b, 0) / replySecs.length)
      : null;

  const byType = new Map<string, { total: number; reservations: number }>();
  for (const r of analyzedRows) {
    const t = r.customerTypeGuess ?? "unknown";
    const cur = byType.get(t) ?? { total: 0, reservations: 0 };
    cur.total += 1;
    if (r.reservation) cur.reservations += 1;
    byType.set(t, cur);
  }

  const byPkg = new Map<string, { total: number; reservations: number }>();
  for (const r of analyzedRows) {
    const p = r.packageLean ?? "unknown";
    const cur = byPkg.get(p) ?? { total: 0, reservations: 0 };
    cur.total += 1;
    if (r.reservation) cur.reservations += 1;
    byPkg.set(p, cur);
  }

  const humanAvg =
    comparisons.length > 0
      ? comparisons.reduce((s, c) => s + c.humanAverage, 0) / comparisons.length
      : null;
  const aiAvg =
    comparisons.length > 0
      ? comparisons.reduce((s, c) => s + c.aiAverage, 0) / comparisons.length
      : null;
  let humanWins = 0;
  let aiWins = 0;
  const errorTypes = new Map<string, number>();
  for (const c of comparisons) {
    if (c.humanAverage > c.aiAverage) humanWins += 1;
    else if (c.aiAverage > c.humanAverage) aiWins += 1;
    const et = guessErrorMessageType(c);
    errorTypes.set(et, (errorTypes.get(et) ?? 0) + 1);
  }
  const topError =
    [...errorTypes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const summary: RealDmBatchSummary = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    source: "chatplace_instagram",
    sync: syncResult,
    found: convs.length,
    analyzed: analyzedRows.length,
    rejected,
    rejectBreakdown,
    reservations,
    deposits,
    topLossReasons,
    kpis: {
      replyRate: pct(replied, analyzedRows.length),
      conversationRate: pct(conversed, analyzedRows.length),
      priceAcceptedRate: pct(priceOk, Math.max(priceMentioned, 1)),
      depositRate: pct(deposits, analyzedRows.length),
      reservationRate: pct(reservations, analyzedRows.length),
      avgReplySeconds,
    },
    conversionByCustomerType: [...byType.entries()].map(([type, v]) => ({
      type,
      total: v.total,
      reservations: v.reservations,
      rate: pct(v.reservations, v.total),
    })),
    conversionByPackage: [...byPkg.entries()].map(([pkg, v]) => ({
      package: pkg,
      total: v.total,
      reservations: v.reservations,
      rate: pct(v.reservations, v.total),
    })),
    humanVsAi: {
      compared: comparisons.length,
      humanAverage:
        humanAvg != null ? Math.round(humanAvg * 10) / 10 : null,
      aiAverage: aiAvg != null ? Math.round(aiAvg * 10) / 10 : null,
      humanWins,
      aiWins,
      topErrorMessageType: topError,
    },
    conversations: rows.filter((r) => !r.rejected).slice(0, 100),
    comparisons,
    connectorReport,
  };

  await ensureDir();
  await fs.writeFile(
    path.join(LOCAL_DIR, `${summary.id}.json`),
    JSON.stringify(summary, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(LOCAL_DIR, "latest.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );

  return summary;
}

export async function loadLatestRealDmBatch(): Promise<RealDmBatchSummary | null> {
  try {
    const raw = await fs.readFile(path.join(LOCAL_DIR, "latest.json"), "utf8");
    return JSON.parse(raw) as RealDmBatchSummary;
  } catch {
    return null;
  }
}

export function formatRealDmBatchReport(summary: RealDmBatchSummary): string {
  return [
    `# Gerçek Instagram DM Analizi`,
    `Kaynak: ${summary.source}`,
    ...summary.connectorReport.map((l) => `- ${l}`),
    "",
    `Bulunan: ${summary.found}`,
    `Analiz edilen: ${summary.analyzed}`,
    `Elendi (spam/alakasız): ${summary.rejected}`,
    `Elenme dağılımı: ${JSON.stringify(summary.rejectBreakdown)}`,
    `Rezervasyon: ${summary.reservations}`,
    `Kapora: ${summary.deposits}`,
    "",
    `## KPI`,
    `Reply Rate: %${summary.kpis.replyRate}`,
    `Conversation Rate: %${summary.kpis.conversationRate}`,
    `Price Accepted: %${summary.kpis.priceAcceptedRate}`,
    `Deposit: %${summary.kpis.depositRate}`,
    `Reservation: %${summary.kpis.reservationRate}`,
    `Ort. cevap süresi: ${summary.kpis.avgReplySeconds ?? "—"} sn`,
    "",
    `## Top 5 kayıp`,
    ...summary.topLossReasons.map((r) => `- ${r.reason}: ${r.count}`),
    "",
    `## Human vs AI`,
    `Karşılaştırılan: ${summary.humanVsAi.compared}`,
    `İnsan ort: ${summary.humanVsAi.humanAverage ?? "—"}`,
    `AI ort: ${summary.humanVsAi.aiAverage ?? "—"}`,
    `İnsan üstün: ${summary.humanVsAi.humanWins} · AI üstün: ${summary.humanVsAi.aiWins}`,
    `En çok hata mesaj tipi: ${summary.humanVsAi.topErrorMessageType ?? "—"}`,
    "",
    ...summary.comparisons.slice(0, 3).map((c) => formatHumanVsAiReport(c)),
  ].join("\n");
}
