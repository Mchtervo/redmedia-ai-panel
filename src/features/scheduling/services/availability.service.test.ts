import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkAvailability,
  computeEffectiveBusyWindow,
  defaultTravelMinutesBetween,
} from "@/features/scheduling/services/availability.service";

describe("checkAvailability", () => {
  it("confirmed çakışmada hardConflict verir", () => {
    const result = checkAvailability({
      candidateStart: "2026-08-15T12:00:00.000Z",
      candidateEnd: "2026-08-15T14:00:00.000Z",
      platoId: "p1",
      teamId: "t1",
      existing: [
        {
          id: "r1",
          status: "confirmed",
          platoId: "p1",
          teamId: "t1",
          effectiveBusyStartAt: "2026-08-15T11:00:00.000Z",
          effectiveBusyEndAt: "2026-08-15T13:00:00.000Z",
          timeStatus: "confirmed",
        },
      ],
    });

    assert.equal(result.hardConflict, true);
    assert.equal(result.available, false);
  });

  it("saati unknown confirmed için uyarı verir", () => {
    const result = checkAvailability({
      candidateStart: "2026-08-15T12:00:00.000Z",
      candidateEnd: "2026-08-15T14:00:00.000Z",
      existing: [
        {
          id: "r2",
          status: "confirmed",
          platoId: null,
          teamId: null,
          effectiveBusyStartAt: null,
          effectiveBusyEndAt: null,
          timeStatus: "unknown",
        },
      ],
    });

    assert.equal(result.hasUnknownTimeConfirmed, true);
    assert.equal(result.available, false);
  });
});

describe("computeEffectiveBusyWindow", () => {
  it("gelin alma öncesi 1 saat varış bufferı ekler", () => {
    const start = new Date("2026-08-15T15:00:00.000Z");
    const end = new Date("2026-08-15T16:00:00.000Z");
    const { effectiveBusyStartAt, effectiveBusyEndAt } =
      computeEffectiveBusyWindow({
        scheduledStartAt: start,
        scheduledEndAt: end,
        travelBeforeMinutes: 60,
        preparationBeforeMinutes: 0,
        travelAfterMinutes: 0,
      });

    assert.equal(effectiveBusyStartAt.toISOString(), "2026-08-15T14:00:00.000Z");
    assert.equal(effectiveBusyEndAt.toISOString(), "2026-08-15T16:00:00.000Z");
  });
});

describe("defaultTravelMinutesBetween", () => {
  it("aynı konumda 0, farklı ilçede default döner", () => {
    assert.equal(
      defaultTravelMinutesBetween({
        sameLocation: true,
        sameDistrict: true,
        defaultTravelMinutes: 60,
      }),
      0
    );
    assert.equal(
      defaultTravelMinutesBetween({
        sameLocation: false,
        sameDistrict: false,
        defaultTravelMinutes: 60,
      }),
      60
    );
  });
});
