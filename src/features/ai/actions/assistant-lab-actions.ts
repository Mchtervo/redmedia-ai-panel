"use server";

import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { generateSimpleAssistantReply } from "@/features/ai/services/simple-assistant.service";
import type { AssistantHistoryMessage } from "@/features/ai/prompts/simple-assistant";
import {
  buildLabBrainTrace,
  type LabBrainTrace,
  type LabSalesBrainView,
} from "@/features/ai/services/lab-brain.service";
import {
  parseSalesBrainSnapshot,
  type SalesBrainSnapshot,
} from "@/features/ai/services/sales-brain.service";
import {
  generateStressCustomerMessage,
  getLabPersona,
  LAB_PERSONA_IDS,
  listLabPersonas,
  pickPersonaOpener,
  type LabPersonaId,
} from "@/features/ai/services/lab-stress-customer.service";

const historyMessageSchema = z.object({
  senderType: z.enum(["customer", "staff", "ai", "system"]),
  content: z.string().min(1).max(2000),
});

const salesBrainSchema = z
  .object({
    state: z.string(),
    persona: z.string(),
    emotion: z.string(),
    decisionPct: z.number(),
    trust: z.number(),
    interest: z.number(),
    mainBlocker: z.string(),
    singleGoal: z.string(),
    memory: z.record(z.string(), z.unknown()),
    style: z.string(),
    turn: z.number(),
  })
  .passthrough()
  .nullable()
  .optional();

const labChatSchema = z.object({
  customerMessage: z.string().trim().min(1).max(4000),
  history: z.array(historyMessageSchema).max(24).default([]),
  salesBrain: salesBrainSchema,
});

const stressSchema = z.object({
  turns: z.number().int().min(3).max(8).optional(),
  personaId: z.enum(LAB_PERSONA_IDS).default("klasik_zorlu"),
});

function toLabSalesBrainView(
  brain: SalesBrainSnapshot | undefined,
  reflect?: {
    pass: boolean;
    rewritten: boolean;
    issues: string[];
  } | null,
  critic?: {
    rewritten: boolean;
    finding: {
      customerFeeling: string;
      critiqueNotes: string[];
      overallPass: boolean;
      multiJudgeAverage?: number | null;
    };
  } | null,
  strategy?: {
    move: string;
    directive: string;
  } | null,
  decision?: {
    strategyId: string;
    analysis: {
      personaLabel: string;
      stageLabel: string;
      leadTemperature: number;
      risk: string;
    };
  } | null
): LabSalesBrainView | null {
  if (!brain) return null;
  return {
    state: brain.state,
    persona: brain.persona,
    emotion: brain.emotion,
    decisionPct: brain.decisionPct,
    trust: brain.trust,
    interest: brain.interest,
    scores: brain.scores,
    customerType: brain.customerType,
    customerTypeConfidence: brain.customerTypeConfidence,
    customerTypeLocked: brain.customerTypeLocked,
    objective: brain.objective,
    nextBestAction: brain.nextBestAction,
    mainBlocker: brain.mainBlocker,
    singleGoal: brain.singleGoal,
    style: brain.style,
    memoryJson: JSON.stringify(brain.memory),
    reflectPass: reflect?.pass ?? null,
    reflectRewritten: reflect?.rewritten ?? null,
    reflectIssues: reflect?.issues ?? [],
    criticRewritten: critic?.rewritten ?? null,
    criticFeeling: critic?.finding.customerFeeling ?? null,
    criticNotes: critic?.finding.critiqueNotes ?? [],
    criticOverallPass: critic?.finding.overallPass ?? null,
    multiJudgeAverage: critic?.finding.multiJudgeAverage ?? null,
    strategistMove: strategy?.move ?? null,
    strategistDirective: strategy?.directive ?? null,
    strategyId: decision?.strategyId ?? null,
    analysisPersona: decision?.analysis.personaLabel ?? null,
    analysisStage: decision?.analysis.stageLabel ?? null,
    analysisLeadTemp: decision?.analysis.leadTemperature ?? null,
    analysisRisk: decision?.analysis.risk ?? null,
  };
}

export type LabChatActionResult =
  | {
      success: true;
      data: {
        reply: string;
        model: string;
        requiresHumanApproval: boolean;
        aiRunId: string;
        brain: LabBrainTrace;
        salesBrain: SalesBrainSnapshot | null;
      };
    }
  | { success: false; error: string };

export type LabStressTurn = {
  customerMessage: string;
  reply: string;
  model: string;
  aiRunId: string;
  brain: LabBrainTrace;
};

export type LabStressActionResult =
  | {
      success: true;
      data: {
        turns: LabStressTurn[];
        totalErrors: number;
        personaId: LabPersonaId;
        personaLabel: string;
      };
    }
  | { success: false; error: string };

/** UI için persona listesi (sunucu action — client import güvenli alan). */
export async function listAssistantLabPersonasAction() {
  return {
    success: true as const,
    data: listLabPersonas().map((p) => ({
      id: p.id,
      label: p.label,
      difficulty: p.difficulty,
      description: p.description,
      defaultTurns: p.defaultTurns,
    })),
  };
}

async function requireSession(): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    throw new Error("Oturum bulunamadı.");
  }
}

/**
 * Laboratuvar test sohbeti — aynı asistan motoru, Instagram/ChatPlace gönderimi yok.
 */
