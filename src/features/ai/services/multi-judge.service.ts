/**
 * Multi Judge — 3 bağımsız hakem, ortalama skor.
 * Judge 1: Satış danışmanı
 * Judge 2: Müşteri psikoloğu
 * Judge 3: Gerçek müşteri bakışı
 */

import { z } from "zod";
import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";
import type { SalesBrainSnapshot } from "@/features/ai/services/sales-brain.service";
import { composeSalesBrainPromptBlock } from "@/features/ai/services/sales-brain.service";

export type JudgeRole = "sales" | "psychologist" | "customer";

export type SingleJudgeVerdict = {
  role: JudgeRole;
  score: number;
  notes: string[];
  rewriteNeeded: boolean;
  suggestedRewrite: string | null;
  flags: {
    tooSalesy: boolean;
    hasInfoDump: boolean;
    misunderstandingRisk: boolean;
    feelsHuman: boolean;
    feelsInstagramDm: boolean;
    pressureOrManipulation: boolean;
    wouldBuy: boolean | null;
  };
};

export type MultiJudgeResult = {
  judges: SingleJudgeVerdict[];
  averageScore: number;
  rewriteNeeded: boolean;
  suggestedRewrite: string | null;
  critiqueNotes: string[];
  customerFeeling: string;
  overallPass: boolean;
};

const verdictSchema = z.object({
  score: z.number().min(0).max(100).default(70),
  notes: z.array(z.string().max(200)).max(6).default([]),
  rewriteNeeded: z.boolean().default(false),
  suggestedRewrite: z.string().max(800).nullable().default(null),
  customerFeeling: z.string().max(200).optional(),
  tooSalesy: z.boolean().default(false),
  hasInfoDump: z.boolean().default(false),
  misunderstandingRisk: z.boolean().default(false),
  feelsHuman: z.boolean().default(true),
  feelsInstagramDm: z.boolean().default(true),
  pressureOrManipulation: z.boolean().default(false),
  wouldBuy: z.boolean().nullable().default(null),
});

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON yok");
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

const ROLE_PROMPTS: Record<JudgeRole, string> = {
  sales: `Sen deneyimli bir düğün videosu SATIŞ DANIŞMANISIN.
Yalnız satış açısından puanla (0-100): dönüşüm, netlik, doğru NBA, fiyat zamanlaması, kapanış.
JSON: score, notes[], rewriteNeeded, suggestedRewrite, tooSalesy, hasInfoDump, misunderstandingRisk, feelsHuman, feelsInstagramDm, pressureOrManipulation, wouldBuy`,

  psychologist: `Sen müşteri PSİKOLOĞUSUN.
Empati, güven, baskı, manipülasyon açısından puanla (0-100).
JSON: score, notes[], rewriteNeeded, suggestedRewrite, customerFeeling, tooSalesy, hasInfoDump, misunderstandingRisk, feelsHuman, feelsInstagramDm, pressureOrManipulation, wouldBuy`,

  customer: `Sen Instagram DM'de düğün videosu soran GERÇEK MÜŞTERİSİN.
"Ben olsam satın alır mıydım? Rahatsız oldum mu? Robot gibi miydi? Instagram hissi verdi mi?"
JSON: score, notes[], rewriteNeeded, suggestedRewrite, customerFeeling, tooSalesy, hasInfoDump, misunderstandingRisk, feelsHuman, feelsInstagramDm, pressureOrManipulation, wouldBuy`,
};

