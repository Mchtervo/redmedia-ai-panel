/**
 * Benchmark runner — gerçek generateSimpleAssistantReply (labMode).
 * Production Instagram gönderimi yok.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AssistantHistoryMessage } from "@/features/ai/prompts/simple-assistant";
import { generateSimpleAssistantReply } from "@/features/ai/services/simple-assistant.service";
import type { SalesBrainSnapshot } from "@/features/ai/services/sales-brain.service";
import { isOpenAiConfigured } from "@/lib/ai/openai-client";
import {
  enrichTurnReflection,
  evaluateScenarioRun,
  findRepeatedPhrases,
} from "./sales-benchmark-evaluator.service";
import { listBenchmarkScenarios } from "./sales-benchmark-scenarios";
import {
  buildBenchmarkSummary,
  compareRegression,
  loadPreviousBenchmarkSummary,
  saveBenchmarkSummary,
} from "./sales-benchmark-report.service";
import type {
  BenchmarkRunOptions,
  BenchmarkRunSummary,
  BenchmarkTurnLog,
  ScenarioRunResult,
} from "./sales-benchmark.types";
import { BENCHMARK_PROMPT_VERSION } from "./sales-benchmark.types";

type TypedSupabase = SupabaseClient<Database>;

export async function runSingleBenchmarkScenario(
  supabase: TypedSupabase,
  scenarioId: string,
  options?: { useLlmJudge?: boolean }
): Promise<ScenarioRunResult> {
  const scenarios = listBenchmarkScenarios({ ids: [scenarioId] });
  const scenario = scenarios[0];
  if (!scenario) {
    throw new Error(`Senaryo bulunamadı: ${scenarioId}`);
  }

  const started = Date.now();
  let brain: SalesBrainSnapshot | null = null;
  const history: AssistantHistoryMessage[] = [];
  const turns: BenchmarkTurnLog[] = [];
  const previousReplies: string[] = [];

  for (let i = 0; i < scenario.turns.length; i++) {
    const spec = scenario.turns[i]!;
    let customerMessage = spec.customer?.trim() ?? "";
    if (spec.when) {
      customerMessage = spec.when({
        lastReply: turns[turns.length - 1]?.finalReply ?? "",
        brain,
        turnIndex: i,
      });
    }
    if (!customerMessage) {
      throw new Error(`${scenario.id} tur ${i}: müşteri mesajı boş`);
    }

    const result = await generateSimpleAssistantReply(supabase, {
      customerMessage,
      conversationId: null,
      contactId: null,
      labMode: true,
      historyOverride: [...history],
      salesBrainOverride: brain,
    });

    if (!result || result.generationFailed) {
      const failLog: BenchmarkTurnLog = {
        turnIndex: i,
        customerMessage,
        originalReply: "",
        finalReply: "",
        model: result?.model ?? "none",
        aiRunId: result?.aiRunId ?? "",
        brain: null,
        reflection: {
          pass: false,
          issues: ["generation_failed"],
          rewritten: false,
          findings: ["generation_failed"],
          detectedRepetition: false,
          detectedMemoryConflict: false,
          detectedUnsupportedClaim: false,
          detectedOverlength: false,
          detectedWrongObjective: false,
        },
        funnelState: null,
        scores: null,
        customerType: null,
        customerTypeConfidence: null,
        objective: null,
        nextBestAction: null,
        memorySnapshot: null,
      };
      turns.push(failLog);
      break;
    }

    brain = result.salesBrain ?? brain;
    const originalReply = result.reply;
    const rewritten = Boolean(result.salesBrainReflect?.rewritten);
    const issues = result.salesBrainReflect?.issues ?? [];

    let log: BenchmarkTurnLog = {
      turnIndex: i,
      customerMessage,
      originalReply,
      finalReply: result.reply,
      model: result.model,
      aiRunId: result.aiRunId,
      brain: result.salesBrain ?? null,
      reflection: {
        pass: result.salesBrainReflect?.pass ?? null,
        issues,
        rewritten,
        findings: [...issues],
        detectedRepetition: false,
        detectedMemoryConflict: false,
        detectedUnsupportedClaim: false,
        detectedOverlength: false,
        detectedWrongObjective: false,
      },
      funnelState: result.salesBrain?.state ?? null,
      scores: result.salesBrain?.scores ?? null,
      customerType: result.salesBrain?.customerType ?? null,
      customerTypeConfidence: result.salesBrain?.customerTypeConfidence ?? null,
      objective: result.salesBrain?.objective ?? null,
      nextBestAction: result.salesBrain?.nextBestAction ?? null,
      memorySnapshot: result.salesBrain?.memory ?? null,
    };

    log = {
      ...log,
      reflection: enrichTurnReflection(log, previousReplies),
    };
    previousReplies.push(log.finalReply);
    turns.push(log);

    history.push(
      { senderType: "customer", content: customerMessage },
      { senderType: "ai", content: result.reply }
    );
  }

  const evaluation = await evaluateScenarioRun(scenario, turns, {
    useLlmJudge: options?.useLlmJudge,
  });

  return {
    scenario,
    turns,
    evaluation,
    durationMs: Date.now() - started,
  };
}

export async function runSalesBenchmark(
  supabase: TypedSupabase,
  options: BenchmarkRunOptions = {}
): Promise<BenchmarkRunSummary> {
  if (!isOpenAiConfigured()) {
    throw new Error(
      "OpenAI yapılandırılmamış — benchmark gerçek motor gerektirir."
    );
  }

  const scenarios = listBenchmarkScenarios({
    ids: options.scenarioIds,
    difficulties: options.difficulties,
  });

  if (scenarios.length === 0) {
    throw new Error("Çalıştırılacak senaryo yok.");
  }

  const results: ScenarioRunResult[] = [];
  for (const scenario of scenarios) {
    const result = await runSingleBenchmarkScenario(supabase, scenario.id, {
      useLlmJudge: options.useLlmJudge,
    });
    results.push(result);
  }

  const repeatedPhrases = findRepeatedPhrases(results);
  let repetitionPenalty = 0;
  for (const p of repeatedPhrases) {
    if (p.count > 3) repetitionPenalty += (p.count - 3) * 1;
  }

  const model =
    results.find((r) => r.turns[0]?.model)?.turns[0]?.model ?? null;

  let summary = buildBenchmarkSummary({
    results,
    model,
    gitCommit: options.gitCommit ?? null,
    promptVersion: BENCHMARK_PROMPT_VERSION,
    repetitionPenalty,
    repeatedPhrases,
  });

  const previous = await loadPreviousBenchmarkSummary(supabase);
  const regression = compareRegression(summary, previous);
  summary = { ...summary, regression };

  if (options.saveResult !== false) {
    await saveBenchmarkSummary(supabase, summary);
  }

  return summary;
}

export function isBenchmarkRunnable(): boolean {
  return isOpenAiConfigured();
}
