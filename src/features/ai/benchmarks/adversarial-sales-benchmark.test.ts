import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCustomerVariants,
  listAdversarialScenarioSeeds,
} from "./adversarial-sales-benchmark-scenarios";
import { formatAdversarialReportText } from "./adversarial-sales-benchmark-report.service";
import type { AdversarialRunSummary } from "./adversarial-sales-benchmark.types";

describe("adversarial scenarios", () => {
  it("en az 5 seed senaryo içerir", () => {
    const seeds = listAdversarialScenarioSeeds();
    assert.ok(seeds.length >= 5);
    for (const s of seeds) {
      assert.ok(s.customerBrief.length > 20);
      assert.ok(s.openingHint.length > 3);
      assert.ok(s.maxTurns >= 5);
    }
  });

  it("id filtresi çalışır", () => {
    const one = listAdversarialScenarioSeeds(["adv-price-whiplash"]);
    assert.equal(one.length, 1);
    assert.equal(one[0]?.id, "adv-price-whiplash");
  });

  it("5 müşteri varyantı üretir", () => {
    const variants = buildCustomerVariants(5);
    assert.equal(variants.length, 5);
    assert.equal(new Set(variants.map((v) => v.seedLabel)).size, 5);
  });

  it("müşteri sayısını 1-5 aralığında tutar", () => {
    assert.equal(buildCustomerVariants(1).length, 1);
    assert.equal(buildCustomerVariants(99).length, 5);
  });
});

describe("adversarial report", () => {
  it("rapor metni skor ve kayıp alanlarını içerir", () => {
    const summary: AdversarialRunSummary = {
      id: "test",
      createdAt: new Date().toISOString(),
      promptVersion: "adversarial_sales_v1",
      customersPerScenario: 2,
      scenarioCount: 1,
      variantRunCount: 2,
      avgOverallScore: 62.5,
      durationMs: 1000,
      notes: ["test"],
      aggregates: [
        {
          scenarioId: "adv-price-whiplash",
          name: "Test",
          variantCount: 2,
          avgOverallScore: 62.5,
          avgTrustDelta: -2,
          avgPurchaseIntentDelta: 4,
          lossTagCounts: { too_long: 1, none: 1 },
          firstMistakeTurnAvg: 1.5,
          variants: [
            {
              scenarioId: "adv-price-whiplash",
              variantIndex: 0,
              seedLabel: "a",
              turns: [],
              judge: {
                trustTrajectory: "düştü",
                purchaseIntentTrajectory: "yükseldi",
                whereCustomerWasLost: "uzun cevap",
                firstMistakeTurnIndex: 1,
                replyThatHurtConversion: "çok uzun paket listesi",
                betterAlternativeReply: "Kısa fiyat + 1 soru",
                lossTags: ["too_long"],
                finalTrustDelta: -5,
                finalPurchaseIntentDelta: 2,
                overallScore: 55,
                notes: [],
              },
              initialScores: null,
              finalScores: null,
              durationMs: 100,
              error: null,
            },
            {
              scenarioId: "adv-price-whiplash",
              variantIndex: 1,
              seedLabel: "b",
              turns: [],
              judge: {
                trustTrajectory: "stabil",
                purchaseIntentTrajectory: "stabil",
                whereCustomerWasLost: null,
                firstMistakeTurnIndex: null,
                replyThatHurtConversion: null,
                betterAlternativeReply: null,
                lossTags: ["none"],
                finalTrustDelta: 1,
                finalPurchaseIntentDelta: 6,
                overallScore: 70,
                notes: [],
              },
              initialScores: null,
              finalScores: null,
              durationMs: 100,
              error: null,
            },
          ],
        },
      ],
    };

    const text = formatAdversarialReportText(summary);
    assert.match(text, /Adversarial Sales Benchmark/);
    assert.match(text, /62\.5/);
    assert.match(text, /too_long/);
    assert.match(text, /alternatif:/);
  });
});
