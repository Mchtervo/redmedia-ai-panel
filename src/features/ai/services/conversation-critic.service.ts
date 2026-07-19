/**
 * Conversation Critic (AI Judge)
 * Varsayılan: Multi Judge (satış + psikolog + müşteri) → ortalama → rewrite.
 * Pipeline: … → LLM → Critic → Rewrite → Send
 */

import { z } from "zod";
import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";
import {
  composeSalesBrainPromptBlock,
  type SalesBrainSnapshot,
} from "@/features/ai/services/sales-brain.service";
import {
  runMultiJudge,
  type MultiJudgeResult,
} from "@/features/ai/services/multi-judge.service";

export type ConversationCriticFinding = {
  whyThisReply: string;
  customerFeeling: string;
  couldBeShorter: boolean;
  increasesSaleOdds: boolean | null;
  misunderstandingRisk: boolean;
  hasRepetition: boolean;
  hasInfoDump: boolean;
  tooSalesy: boolean;
  feelsHuman: boolean;
  feelsInstagramDm: boolean;
  wouldRealConsultantSay: boolean;
  overallPass: boolean;
  rewriteNeeded: boolean;
  critiqueNotes: string[];
  suggestedRewrite: string | null;
  /** Multi Judge ortalaması (0–100); tek judge modunda null. */
  multiJudgeAverage: number | null;
  multiJudge?: MultiJudgeResult | null;
};

export type ConversationCriticResult = {
  originalReply: string;
  finalReply: string;
  rewritten: boolean;
  finding: ConversationCriticFinding;
  model: string | null;
};

const criticSchema = z.object({
  whyThisReply: z.string().max(400).default(""),
  customerFeeling: z.string().max(200).default(""),
  couldBeShorter: z.boolean().default(false),
  increasesSaleOdds: z.boolean().nullable().default(null),
  misunderstandingRisk: z.boolean().default(false),
  hasRepetition: z.boolean().default(false),
  hasInfoDump: z.boolean().default(false),
  tooSalesy: z.boolean().default(false),
  feelsHuman: z.boolean().default(true),
  feelsInstagramDm: z.boolean().default(true),
  wouldRealConsultantSay: z.boolean().default(true),
  overallPass: z.boolean().default(true),
  rewriteNeeded: z.boolean().default(false),
  critiqueNotes: z.array(z.string().max(200)).max(8).default([]),
  suggestedRewrite: z.string().max(800).nullable().default(null),
});

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON yok");
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

function isMultiJudgeEnabled(): boolean {
  const flag = process.env.AI_MULTI_JUDGE_ENABLED?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  return true;
}

const CRITIC_SYSTEM = `Sen Redmedia Instagram DM satış konuşmasının Conversation Critic / AI Judge'ısın.
Görevin: asistan taslağını parçalamak. Yeni kural listesi ezberleme; gerçek danışman gibi eleştir.

JSON alanları (zorunlu):
{
  "whyThisReply": "neden bu cevap verilmiş olabilir (1-2 cümle)",
  "customerFeeling": "müşteri bunu okuyunca ne hisseder",
  "couldBeShorter": true/false,
  "increasesSaleOdds": true/false/null,
  "misunderstandingRisk": true/false,
  "hasRepetition": true/false,
  "hasInfoDump": true/false,
  "tooSalesy": true/false,
  "feelsHuman": true/false,
  "feelsInstagramDm": true/false,
  "wouldRealConsultantSay": true/false,
  "overallPass": true/false,
  "rewriteNeeded": true/false,
  "critiqueNotes": ["kısa madde"],
  "suggestedRewrite": "gerekirse düzeltilmiş kısa DM cevabı (TR) veya null"
}

Rewrite kuralları (yalnız rewriteNeeded=true ise suggestedRewrite doldur):
- ~3 satır, en fazla 1 soru, tek amaç
- Fiyat uydurma / sahte kıtlık / rakip kötüleme yok
- Instagram DM gibi doğal ve kısa`;

