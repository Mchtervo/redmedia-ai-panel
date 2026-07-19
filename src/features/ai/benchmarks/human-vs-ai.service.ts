/**
 * Human vs AI — gerçek (anonim) DM'lerde insan cevabı vs AI cevabı.
 * Hakem her iki tarafı puanlar; AI'nın geride kaldığı turu bulur.
 */

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AssistantHistoryMessage } from "@/features/ai/prompts/simple-assistant";
import { generateSimpleAssistantReply } from "@/features/ai/services/simple-assistant.service";
import type { SalesBrainSnapshot } from "@/features/ai/services/sales-brain.service";
import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";
import { listRecentMessagesByConversation } from "@/features/conversations/repositories/messages.repository";
import { maskPii } from "@/features/learning/utils/pii-mask";

type TypedSupabase = SupabaseClient<Database>;

export type HumanVsAiTurn = {
  turnIndex: number;
  customerMessage: string;
  humanReply: string;
  aiReply: string;
  humanScore: number | null;
  aiScore: number | null;
  /** Multi Judge alt skorları (satış / psikolog / müşteri) — AI cevabı için. */
  multiJudge?: {
    sales: number;
    psychologist: number;
    customer: number;
    average: number;
  } | null;
  betterAlternative?: string | null;
};

export type HumanVsAiResult = {
  id: string;
  conversationId: string;
  createdAt: string;
  humanAverage: number;
  aiAverage: number;
  gap: number;
  firstBehindTurnIndex: number | null;
  turns: HumanVsAiTurn[];
  notes: string[];
  betterAlternativeOverall: string | null;
};

const scoreSchema = z.object({
  humanScore: z.number().min(0).max(100),
  aiScore: z.number().min(0).max(100),
  note: z.string().max(300).optional(),
  salesScore: z.number().min(0).max(100).optional(),
  psychScore: z.number().min(0).max(100).optional(),
  customerScore: z.number().min(0).max(100).optional(),
  betterAlternative: z.string().max(500).nullable().optional(),
});

const LOCAL_DIR = path.join(process.cwd(), ".data", "human-vs-ai");

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON yok");
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
}

type Pair = {
  customerMessage: string;
  humanReply: string;
};

/**
 * Personel cevaplarını insan referansı kabul eder; müşteri mesajlarıyla eşleştir.
 */
function extractHumanPairs(
  messages: { sender_type: string; content: string | null }[]
): Pair[] {
  const pairs: Pair[] = [];
  let pendingCustomer: string | null = null;

  for (const m of messages) {
    const content = (m.content ?? "").trim();
    if (!content) continue;
    if (m.sender_type === "customer") {
      pendingCustomer = maskPii(content);
      continue;
    }
    if (
      (m.sender_type === "staff" || m.sender_type === "human") &&
      pendingCustomer
    ) {
      pairs.push({
        customerMessage: pendingCustomer,
        humanReply: maskPii(content),
      });
      pendingCustomer = null;
    }
  }
  return pairs;
}

