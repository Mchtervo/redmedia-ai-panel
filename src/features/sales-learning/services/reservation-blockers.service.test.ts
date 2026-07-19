import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatReservationBlockersMarkdown,
  type ReservationBlockersReport,
} from "@/features/sales-learning/services/reservation-blockers.service";

function sample(
  overrides: Partial<ReservationBlockersReport> = {}
): ReservationBlockersReport {
  return {
    periodDays: 7,
    analyzedWithoutReservation: 12,
    lostCount: 5,
    openCount: 7,
    topReasons: [
      {
        id: "loss_reason:fiyat",
        label: "fiyat yüksek",
        count: 4,
        source: "loss_reason",
      },
    ],
    topDropOffs: [
      {
        id: "drop_off_point:paket",
        label: "paket anlatımı",
        count: 3,
        source: "drop_off_point",
      },
    ],
    topObjections: [],
    suggestions: ["En sık kayıp nedeni: “fiyat yüksek”."],
    dataSufficiency: "sufficient",
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("formatReservationBlockersMarkdown", () => {
  it("returns empty-data message when insufficient", () => {
    const md = formatReservationBlockersMarkdown(
      sample({ dataSufficiency: "insufficient" })
    );
    assert.match(md, /Yeterli veri bulunamadı/);
  });

  it("includes top reasons and drop-offs", () => {
    const md = formatReservationBlockersMarkdown(sample());
    assert.match(md, /Kaçan rezervasyon nedenleri/);
    assert.match(md, /fiyat yüksek/);
    assert.match(md, /paket anlatımı/);
  });
});
