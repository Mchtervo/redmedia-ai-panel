import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCeoRecommendations,
  buildSummaryBullets,
} from "@/features/ceo-intelligence/services/recommendations.service";
import { buildCeoActionItems } from "@/features/ceo-intelligence/services/risks.service";
import type {
  CeoMetricsSnapshot,
  CeoRiskItem,
} from "@/features/ceo-intelligence/types";
import { addDaysIso, getWeekRangeIstanbul } from "@/features/ceo-intelligence/utils/time";

function baseMetrics(
  overrides: Partial<CeoMetricsSnapshot> = {}
): CeoMetricsSnapshot {
  return {
    reportDate: "2026-07-18",
    generatedAt: new Date().toISOString(),
    newCustomersToday: 2,
    activeConversations: 5,
    awaitingDeposit: 1,
    awaitingReceiptReview: 2,
    shootsToday: 1,
    staffOnDutyToday: 2,
    staffIdleToday: 3,
    staffActiveTotal: 5,
    estimatedRevenueToday: 15000,
    estimatedRevenueThisWeek: 40000,
    pendingCollections: 5000,
    pendingCollectionsCount: 1,
    reservationsThisMonth: 10,
    cancelledThisMonth: 1,
    depositsVerifiedToday: 1,
    conversionRateMonth: 40,
    hotOpportunities: [
      {
        contactId: "c1",
        name: "Ayşe",
        opportunityScore: 80,
        lifecycleStage: "awaiting_deposit",
        tags: [],
        lastSeen: null,
      },
    ],
    topPackages: [{ id: "s1", label: "Dış çekim", count: 4 }],
    topPlateaus: [{ id: "p1", label: "Plato A", count: 3 }],
    topStaffByShoots: [],
    topCampaignsByAttribution: [],
    topObjections: [{ id: "fiyat", label: "fiyat yüksek", count: 3 }],
    negotiatingLast30Days: 4,
    freeDaysThisWeek: ["2026-07-20"],
    busyDaysAhead: [{ id: "2026-07-19", label: "2026-07-19", count: 4 }],
    salesYesterday: 3,
    salesToday: 1,
    dataGaps: ["Reklam atıf verisi (attribution_events) boş veya kampanya bağlı değil."],
    ...overrides,
  };
}

describe("ceo recommendations", () => {
  it("builds summary bullets with key metrics", () => {
    const bullets = buildSummaryBullets(baseMetrics());
    assert.ok(bullets.some((b) => b.includes("2 yeni müşteri")));
    assert.ok(bullets.some((b) => b.includes("kapora")));
    assert.ok(bullets.some((b) => b.includes("Ayşe")));
  });

  it("recommends capacity and attribution gap", () => {
    const recs = buildCeoRecommendations(baseMetrics(), []);
    assert.ok(recs.some((r) => r.id === "attr-gap"));
    assert.ok(recs.some((r) => r.id === "capacity-warning"));
    assert.ok(recs.some((r) => r.id === "top-package"));
  });

  it("action items prioritize receipts and deposits", () => {
    const risks: CeoRiskItem[] = [];
    const items = buildCeoActionItems(baseMetrics(), risks);
    assert.ok(items.some((i) => i.id === "review-receipts"));
    assert.ok(items.some((i) => i.id === "nudge-deposits"));
  });
});

describe("ceo time utils", () => {
  it("adds days in istanbul iso", () => {
    assert.equal(addDaysIso("2026-07-18", 1), "2026-07-19");
  });

  it("returns 7 days for week range", () => {
    const week = getWeekRangeIstanbul("2026-07-18");
    assert.equal(week.days.length, 7);
    assert.equal(week.start, week.days[0]);
    assert.equal(week.end, week.days[6]);
  });
});