async function scorePair(params: {
  customerMessage: string;
  humanReply: string;
  aiReply: string;
}): Promise<{
  humanScore: number;
  aiScore: number;
  note: string;
  multiJudge: HumanVsAiTurn["multiJudge"];
  betterAlternative: string | null;
}> {
  if (!isOpenAiConfigured()) {
    return {
      humanScore: 70,
      aiScore: 60,
      note: "heuristic",
      multiJudge: { sales: 60, psychologist: 60, customer: 60, average: 60 },
      betterAlternative: null,
    };
  }

  try {
    const { completion } = await createRoutedChatCompletion("extraction", {
      temperature: 0.2,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Instagram DM Multi Judge + Human vs AI.
İnsan vs AI puanla (0-100). AI için 3 alt skor ver.
JSON: {
  "humanScore": n, "aiScore": n,
  "salesScore": n, "psychScore": n, "customerScore": n,
  "betterAlternative": "AI zayıfsa daha iyi kısa DM veya null",
  "note": "kısa"
}`,
        },
        {
          role: "user",
          content: [
            `Müşteri: ${params.customerMessage}`,
            `İnsan: ${params.humanReply}`,
            `AI: ${params.aiReply}`,
          ].join("\n\n"),
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = scoreSchema.safeParse(extractJsonObject(raw));
    if (!parsed.success) {
      return {
        humanScore: 70,
        aiScore: 60,
        note: "parse_failed",
        multiJudge: null,
        betterAlternative: null,
      };
    }
    const sales = Math.round(parsed.data.salesScore ?? parsed.data.aiScore);
    const psych = Math.round(parsed.data.psychScore ?? parsed.data.aiScore);
    const cust = Math.round(parsed.data.customerScore ?? parsed.data.aiScore);
    return {
      humanScore: Math.round(parsed.data.humanScore),
      aiScore: Math.round(parsed.data.aiScore),
      note: parsed.data.note ?? "",
      multiJudge: {
        sales,
        psychologist: psych,
        customer: cust,
        average: Math.round((sales + psych + cust) / 3),
      },
      betterAlternative: parsed.data.betterAlternative?.trim() || null,
    };
  } catch {
    return {
      humanScore: 70,
      aiScore: 60,
      note: "score_error",
      multiJudge: null,
      betterAlternative: null,
    };
  }
}

/**
 * Gerçek konuşmada Human vs AI benchmark çalıştır.
 * Yalnızca personel (insan) cevapları olan turlar karşılaştırılır.
 */
export async function runHumanVsAiBenchmark(
  supabase: TypedSupabase,
  conversationId: string,
  options?: { maxTurns?: number }
): Promise<HumanVsAiResult> {
  if (!isOpenAiConfigured()) {
    throw new Error("OpenAI yapılandırılmamış.");
  }

  const messages = await listRecentMessagesByConversation(
    supabase,
    conversationId,
    80
  );
  const pairs = extractHumanPairs(messages).slice(0, options?.maxTurns ?? 12);
  if (pairs.length === 0) {
    throw new Error(
      "Bu konuşmada karşılaştırılacak insan (personel) cevabı bulunamadı."
    );
  }

  const turns: HumanVsAiTurn[] = [];
  const history: AssistantHistoryMessage[] = [];
  let brain: SalesBrainSnapshot | null = null;
  const notes: string[] = [];

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]!;
    const result = await generateSimpleAssistantReply(supabase, {
      customerMessage: pair.customerMessage,
      conversationId: null,
      contactId: null,
      labMode: true,
      historyOverride: [...history],
      salesBrainOverride: brain,
    });

    const aiReply = result?.reply?.trim() || "(üretilemedi)";
    brain = result?.salesBrain ?? brain;

    const scored = await scorePair({
      customerMessage: pair.customerMessage,
      humanReply: pair.humanReply,
      aiReply,
    });
    if (scored.note) notes.push(`Tur ${i}: ${scored.note}`);

    turns.push({
      turnIndex: i,
      customerMessage: pair.customerMessage,
      humanReply: pair.humanReply,
      aiReply,
      humanScore: scored.humanScore,
      aiScore: scored.aiScore,
      multiJudge: scored.multiJudge,
      betterAlternative: scored.betterAlternative,
    });

    history.push(
      { senderType: "customer", content: pair.customerMessage },
      { senderType: "ai", content: aiReply }
    );
  }

  const humanAverage =
    turns.reduce((s, t) => s + (t.humanScore ?? 0), 0) / turns.length;
  const aiAverage =
    turns.reduce((s, t) => s + (t.aiScore ?? 0), 0) / turns.length;

  let firstBehindTurnIndex: number | null = null;
  for (const t of turns) {
    if (
      t.humanScore != null &&
      t.aiScore != null &&
      t.aiScore < t.humanScore - 5
    ) {
      firstBehindTurnIndex = t.turnIndex;
      break;
    }
  }

  const behindTurn =
    firstBehindTurnIndex != null
      ? turns.find((t) => t.turnIndex === firstBehindTurnIndex)
      : null;

  const summary: HumanVsAiResult = {
    id: randomUUID(),
    conversationId,
    createdAt: new Date().toISOString(),
    humanAverage: Math.round(humanAverage * 10) / 10,
    aiAverage: Math.round(aiAverage * 10) / 10,
    gap: Math.round((humanAverage - aiAverage) * 10) / 10,
    firstBehindTurnIndex,
    turns,
    notes,
    betterAlternativeOverall:
      behindTurn?.betterAlternative ??
      turns.find((t) => t.betterAlternative)?.betterAlternative ??
      null,
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

export async function loadLatestHumanVsAi(): Promise<HumanVsAiResult | null> {
  try {
    const raw = await fs.readFile(path.join(LOCAL_DIR, "latest.json"), "utf8");
    return JSON.parse(raw) as HumanVsAiResult;
  } catch {
    return null;
  }
}

export function formatHumanVsAiReport(result: HumanVsAiResult): string {
  const lines = [
    `# Human vs AI`,
    `conversation: ${result.conversationId}`,
    `İnsan ort: ${result.humanAverage}`,
    `AI ort: ${result.aiAverage}`,
    `Fark (insan−AI): ${result.gap}`,
    `İlk geride kalınan tur: ${result.firstBehindTurnIndex ?? "—"}`,
    "",
  ];
  for (const t of result.turns) {
    lines.push(
      `## Tur ${t.turnIndex} — İnsan ${t.humanScore} / AI ${t.aiScore}`
    );
    lines.push(`Müşteri: ${t.customerMessage}`);
    lines.push(`İnsan: ${t.humanReply}`);
    lines.push(`AI: ${t.aiReply}`);
    lines.push("");
  }
  return lines.join("\n");
}
