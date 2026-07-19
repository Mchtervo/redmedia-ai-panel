/**
 * Lost Sale Analyzer — müşteri kaybolduğunda neden + alternatif konuşma.
 */

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";
import { listRecentMessagesByConversation } from "@/features/conversations/repositories/messages.repository";
import { maskPii } from "@/features/learning/utils/pii-mask";

type TypedSupabase = SupabaseClient<Database>;

export const LOST_SALE_REASONS = [
  "price",
  "trust",
  "wrong_reply",
  "too_long",
  "late_price",
  "early_price",
  "wrong_nba",
  "competitor",
  "unknown",
] as const;

export type LostSaleReason = (typeof LOST_SALE_REASONS)[number];

export type LostSaleAnalysis = {
  id: string;
  conversationId: string;
  primaryReason: LostSaleReason;
  reasons: LostSaleReason[];
  whyLost: string;
  firstMistakeTurnIndex: number | null;
  alternativeConversation: string;
  reservationLiftPct: number;
  createdAt: string;
};

const analysisSchema = z.object({
  primaryReason: z.enum(LOST_SALE_REASONS).default("unknown"),
  reasons: z.array(z.enum(LOST_SALE_REASONS)).max(5).default([]),
  whyLost: z.string().max(600).default(""),
  firstMistakeTurnIndex: z.number().int().min(0).nullable().default(null),
  alternativeConversation: z.string().max(2500).default(""),
  reservationLiftPct: z.number().min(0).max(80).default(10),
});

const LOCAL_DIR = path.join(process.cwd(), ".data", "lost-sale-analyses");

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

async function saveLocal(analysis: LostSaleAnalysis): Promise<void> {
  await ensureDir();
  await fs.writeFile(
    path.join(LOCAL_DIR, `${analysis.id}.json`),
    JSON.stringify(analysis, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(LOCAL_DIR, "latest.json"),
    JSON.stringify(analysis, null, 2),
    "utf8"
  );
}

const SYSTEM = `Sen Redmedia kayıp satış analistisin.
Konuşma rezervasyona dönmedi / müşteri kayboldu.
JSON dön:
{
  "primaryReason": "price|trust|wrong_reply|too_long|late_price|early_price|wrong_nba|competitor|unknown",
  "reasons": ["..."],
  "whyLost": "kısa açıklama",
  "firstMistakeTurnIndex": 0 veya null,
  "alternativeConversation": "Bu konuşma şöyle gitseydi... (kısa diyalog senaryosu, anonim)",
  "reservationLiftPct": 0-80 (alternatif ile rezervasyon ihtimali artışı tahmini)
}
Kanıt yoksa uydurma; temkinli ol.`;

/**
 * Kapatılan / kayıp konuşmayı analiz et.
 */
export async function analyzeLostSale(
  supabase: TypedSupabase,
  conversationId: string
): Promise<LostSaleAnalysis | null> {
  if (!isOpenAiConfigured()) return null;

  const messages = await listRecentMessagesByConversation(
    supabase,
    conversationId,
    40
  );
  if (messages.length < 2) return null;

  const hasCustomer = messages.some((m) => m.sender_type === "customer");
  const hasStaffOrAi = messages.some(
    (m) => m.sender_type === "ai" || m.sender_type === "staff"
  );
  if (!hasCustomer || !hasStaffOrAi) return null;

  const transcript = messages
    .map((m) => {
      const role =
        m.sender_type === "customer"
          ? "Müşteri"
          : m.sender_type === "ai"
            ? "AI"
            : "Personel";
      return `[${role}] ${maskPii(m.content ?? "")}`;
    })
    .join("\n");

  try {
    const { completion } = await createRoutedChatCompletion("extraction", {
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Konuşma (anonimleştirilmiş):\n${transcript.slice(-6000)}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = analysisSchema.safeParse(extractJsonObject(raw));
    if (!parsed.success) return null;

    const analysis: LostSaleAnalysis = {
      id: randomUUID(),
      conversationId,
      primaryReason: parsed.data.primaryReason,
      reasons:
        parsed.data.reasons.length > 0
          ? parsed.data.reasons
          : [parsed.data.primaryReason],
      whyLost: parsed.data.whyLost,
      firstMistakeTurnIndex: parsed.data.firstMistakeTurnIndex,
      alternativeConversation: parsed.data.alternativeConversation,
      reservationLiftPct: Math.round(parsed.data.reservationLiftPct),
      createdAt: new Date().toISOString(),
    };

    await saveLocal(analysis);

    const { error: insertError } = await supabase
      .from("lost_sale_analyses")
      .insert({
        id: analysis.id,
        conversation_id: conversationId,
        primary_reason: analysis.primaryReason,
        reasons: analysis.reasons,
        why_lost: analysis.whyLost,
        first_mistake_turn_index: analysis.firstMistakeTurnIndex,
        alternative_conversation: analysis.alternativeConversation,
        reservation_lift_pct: analysis.reservationLiftPct,
        result: analysis as unknown as Json,
      });
    if (insertError) {
      console.error("[lost-sale-analyzer] db:", insertError.message);
    }

    return analysis;
  } catch (error) {
    console.error(
      "[lost-sale-analyzer]",
      error instanceof Error ? error.message : "bilinmeyen"
    );
    return null;
  }
}

export async function loadLatestLostSaleAnalyses(
  limit = 50
): Promise<LostSaleAnalysis[]> {
  try {
    await ensureDir();
    const files = (await fs.readdir(LOCAL_DIR))
      .filter((f) => f.endsWith(".json") && f !== "latest.json")
      .slice(-limit);
    const rows: LostSaleAnalysis[] = [];
    for (const f of files) {
      try {
        const raw = await fs.readFile(path.join(LOCAL_DIR, f), "utf8");
        rows.push(JSON.parse(raw) as LostSaleAnalysis);
      } catch {
        /* skip */
      }
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}
