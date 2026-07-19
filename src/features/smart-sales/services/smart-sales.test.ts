import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inferLifecycleStage } from "@/features/smart-sales/services/lifecycle.service";
import { computeOpportunityScore } from "@/features/smart-sales/services/opportunity-score.service";
import { suggestSalesTags } from "@/features/smart-sales/services/tags.service";

describe("inferLifecycleStage", () => {
  it("yeni müşteri varsayılanı", () => {
    assert.equal(inferLifecycleStage({}), "new_customer");
  });

  it("kapora bekleniyor", () => {
    assert.equal(
      inferLifecycleStage({ reservationStatus: "deposit_pending" }),
      "awaiting_deposit"
    );
  });

  it("confirmed → rezervasyon onaylandı", () => {
    assert.equal(
      inferLifecycleStage({ reservationStatus: "confirmed" }),
      "reservation_confirmed"
    );
  });
});

describe("computeOpportunityScore", () => {
  it("0-100 aralığında kalır", () => {
    const score = computeOpportunityScore({
      totalMessages: 20,
      hasPhone: true,
      hasEventDate: true,
      hasServices: true,
      bookingProbability: 80,
      negotiationTendency: null,
      priceSensitivity: null,
      decisionSpeed: "hızlı",
      daysUntilEvent: 10,
      replyGapHours: 2,
      priorReservation: false,
      priorCancellation: false,
      lifecycleStage: "awaiting_deposit",
    });
    assert.ok(score >= 0 && score <= 100);
    assert.ok(score >= 50);
  });
});

describe("suggestSalesTags", () => {
  it("sıcak ve acil etiket üretir", () => {
    const tags = suggestSalesTags({
      opportunityScore: 85,
      daysUntilEvent: 10,
      negotiationTendency: "yüksek",
    });
    assert.ok(tags.includes("sıcak müşteri"));
    assert.ok(tags.includes("acil tarih"));
    assert.ok(tags.includes("pazarlıkçı"));
  });
});