async function runOneJudge(params: {
  role: JudgeRole;
  draftReply: string;
  customerMessage: string;
  brain: SalesBrainSnapshot;
  recentTranscript?: string;
}): Promise<SingleJudgeVerdict> {
  const fallback: SingleJudgeVerdict = {
    role: params.role,
    score: 70,
    notes: ["judge_skipped"],
    rewriteNeeded: false,
    suggestedRewrite: null,
    flags: {
      tooSalesy: false,
      hasInfoDump: false,
      misunderstandingRisk: false,
      feelsHuman: true,
      feelsInstagramDm: true,
      pressureOrManipulation: false,
      wouldBuy: null,
    },
  };

  if (!isOpenAiConfigured()) return fallback;

  try {
    const { completion } = await createRoutedChatCompletion("extraction", {
      temperature: 0.2,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ROLE_PROMPTS[params.role] },
        {
          role: "user",
          content: [
            composeSalesBrainPromptBlock(params.brain),
            `Müşteri: ${params.customerMessage}`,
            params.recentTranscript
              ? `Geçmiş:\n${params.recentTranscript.slice(-2000)}`
              : "",
            `Asistan taslağı:\n${params.draftReply}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = verdictSchema.safeParse(extractJsonObject(raw));
    if (!parsed.success) {
      return { ...fallback, notes: ["judge_parse_failed"] };
    }

    return {
      role: params.role,
      score: Math.round(parsed.data.score),
      notes: parsed.data.notes.filter(Boolean),
      rewriteNeeded: parsed.data.rewriteNeeded,
      suggestedRewrite: parsed.data.suggestedRewrite?.trim() || null,
      flags: {
        tooSalesy: parsed.data.tooSalesy,
        hasInfoDump: parsed.data.hasInfoDump,
        misunderstandingRisk: parsed.data.misunderstandingRisk,
        feelsHuman: parsed.data.feelsHuman,
        feelsInstagramDm: parsed.data.feelsInstagramDm,
        pressureOrManipulation: parsed.data.pressureOrManipulation,
        wouldBuy: parsed.data.wouldBuy,
      },
    };
  } catch (error) {
    console.error(
      `[multi-judge:${params.role}]`,
      error instanceof Error ? error.message : "bilinmeyen"
    );
    return { ...fallback, notes: ["judge_error"] };
  }
}

/**
 * 3 hakemi paralel çalıştır; ortalama al.
 */
export async function runMultiJudge(params: {
  draftReply: string;
  customerMessage: string;
  brain: SalesBrainSnapshot;
  recentTranscript?: string;
}): Promise<MultiJudgeResult> {
  const roles: JudgeRole[] = ["sales", "psychologist", "customer"];
  const judges = await Promise.all(
    roles.map((role) =>
      runOneJudge({
        role,
        draftReply: params.draftReply,
        customerMessage: params.customerMessage,
        brain: params.brain,
        recentTranscript: params.recentTranscript,
      })
    )
  );

  const averageScore =
    judges.reduce((s, j) => s + j.score, 0) / Math.max(1, judges.length);

  const rewriteVotes = judges.filter((j) => j.rewriteNeeded).length;
  const badFlags = judges.some(
    (j) =>
      j.flags.hasInfoDump ||
      j.flags.tooSalesy ||
      j.flags.misunderstandingRisk ||
      j.flags.pressureOrManipulation ||
      !j.flags.feelsInstagramDm ||
      !j.flags.feelsHuman
  );

  const rewriteNeeded = rewriteVotes >= 2 || averageScore < 65 || badFlags;

  const rewriteCandidates = judges
    .map((j) => j.suggestedRewrite)
    .filter((r): r is string => Boolean(r && r.length >= 8));

  // En yüksek skorlu rewrite önerisini tercih et
  let suggestedRewrite: string | null = null;
  if (rewriteCandidates.length > 0) {
    const withRewrite = judges
      .filter((j) => j.suggestedRewrite)
      .sort((a, b) => b.score - a.score);
    suggestedRewrite = withRewrite[0]?.suggestedRewrite ?? rewriteCandidates[0]!;
  }

  const critiqueNotes = judges.flatMap((j) =>
    j.notes.map((n) => `[${j.role}] ${n}`)
  );

  const psych = judges.find((j) => j.role === "psychologist");
  const cust = judges.find((j) => j.role === "customer");

  return {
    judges,
    averageScore: Math.round(averageScore * 10) / 10,
    rewriteNeeded,
    suggestedRewrite,
    critiqueNotes: critiqueNotes.slice(0, 12),
    customerFeeling:
      psych?.notes[0] ||
      cust?.notes[0] ||
      (averageScore >= 70 ? "genelde olumlu" : "karışık / temkinli"),
    overallPass: averageScore >= 65 && !badFlags,
  };
}
