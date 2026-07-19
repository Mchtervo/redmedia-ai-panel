/**
 * Adversarial Sales Benchmark runner.
 * LLM müşteri ↔ gerçek generateSimpleAssistantReply (labMode).
 */

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AssistantHistoryMessage } from "@/features/ai/prompts/simple-assistant";
import { generateSimpleAssistantReply } from "@/features/ai/services/simple-assistant.service";
import type {
  LeadScores,
  SalesBrainSnapshot,
} from "@/features/ai/services/sales-brain.service";
import { isOpenAiConfigured } from "@/lib/ai/openai-client";
import { generateAdversarialCustomerMessage } from "./adversarial-customer.service";
import { judgeAdversarialConversation } from "./adversarial-conversation-judge.service";
import {
  buildCustomerVariants,
  listAdversarialScenarioSeeds,
} from "./adversarial-sales-benchmark-scenarios";
import {
  saveAdversarialSummary,
} from "./adversarial-sales-benchmark-report.service";
import type {
  AdversarialLossTag,
  AdversarialRunOptions,
  AdversarialRunSummary,
  AdversarialScenarioAggregate,
  AdversarialTurnLog,
  AdversarialVariantRun,
} from "./adversarial-sales-benchmark.types";
import { ADVERSARIAL_PROMPT_VERSION } from "./adversarial-sales-benchmark.types";

type TypedSupabase = SupabaseClient<Database>;

export function isAdversarialBenchmarkRunnable(): boolean {
  return isOpenAiConfigured();
}