function emptyFinding(partial: Partial<ConversationCriticFinding>): ConversationCriticFinding {
  return {
    whyThisReply: partial.whyThisReply ?? "",
    customerFeeling: partial.customerFeeling ?? "bilinmiyor",
    couldBeShorter: partial.couldBeShorter ?? false,
    increasesSaleOdds: partial.increasesSaleOdds ?? null,
    misunderstandingRisk: partial.misunderstandingRisk ?? false,
    hasRepetition: partial.hasRepetition ?? false,
    hasInfoDump: partial.hasInfoDump ?? false,
    tooSalesy: partial.tooSalesy ?? false,
    feelsHuman: partial.feelsHuman ?? true,
    feelsInstagramDm: partial.feelsInstagramDm ?? true,
    wouldRealConsultantSay: partial.wouldRealConsultantSay ?? true,
    overallPass: partial.overallPass ?? true,
    rewriteNeeded: partial.rewriteNeeded ?? false,
    critiqueNotes: partial.critiqueNotes ?? [],
    suggestedRewrite: partial.suggestedRewrite ?? null,
    multiJudgeAverage: partial.multiJudgeAverage ?? null,
    multiJudge: partial.multiJudge ?? null,
  };
}

/**
 * Cevabı eleştir; gerekirse rewrite öner / uygula.
 * Varsayılan Multi Judge; AI_MULTI_JUDGE_ENABLED=false ile tek critic.
 */
export async function critiqueAndMaybeRewrite(params: {
  draftReply: string;
  customerMessage: string;
  brain: SalesBrainSnapshot;
  recentTranscript?: string;
}): Promise<ConversationCriticResult> {
  const originalReply = params.draftReply.trim();

  if (!isOpenAiConfigured() || !originalReply) {
    return {
      originalReply,
      finalReply: originalReply,
      rewritten: false,
      model: null,
      finding: emptyFinding({
        whyThisReply: "Critic atlandı (OpenAI yok veya boş taslak).",
      }),
    };
  }

  if (isMultiJudgeEnabled()) {
    return critiqueWithMultiJudge(params, originalReply);
  }

  return critiqueWithSingleJudge(params, originalReply);
}

async function critiqueWithMultiJudge(
  params: {
    draftReply: string;
    customerMessage: string;
    brain: SalesBrainSnapshot;
    recentTranscript?: string;
  },
  originalReply: string
): Promise<ConversationCriticResult> {
  try {
    const multi = await runMultiJudge({
      draftReply: originalReply,
      customerMessage: params.customerMessage,
      brain: params.brain,
      recentTranscript: params.recentTranscript,
    });

    const anyDump = multi.judges.some((j) => j.flags.hasInfoDump);
    const anySalesy = multi.judges.some((j) => j.flags.tooSalesy);
    const anyMisread = multi.judges.some((j) => j.flags.misunderstandingRisk);
    const feelsHuman = multi.judges.every((j) => j.flags.feelsHuman);
    const feelsDm = multi.judges.every((j) => j.flags.feelsInstagramDm);

    const finding = emptyFinding({
      whyThisReply: `Multi Judge ort. ${multi.averageScore} (satış/psikolog/müşteri).`,
      customerFeeling: multi.customerFeeling,
      couldBeShorter: originalReply.length > 280,
      increasesSaleOdds: multi.averageScore >= 70,
      misunderstandingRisk: anyMisread,
      hasRepetition: false,
      hasInfoDump: anyDump,
      tooSalesy: anySalesy,
      feelsHuman,
      feelsInstagramDm: feelsDm,
      wouldRealConsultantSay: multi.averageScore >= 65,
      overallPass: multi.overallPass,
      rewriteNeeded: multi.rewriteNeeded,
      critiqueNotes: multi.critiqueNotes,
      suggestedRewrite: multi.suggestedRewrite,
      multiJudgeAverage: multi.averageScore,
      multiJudge: multi,
    });

    let finalReply = originalReply;
    let rewritten = false;

    if (multi.rewriteNeeded) {
      let candidate = multi.suggestedRewrite;
      if (!candidate || candidate.length < 8) {
        candidate = await rewriteFromCritique({
          draft: originalReply,
          customerMessage: params.customerMessage,
          brain: params.brain,
          notes: multi.critiqueNotes,
        });
      }
      if (candidate && candidate.trim().length >= 8) {
        finalReply = candidate.trim();
        rewritten = finalReply !== originalReply;
        finding.rewriteNeeded = true;
        finding.suggestedRewrite = finalReply;
        finding.overallPass = rewritten ? true : finding.overallPass;
      }
    }

    return {
      originalReply,
      finalReply,
      rewritten,
      finding,
      model: "multi_judge_v1",
    };
  } catch (error) {
    console.error(
      "[conversation-critic/multi]",
      error instanceof Error ? error.message : "bilinmeyen"
    );
    return critiqueWithSingleJudge(params, originalReply);
  }
}

