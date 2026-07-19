import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SALES_BENCHMARK_SCENARIOS,
  listBenchmarkScenarios,
} from "./sales-benchmark-scenarios";
import {
  evaluateScenarioRun,
  findRepeatedPhrases,
} from "./sales-benchmark-evaluator.service";
import { compareRegression, buildBenchmarkSummary } from "./sales-benchmark-report.service";
import type {
  BenchmarkTurnLog,
  ScenarioRunResult,
} from "./sales-benchmark.types";
import { createInitialSalesBrain } from "@/features/ai/services/sales-brain.service";
import { isOpenAiConfigured } from "@/lib/ai/openai-client";

function makeTurn(
  partial: Partial<BenchmarkTurnLog> & {
    customerMessage: string;
    finalReply: string;
  }
): BenchmarkTurnLog {
  const brain = createInitialSalesBrain("bench", 1);
  return {
    turnIndex: 0,
    originalReply: partial.finalReply,
    model: "test",
    aiRunId: "x",
    brain,
    reflection: {
      pass: true,
      issues: [],
      rewritten: false,
      findings: [],
      detectedRepetition: false,
      detectedMemoryConflict: false,
      detectedUnsupportedClaim: false,
      detectedOverlength: false,
      detectedWrongObjective: false,
    },
    funnelState: brain.state,
    scores: brain.scores,
    customerType: brain.customerType,
    customerTypeConfidence: brain.customerTypeConfidence,
    objective: brain.objective,
    nextBestAction: brain.nextBestAction,
    memorySnapshot: brain.memory,
    ...partial,
  };
}

describe("sales-benchmark scenarios", () => {
  it("en az 40 senaryo ve master stress içerir", () => {
    assert.ok(SALES_BENCHMARK_SCENARIOS.length >= 40);
    assert.ok(SALES_BENCHMARK_SCENARIOS.some((s) => s.isMasterStress));
    assert.equal(listBenchmarkScenarios().length, SALES_BENCHMARK_SCENARIOS.length);
  });

  it("zorluk filtresi çalışır", () => {
    const stress = listBenchmarkScenarios({ difficulties: ["stress"] });
    assert.ok(stress.length >= 3);
    assert.ok(stress.every((s) => s.difficulty === "stress"));
  });
});

describe("sales-benchmark evaluator", () => {
  it("albüm reddi sonrası öneriyi hard fail sayar", async () => {
    const scenario = SALES_BENCHMARK_SCENARIOS.find((s) => s.id === "memory-01")!;
    const brain = createInitialSalesBrain("m", 2);
    brain.memory.album = false;
    brain.memory.rejectedTopics = ["album"];

    const turns = [
      makeTurn({
        turnIndex: 0,
        customerMessage: "Albüm istemiyorum",
        finalReply: "Anladım, foto ve klip odaklı gidelim.",
        brain: { ...brain, memory: { ...brain.memory, album: false, rejectedTopics: ["album"] } },
      }),
      makeTurn({
        turnIndex: 1,
        customerMessage: "Fiyat nedir?",
        finalReply: "Albüm düşünür müsünüz? Premium 14.000 TL.",
        brain: { ...brain, memory: { ...brain.memory, album: false, rejectedTopics: ["album"] } },
      }),
    ];

    const ev = await evaluateScenarioRun(scenario, turns, {
      useLlmJudge: false,
    });
    assert.ok(ev.hardFails.includes("reoffered_rejected_service"));
    assert.equal(ev.pass, false);
  });

  it("ikinci fiyat talebinden sonra saklamayı hard fail sayar", async () => {
    const scenario = SALES_BENCHMARK_SCENARIOS.find(
      (s) => s.id === "price-hunter-01"
    )!;
    const turns = [
      makeTurn({
        turnIndex: 0,
        customerMessage: "Merhaba fiyat alabilir miyim?",
        finalReply: "Tabii, nasıl bir çekim düşünüyorsunuz?",
      }),
      makeTurn({
        turnIndex: 1,
        customerMessage: "Sadece fiyat öğrenmek istiyorum.",
        finalReply: "Önce albüm mü klip mi söyleyin.",
      }),
    ];
    const ev = await evaluateScenarioRun(scenario, turns, {
      useLlmJudge: false,
    });
    assert.ok(ev.hardFails.includes("hid_price_after_second_ask"));
  });

  it("rakip saldırısını hard fail sayar", async () => {
    const scenario = SALES_BENCHMARK_SCENARIOS.find(
      (s) => s.id === "price-hunter-02"
    )!;
    const turns = [
      makeTurn({
        customerMessage: "Başka yer ucuz",
        finalReply: "Onlar kötü ve dolandırıcı, sakın onlara gitmeyin. Biz 11.000 TL.",
      }),
    ];
    const ev = await evaluateScenarioRun(scenario, turns, {
      useLlmJudge: false,
    });
    assert.ok(ev.hardFails.includes("attacked_competitor"));
  });

  it("reflection fail + rewrite yok → hard fail", async () => {
    const scenario = SALES_BENCHMARK_SCENARIOS[0]!;
    const turn = makeTurn({
      customerMessage: "Merhaba",
      finalReply: "Selam",
      reflection: {
        pass: false,
        issues: ["Mesaj fazla uzun"],
        rewritten: false,
        findings: ["Mesaj fazla uzun"],
        detectedRepetition: false,
        detectedMemoryConflict: false,
        detectedUnsupportedClaim: false,
        detectedOverlength: true,
        detectedWrongObjective: false,
      },
    });
    const ev = await evaluateScenarioRun(scenario, [turn], {
      useLlmJudge: false,
    });
    assert.ok(ev.hardFails.includes("reflection_failed_no_rewrite"));
  });

  it("tekrarlayan kapanışları sayar", () => {
    const results = [
      {
        turns: [
          makeTurn({
            customerMessage: "a",
            finalReply: "Eşinizle bugün mü konuşursunuz hafta sonu mu?",
          }),
        ],
      },
      {
        turns: [
          makeTurn({
            customerMessage: "b",
            finalReply: "Eşinizle bugün mü karar verirsiniz?",
          }),
        ],
      },
      {
        turns: [
          makeTurn({
            customerMessage: "c",
            finalReply: "Hangisi size daha yakın?",
          }),
        ],
      },
      {
        turns: [
          makeTurn({
            customerMessage: "d",
            finalReply: "Hangisi size daha yakın bir seçenek?",
          }),
        ],
      },
    ];
    const phrases = findRepeatedPhrases(results);
    assert.ok(phrases.some((p) => p.phrase.includes("eşinizle") && p.count >= 2));
  });
});