async function runVariant(
  supabase: TypedSupabase,
  scenarioId: string,
  scenarioName: string,
  maxTurns: number,
  variant: ReturnType<typeof buildCustomerVariants>[number],
  seed: ReturnType<typeof listAdversarialScenarioSeeds>[number]
): Promise<AdversarialVariantRun> {
  const started = Date.now();
  const turns: AdversarialTurnLog[] = [];
  const history: AssistantHistoryMessage[] = [];
  let brain: SalesBrainSnapshot | null = null;
  let initialScores: LeadScores | null = null;
  let finalScores: LeadScores | null = null;

  try {
    for (let i = 0; i < maxTurns; i++) {
      const customer = await generateAdversarialCustomerMessage({
        seed,
        variant,
        turnsSoFar: turns,
        turnIndex: i,
      });
      if (!customer.message.trim()) break;

      const result = await generateSimpleAssistantReply(supabase, {
        customerMessage: customer.message,
        conversationId: null,
        contactId: null,
        labMode: true,
        historyOverride: [...history],
        salesBrainOverride: brain,
      });

      if (!result || result.generationFailed) {
        return {
          scenarioId,
          variantIndex: variant.variantIndex,
          seedLabel: variant.seedLabel,
          turns,
          judge: {
            trustTrajectory: "generation_failed",
            purchaseIntentTrajectory: "generation_failed",
            whereCustomerWasLost: "Asistan üretimi başarısız",
            firstMistakeTurnIndex: i,
            replyThatHurtConversion: null,
            betterAlternativeReply: null,
            lossTags: ["trust"],
            finalTrustDelta: null,
            finalPurchaseIntentDelta: null,
            overallScore: 0,
            notes: [result?.errorMessage ?? "generation_failed"],
          },
          initialScores,
          finalScores,
          durationMs: Date.now() - started,
          error: result?.errorMessage ?? "generation_failed",
        };
      }

      brain = result.salesBrain ?? brain;
      const scores = brain?.scores ?? null;
      if (i === 0 && scores) initialScores = { ...scores };
      if (scores) finalScores = { ...scores };

      turns.push({
        turnIndex: i,
        customerMessage: customer.message,
        assistantReply: result.reply,
        brain,
        trust: scores?.trust ?? null,
        purchaseIntent: scores?.purchaseIntent ?? null,
        criticRewritten: result.conversationCritic?.rewritten ?? null,
      });

      history.push(
        { senderType: "customer", content: customer.message },
        { senderType: "ai", content: result.reply }
      );

      if (customer.endConversation) break;
    }

    const judge = await judgeAdversarialConversation({
      scenarioName,
      turns,
      initialScores,
      finalScores,
    });

    return {
      scenarioId,
      variantIndex: variant.variantIndex,
      seedLabel: variant.seedLabel,
      turns,
      judge,
      initialScores,
      finalScores,
      durationMs: Date.now() - started,
      error: null,
    };
  } catch (error) {
    return {
      scenarioId,
      variantIndex: variant.variantIndex,
      seedLabel: variant.seedLabel,
      turns,
      judge: {
        trustTrajectory: "error",
        purchaseIntentTrajectory: "error",
        whereCustomerWasLost: null,
        firstMistakeTurnIndex: null,
        replyThatHurtConversion: null,
        betterAlternativeReply: null,
        lossTags: ["none"],
        finalTrustDelta: null,
        finalPurchaseIntentDelta: null,
        overallScore: 0,
        notes: [error instanceof Error ? error.message : "unknown_error"],
      },
      initialScores,
      finalScores,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

function aggregateScenario(
  scenarioId: string,
  name: string,
  variants: AdversarialVariantRun[]
): AdversarialScenarioAggregate {
  const scores = variants.map((v) => v.judge.overallScore);
  const avgOverallScore =
    scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

  const trustDeltas = variants
    .map((v) => v.judge.finalTrustDelta)
    .filter((n): n is number => n != null);
  const intentDeltas = variants
    .map((v) => v.judge.finalPurchaseIntentDelta)
    .filter((n): n is number => n != null);
  const mistakeTurns = variants
    .map((v) => v.judge.firstMistakeTurnIndex)
    .filter((n): n is number => n != null);

  const lossTagCounts: Partial<Record<AdversarialLossTag, number>> = {};
  for (const v of variants) {
    for (const tag of v.judge.lossTags) {
      lossTagCounts[tag] = (lossTagCounts[tag] ?? 0) + 1;
    }
  }

  return {
    scenarioId,
    name,
    variantCount: variants.length,
    avgOverallScore: Math.round(avgOverallScore * 10) / 10,
    avgTrustDelta:
      trustDeltas.length > 0
        ? Math.round(
            (trustDeltas.reduce((a, b) => a + b, 0) / trustDeltas.length) * 10
          ) / 10
        : null,
    avgPurchaseIntentDelta:
      intentDeltas.length > 0
        ? Math.round(
            (intentDeltas.reduce((a, b) => a + b, 0) / intentDeltas.length) *
              10
          ) / 10
        : null,
    lossTagCounts,
    firstMistakeTurnAvg:
      mistakeTurns.length > 0
        ? Math.round(
            (mistakeTurns.reduce((a, b) => a + b, 0) / mistakeTurns.length) *
              10
          ) / 10
        : null,
    variants,
  };
}

export async function runAdversarialSalesBenchmark(
  supabase: TypedSupabase,
  options: AdversarialRunOptions = {}
): Promise<AdversarialRunSummary> {
  const started = Date.now();
  const customersPerScenario = Math.max(
    1,
    Math.min(5, options.customersPerScenario ?? 5)
  );
  const seeds = listAdversarialScenarioSeeds(options.scenarioIds);
  const variants = buildCustomerVariants(customersPerScenario);
  const aggregates: AdversarialScenarioAggregate[] = [];

  for (const seed of seeds) {
    const maxTurns = options.maxTurnsOverride ?? seed.maxTurns;
    const runs: AdversarialVariantRun[] = [];
    for (const variant of variants) {
      runs.push(
        await runVariant(
          supabase,
          seed.id,
          seed.name,
          maxTurns,
          variant,
          seed
        )
      );
    }
    aggregates.push(aggregateScenario(seed.id, seed.name, runs));
  }

  const allScores = aggregates.flatMap((a) =>
    a.variants.map((v) => v.judge.overallScore)
  );
  const avgOverallScore =
    allScores.length > 0
      ? Math.round(
          (allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10
        ) / 10
      : 0;

  const summary: AdversarialRunSummary = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    promptVersion: ADVERSARIAL_PROMPT_VERSION,
    customersPerScenario,
    scenarioCount: seeds.length,
    variantRunCount: allScores.length,
    avgOverallScore,
    aggregates,
    durationMs: Date.now() - started,
    notes: [
      "Sabit müşteri mesajı yok — LLM müşteri rolünde.",
      "Hakem tüm konuşmayı analiz eder.",
      "Gerçek kayıp etiketleri: price/trust/too_long/misunderstood/oversell.",
      "Haftalık: anonim gerçek DM'leri bu pipeline'dan geçirin; kural eklemek yerine kayıplara göre iyileştirin.",
    ],
  };

  if (options.saveResult !== false) {
    await saveAdversarialSummary(summary);
  }

  return summary;
}