async function critiqueWithSingleJudge(
  params: {
    draftReply: string;
    customerMessage: string;
    brain: SalesBrainSnapshot;
    recentTranscript?: string;
  },
  originalReply: string
): Promise<ConversationCriticResult> {
  try {
    const { completion, modelUsed } = await createRoutedChatCompletion(
      "extraction",
      {
        temperature: 0.25,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CRITIC_SYSTEM },
          {
            role: "user",
            content: [
              composeSalesBrainPromptBlock(params.brain),
              "",
              "## Son müşteri mesajı",
              params.customerMessage,
              "",
              params.recentTranscript
                ? `## Kısa geçmiş\n${params.recentTranscript.slice(-2500)}`
                : "## Kısa geçmiş\n(yok)",
              "",
              "## Asistan taslağı (eleştir)",
              originalReply,
              "",
              "JSON ile eleştir. rewriteNeeded ise suggestedRewrite zorunlu.",
            ].join("\n"),
          },
        ],
      }
    );

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = criticSchema.safeParse(extractJsonObject(raw));
    if (!parsed.success) {
      return {
        originalReply,
        finalReply: originalReply,
        rewritten: false,
        model: modelUsed,
        finding: emptyFinding({
          whyThisReply: "Critic JSON parse edilemedi.",
          critiqueNotes: ["critic_parse_failed"],
        }),
      };
    }

    const finding = emptyFinding({
      ...parsed.data,
      critiqueNotes: parsed.data.critiqueNotes.filter(Boolean),
      suggestedRewrite: parsed.data.suggestedRewrite?.trim() || null,
    });

    const forceRewrite =
      finding.hasInfoDump ||
      finding.hasRepetition ||
      finding.tooSalesy ||
      finding.misunderstandingRisk ||
      !finding.feelsInstagramDm ||
      !finding.wouldRealConsultantSay ||
      (finding.couldBeShorter && originalReply.length > 280);

    const rewriteNeeded = finding.rewriteNeeded || forceRewrite;
    let finalReply = originalReply;
    let rewritten = false;

    if (rewriteNeeded) {
      let candidate = finding.suggestedRewrite;
      if (!candidate || candidate.length < 8) {
        candidate = await rewriteFromCritique({
          draft: originalReply,
          customerMessage: params.customerMessage,
          brain: params.brain,
          notes: finding.critiqueNotes,
        });
      }
      if (candidate && candidate.trim().length >= 8) {
        finalReply = candidate.trim();
        rewritten = finalReply !== originalReply;
        finding.rewriteNeeded = true;
        finding.suggestedRewrite = finalReply;
        finding.overallPass = rewritten ? true : finding.overallPass;
      }
    }

    return {
      originalReply,
      finalReply,
      rewritten,
      finding,
      model: modelUsed,
    };
  } catch (error) {
    console.error(
      "[conversation-critic]",
      error instanceof Error ? error.message : "bilinmeyen"
    );
    return {
      originalReply,
      finalReply: originalReply,
      rewritten: false,
      model: null,
      finding: emptyFinding({
        whyThisReply: "Critic hata verdi; taslak gönderildi.",
        critiqueNotes: ["critic_error"],
      }),
    };
  }
}

async function rewriteFromCritique(params: {
  draft: string;
  customerMessage: string;
  brain: SalesBrainSnapshot;
  notes: string[];
}): Promise<string | null> {
  try {
    const { completion } = await createRoutedChatCompletion("dm_reply", {
      temperature: 0.4,
      max_tokens: 280,
      messages: [
        {
          role: "system",
          content:
            "Instagram DM satış danışmanısın. Critic/Multi Judge notlarına göre taslağı yeniden yaz. Yalnız düzeltilmiş cevabı ver. ~3 satır, 1 soru.",
        },
        {
          role: "user",
          content: [
            composeSalesBrainPromptBlock(params.brain),
            `Müşteri: ${params.customerMessage}`,
            `Taslak:\n${params.draft}`,
            `Notlar:\n${params.notes.map((n) => `- ${n}`).join("\n") || "(yok)"}`,
          ].join("\n\n"),
        },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

export function criticFindingToJson(
  finding: ConversationCriticFinding
): Record<string, unknown> {
  return { ...finding };
}