export async function sendAssistantLabMessageAction(
  input: z.infer<typeof labChatSchema>
): Promise<LabChatActionResult> {
  const parsed = labChatSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Geçersiz girdi.",
    };
  }

  try {
    await requireSession();
    const admin = createAdminClient();

    const historyOverride: AssistantHistoryMessage[] = parsed.data.history.map(
      (m) => ({
        senderType: m.senderType,
        content: m.content,
      })
    );

    const salesBrainOverride = parseSalesBrainSnapshot(
      parsed.data.salesBrain ?? null
    );

    const result = await generateSimpleAssistantReply(admin, {
      customerMessage: parsed.data.customerMessage,
      conversationId: null,
      contactId: null,
      labMode: true,
      historyOverride,
      salesBrainOverride,
    });

    if (!result) {
      return {
        success: false,
        error:
          "Asistan yanıt üretemedi. OpenAI veya AI_MASTER bayrağını kontrol edin.",
      };
    }

    if (result.generationFailed) {
      return {
        success: false,
        error:
          result.errorMessage ??
          "Model cevabı üretemedi. Ayarlar / OpenAI model matrisini kontrol edin.",
      };
    }

    const salesBrainView = toLabSalesBrainView(
      result.salesBrain,
      result.salesBrainReflect,
      result.conversationCritic,
      result.conversationStrategy,
      result.decisionPack
        ? {
            strategyId: result.decisionPack.strategyId,
            analysis: result.decisionPack.analysis,
          }
        : null
    );

    const brain = await buildLabBrainTrace({
      customerMessage: parsed.data.customerMessage,
      history: historyOverride,
      reply: result.reply,
      salesBrain: salesBrainView,
    });

    return {
      success: true,
      data: {
        reply: result.reply,
        model: result.model,
        requiresHumanApproval: result.requiresHumanApproval,
        aiRunId: result.aiRunId,
        brain,
        salesBrain: result.salesBrain ?? null,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Laboratuvar cevabı başarısız.";
    return { success: false, error: message };
  }
}

/**
 * Sahte müşteri personası: AI müşteri yazar → canlı asistan cevaplar → beyin analizi.
 */
export async function runAssistantLabStressTestAction(
  input: z.infer<typeof stressSchema> = { personaId: "klasik_zorlu" }
): Promise<LabStressActionResult> {
  const parsed = stressSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Geçersiz simülasyon ayarı." };
  }

  try {
    await requireSession();
    const admin = createAdminClient();
    const persona = getLabPersona(parsed.data.personaId);
    const maxTurns = parsed.data.turns ?? persona.defaultTurns;
    const history: AssistantHistoryMessage[] = [];
    const transcript: { role: "customer" | "ai"; content: string }[] = [];
    const turns: LabStressTurn[] = [];
    let totalErrors = 0;
    let salesBrain: SalesBrainSnapshot | null = null;

    let customerMessage = pickPersonaOpener(persona.id);

    for (let i = 0; i < maxTurns; i++) {
      const result = await generateSimpleAssistantReply(admin, {
        customerMessage,
        conversationId: null,
        contactId: null,
        labMode: true,
        historyOverride: [...history],
        salesBrainOverride: salesBrain,
      });

      if (!result || result.generationFailed) {
        return {
          success: false,
          error:
            result?.errorMessage ??
            "Stres testi yarıda kaldı — asistan yanıt üretemedi.",
        };
      }

      salesBrain = result.salesBrain ?? salesBrain;

      const brain = await buildLabBrainTrace({
        customerMessage,
        history: [...history],
        reply: result.reply,
        salesBrain: toLabSalesBrainView(
          result.salesBrain,
          result.salesBrainReflect,
          result.conversationCritic,
          result.conversationStrategy,
          result.decisionPack
            ? {
                strategyId: result.decisionPack.strategyId,
                analysis: result.decisionPack.analysis,
              }
            : null
        ),
      });

      totalErrors += brain.errors.length;
      turns.push({
        customerMessage,
        reply: result.reply,
        model: result.model,
        aiRunId: result.aiRunId,
        brain: {
          ...brain,
          turnLabel: `${persona.label} · Tur ${i + 1}`,
        },
      });

      history.push(
        { senderType: "customer", content: customerMessage },
        { senderType: "ai", content: result.reply }
      );
      transcript.push(
        { role: "customer", content: customerMessage },
        { role: "ai", content: result.reply }
      );

      if (i >= maxTurns - 1) break;

      const next = await generateStressCustomerMessage({
        history: transcript,
        turnIndex: i + 1,
        maxTurns,
        personaId: persona.id,
      });
      customerMessage = next.message;
      if (next.done && i >= 2) {
        const last = await generateSimpleAssistantReply(admin, {
          customerMessage,
          conversationId: null,
          contactId: null,
          labMode: true,
          historyOverride: [...history],
          salesBrainOverride: salesBrain,
        });
        if (last && !last.generationFailed) {
          salesBrain = last.salesBrain ?? salesBrain;
          const lastBrain = await buildLabBrainTrace({
            customerMessage,
            history: [...history],
            reply: last.reply,
            salesBrain: toLabSalesBrainView(
              last.salesBrain,
              last.salesBrainReflect,
              last.conversationCritic,
              last.conversationStrategy,
              last.decisionPack
                ? {
                    strategyId: last.decisionPack.strategyId,
                    analysis: last.decisionPack.analysis,
                  }
                : null
            ),
          });
          totalErrors += lastBrain.errors.length;
          turns.push({
            customerMessage,
            reply: last.reply,
            model: last.model,
            aiRunId: last.aiRunId,
            brain: {
              ...lastBrain,
              turnLabel: `${persona.label} · Tur ${turns.length + 1}`,
            },
          });
        }
        break;
      }
    }

    return {
      success: true,
      data: {
        turns,
        totalErrors,
        personaId: persona.id,
        personaLabel: persona.label,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stres testi başarısız.";
    return { success: false, error: message };
  }
}
