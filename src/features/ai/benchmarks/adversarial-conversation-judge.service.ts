/**
 * Full-conversation hakem — tek cevabı değil tüm diyaloğu analiz eder.
 */

import { z } from "zod";
import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";
import type { LeadScores } from "@/features/ai/services/sales-brain.service";
import type {
  AdversarialConversationJudge,
  AdversarialLossTag,
  AdversarialTurnLog,
} from "./adversarial-sales-benchmark.types";

const judgeSchema = z.object({
  trustTrajectory: z.string().max(400).default(""),
  purchaseIntentTrajectory: z.string().max(400).default(""),
  whereCustomerWasLost: z.string().max(300).nullable().default(null),
  firstMistakeTurnIndex: z.number().int().min(0).nullable().default(null),
  replyThatHurtConversion: z.string().max(500).nullable().default(null),
  betterAlternativeReply: z.string().max(500).nullable().default(null),
  lossTags: z
    .array(
      z.enum([
        "price",
        "trust",
        "too_long",
        "misunderstood",
        "oversell",
        "repetition",
        "wrong_memory",
        "none",
      ])
    )
    .max(6)
    .default([]),
  overallScore: z.number().min(0).max(100).default(50),
  notes: z.array(z.string().max(200)).max(8).default([]),
});

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON yok");
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

function heuristicJudge(
  turns: AdversarialTurnLog[],
  initial: LeadScores | null,
  final: LeadScores | null
): AdversarialConversationJudge {
  const trustDelta =
    initial && final ? final.trust - initial.trust : null;
  const intentDelta =
    initial && final
      ? final.purchaseIntent - initial.purchaseIntent
      : null;

  let score = 55;
  if (trustDelta != null) score += Math.max(-20, Math.min(20, trustDelta / 3));
  if (intentDelta != null)
    score += Math.max(-20, Math.min(20, intentDelta / 3));

  const longReplies = turns.filter((t) => t.assistantReply.length > 320).length;
  if (longReplies > 0) score -= longReplies * 5;

  const tags: AdversarialLossTag[] = [];
  if (longReplies >= 2) tags.push("too_long");
  if (trustDelta != null && trustDelta < -10) tags.push("trust");
  if (intentDelta != null && intentDelta < -10) tags.push("price");
  if (tags.length === 0) tags.push("none");

  return {
    trustTrajectory:
      trustDelta == null
        ? "Skor yok"
        : `Trust ${initial!.trust} → ${final!.trust} (Δ${trustDelta})`,
    purchaseIntentTrajectory:
      intentDelta == null
        ? "Skor yok"
        : `PurchaseIntent ${initial!.purchaseIntent} → ${final!.purchaseIntent} (Δ${intentDelta})`,
    whereCustomerWasLost:
      trustDelta != null && trustDelta < -10
        ? "Güven düşüşü tespit edildi (heuristic)."
        : null,
    firstMistakeTurnIndex: longReplies > 0
      ? turns.findIndex((t) => t.assistantReply.length > 320)
      : null,
    replyThatHurtConversion: null,
    betterAlternativeReply: null,
    lossTags: tags,
    finalTrustDelta: trustDelta,
    finalPurchaseIntentDelta: intentDelta,
    overallScore: Math.max(0, Math.min(100, Math.round(score))),
    notes: ["heuristic_judge_fallback"],
  };
}

const JUDGE_SYSTEM = `Sen Redmedia Instagram DM satış konuşmasının hakemisin.
Tek cevabı değil TÜM konuşmayı analiz et. JSON dön.

Alanlar:
{
  "trustTrajectory": "güven nasıl değişti (kısa)",
  "purchaseIntentTrajectory": "satın alma ihtimali nasıl değişti",
  "whereCustomerWasLost": "müşteri nerede kaybedildi veya null",
  "firstMistakeTurnIndex": 0-based tur indeksi veya null,
  "replyThatHurtConversion": "hangi asistan cevabı dönüşümü düşürdü (alıntı/özet) veya null",
  "betterAlternativeReply": "aynı müşteriye daha iyi alternatif kısa DM cevabı veya null",
  "lossTags": ["price"|"trust"|"too_long"|"misunderstood"|"oversell"|"repetition"|"wrong_memory"|"none"],
  "overallScore": 0-100,
  "notes": ["kısa madde"]
}

Objektif ol. Fiyat uydurma / rakip saldırısı / uzun dump varsa sert düşür.`;

export async function judgeAdversarialConversation(params: {
  scenarioName: string;
  turns: AdversarialTurnLog[];
  initialScores: LeadScores | null;
  finalScores: LeadScores | null;
}): Promise<AdversarialConversationJudge> {
  const fallback = heuristicJudge(
    params.turns,
    params.initialScores,
    params.finalScores
  );

  if (!isOpenAiConfigured() || params.turns.length === 0) {
    return fallback;
  }

  const transcript = params.turns
    .map(
      (t, i) =>
        `[Tur ${i}] Müşteri: ${t.customerMessage}\nAsistan: ${t.assistantReply}\n(trust=${t.trust ?? "?"}, intent=${t.purchaseIntent ?? "?"})`
    )
    .join("\n\n");

  try {
    const { completion } = await createRoutedChatCompletion("extraction", {
      temperature: 0.2,
      max_tokens: 1100,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: JUDGE_SYSTEM },
        {
          role: "user",
          content: [
            `Senaryo: ${params.scenarioName}`,
            params.initialScores && params.finalScores
              ? `Skorlar: trust ${params.initialScores.trust}→${params.finalScores.trust}, intent ${params.initialScores.purchaseIntent}→${params.finalScores.purchaseIntent}`
              : "Skorlar: kısmi",
            "",
            "## Tam konuşma",
            transcript,
          ].join("\n"),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = judgeSchema.safeParse(extractJsonObject(raw));
    if (!parsed.success) return fallback;

    const trustDelta =
      params.initialScores && params.finalScores
        ? params.finalScores.trust - params.initialScores.trust
        : null;
    const intentDelta =
      params.initialScores && params.finalScores
        ? params.finalScores.purchaseIntent -
          params.initialScores.purchaseIntent
        : null;

    return {
      trustTrajectory: parsed.data.trustTrajectory || fallback.trustTrajectory,
      purchaseIntentTrajectory:
        parsed.data.purchaseIntentTrajectory ||
        fallback.purchaseIntentTrajectory,
      whereCustomerWasLost: parsed.data.whereCustomerWasLost,
      firstMistakeTurnIndex: parsed.data.firstMistakeTurnIndex,
      replyThatHurtConversion: parsed.data.replyThatHurtConversion,
      betterAlternativeReply: parsed.data.betterAlternativeReply,
      lossTags:
        parsed.data.lossTags.length > 0
          ? parsed.data.lossTags
          : fallback.lossTags,
      finalTrustDelta: trustDelta,
      finalPurchaseIntentDelta: intentDelta,
      overallScore: Math.round(parsed.data.overallScore),
      notes: parsed.data.notes,
    };
  } catch (error) {
    console.error(
      "[adversarial-judge]",
      error instanceof Error ? error.message : "bilinmeyen"
    );
    return fallback;
  }
}