describe("sales-benchmark regression", () => {
  it("ortalama 3 puan düşüşü fail eder", () => {
    const mk = (avg: number, hard: number): ReturnType<typeof buildBenchmarkSummary> => {
      const fakeResults = SALES_BENCHMARK_SCENARIOS.slice(0, 2).map(
        (scenario, i) =>
          ({
            scenario,
            turns: [],
            evaluation: {
              scenarioId: scenario.id,
              totalScore: avg + i,
              pass: true,
              hardFails: hard > 0 && i === 0 ? ["cognitive_dump" as const] : [],
              breakdown: {
                questionUnderstanding: 5,
                memoryUsage: 5,
                customerTypeDetection: 5,
                empathyTone: 5,
                valuePresentation: 5,
                objectionHandling: 5,
                brevityNaturalness: 5,
                singlePurpose: 3,
                nextBestAction: 5,
                ethicalClosing: 3,
              },
              deterministicScore: 40,
              softScore: 20,
              notes: [],
              behaviorHits: [],
              behaviorMisses: [],
            },
            durationMs: 1,
          }) satisfies ScenarioRunResult
      );
      return buildBenchmarkSummary({
        results: fakeResults,
        model: "t",
        gitCommit: null,
        repetitionPenalty: 0,
        repeatedPhrases: [],
      });
    };

    const prev = mk(80, 0);
    const cur = mk(70, 1);
    // force averages
    prev.averageScore = 80;
    prev.hardFailCount = 0;
    cur.averageScore = 70;
    cur.hardFailCount = 2;
    const reg = compareRegression(cur, prev);
    assert.equal(reg.failed, true);
    assert.ok(reg.reasons.some((r) => /Ortalama|Hard fail/i.test(r)));
  });
});

describe("sales-benchmark live smoke (optional)", () => {
  it("OpenAI varsa tek senaryo gerçek motorla koşar", async (t) => {
    if (!isOpenAiConfigured()) {
      t.skip();
      return;
    }
    const { createAdminClient } = await import("@/server/supabase/admin");
    const { runSingleBenchmarkScenario } = await import(
      "./sales-benchmark-runner.service"
    );
    const admin = createAdminClient();
    const result = await runSingleBenchmarkScenario(admin, "trust-03", {
      useLlmJudge: false,
    });
    assert.ok(result.turns.length >= 1);
    assert.ok(result.turns[0]!.finalReply.length > 0);
    assert.ok(result.turns[0]!.brain != null);
    assert.ok(typeof result.evaluation.totalScore === "number");
  });
});
