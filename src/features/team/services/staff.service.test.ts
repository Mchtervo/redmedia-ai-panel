import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasEnoughStaffCapacity,
  resolveRequiredRoles,
} from "@/features/team/services/role-resolution.service";
import {
  countAvailableForRole,
  evaluateStaffCandidate,
  rankStaffSuggestions,
} from "@/features/team/services/staff-availability.service";
import type { StaffRoleSlug } from "@/features/team/types";

describe("resolveRequiredRoles", () => {
  it("nişan yalnız fotoğraf → Etkinlik Fotoğrafçısı", () => {
    const slots = resolveRequiredRoles([
      {
        id: "1",
        slug: "nisan-fotograf",
        service_type: "photo",
        category_slug: "nisan",
      },
    ]);
    assert.equal(slots.length, 1);
    assert.equal(slots[0]?.roleSlug, "event_photographer");
  });

  it("düğün salonu yalnız fotoğraf → Salon Fotoğrafçısı", () => {
    const slots = resolveRequiredRoles([
      {
        id: "1",
        slug: "salon-fotograf",
        service_type: "photo",
        category_slug: "salon-dugun",
      },
    ]);
    assert.equal(slots[0]?.roleSlug, "wedding_venue_photographer");
  });

  it("omuz kamera → Omuz Kamera Operatörü", () => {
    const slots = resolveRequiredRoles([
      {
        id: "1",
        slug: "gelin-alma-omuz",
        service_type: "shoulder_cam",
        category_slug: "gelin-alma",
      },
    ]);
    assert.equal(slots[0]?.roleSlug, "shoulder_camera_operator");
  });

  it("fotoğraf + video → Ana Çekim Sorumlusu", () => {
    const slots = resolveRequiredRoles([
      {
        id: "1",
        slug: "nisan-fotograf",
        service_type: "photo",
        category_slug: "nisan",
      },
      {
        id: "2",
        slug: "nisan-video",
        service_type: "video",
        category_slug: "nisan",
      },
    ]);
    assert.ok(slots.some((s) => s.roleSlug === "main_operator"));
    assert.ok(!slots.some((s) => s.roleSlug === "event_photographer"));
  });

  it("dış çekim foto → Ana Çekim Sorumlusu", () => {
    const slots = resolveRequiredRoles([
      {
        id: "1",
        slug: "dis-cekim-fotograf",
        service_type: "photo",
        category_slug: "dis-cekim",
      },
    ]);
    assert.equal(slots[0]?.roleSlug, "main_operator");
  });
});

describe("staff capacity", () => {
  it("iki müsait kişi iki rezervasyonu karşılar", () => {
    assert.equal(
      hasEnoughStaffCapacity({ requiredQuantity: 1, availableCount: 2 }),
      true
    );
    assert.equal(
      hasEnoughStaffCapacity({ requiredQuantity: 1, availableCount: 0 }),
      false
    );
  });
});

describe("evaluateStaffCandidate", () => {
  const baseMember = {
    id: "s1",
    fullName: "Ahmet",
    active: true,
    roleSlugs: ["event_photographer"] as StaffRoleSlug[],
  };

  it("izinli personeli işaretler", () => {
    const c = evaluateStaffCandidate({
      member: baseMember,
      requiredRole: "event_photographer",
      candidateStartAt: "2026-08-01T12:00:00+03:00",
      candidateEndAt: "2026-08-01T14:00:00+03:00",
      busyBlocks: [],
      leaveBlocks: [
        {
          staffMemberId: "s1",
          startAt: "2026-08-01T00:00:00+03:00",
          endAt: "2026-08-02T00:00:00+03:00",
          type: "leave",
        },
      ],
    });
    assert.equal(c.status, "on_leave");
  });

  it("saat çakışmasını işaretler", () => {
    const c = evaluateStaffCandidate({
      member: baseMember,
      requiredRole: "event_photographer",
      candidateStartAt: "2026-08-01T12:00:00+03:00",
      candidateEndAt: "2026-08-01T14:00:00+03:00",
      busyBlocks: [
        {
          staffMemberId: "s1",
          reservationId: "r1",
          startAt: "2026-08-01T11:00:00+03:00",
          endAt: "2026-08-01T13:00:00+03:00",
          venue: "Salon A",
        },
      ],
      leaveBlocks: [],
    });
    assert.ok(
      c.status === "time_conflict" || c.status === "busy_elsewhere"
    );
  });

  it("yol süresi yetersizliğini işaretler", () => {
    const c = evaluateStaffCandidate({
      member: baseMember,
      requiredRole: "event_photographer",
      candidateStartAt: "2026-08-01T14:00:00+03:00",
      candidateEndAt: "2026-08-01T16:00:00+03:00",
      busyBlocks: [
        {
          staffMemberId: "s1",
          reservationId: "r1",
          startAt: "2026-08-01T10:00:00+03:00",
          endAt: "2026-08-01T13:30:00+03:00",
          venue: "Plato",
        },
      ],
      leaveBlocks: [],
      defaultTravelBufferMinutes: 60,
    });
    assert.equal(c.status, "travel_insufficient");
  });

  it("rol uyumsuzluğunu işaretler", () => {
    const c = evaluateStaffCandidate({
      member: baseMember,
      requiredRole: "main_operator",
      candidateStartAt: "2026-08-01T12:00:00+03:00",
      candidateEndAt: "2026-08-01T14:00:00+03:00",
      busyBlocks: [],
      leaveBlocks: [],
    });
    assert.equal(c.status, "role_mismatch");
  });

  it("öneride müsait olanı üste koyar", () => {
    const ranked = rankStaffSuggestions([
      {
        staffMemberId: "a",
        fullName: "Zeynep",
        roles: ["event_photographer"],
        status: "on_leave",
        statusLabel: "İzinli",
        score: 100,
        sameDayAssignmentCount: 0,
        previousAssignmentSummary: null,
        nextAssignmentSummary: null,
        travelRiskMinutes: null,
      },
      {
        staffMemberId: "b",
        fullName: "Ahmet",
        roles: ["event_photographer"],
        status: "available",
        statusLabel: "Müsait",
        score: 1150,
        sameDayAssignmentCount: 0,
        previousAssignmentSummary: null,
        nextAssignmentSummary: null,
        travelRiskMinutes: null,
      },
    ]);
    assert.equal(ranked[0]?.staffMemberId, "b");
    assert.equal(countAvailableForRole(ranked), 1);
  });
});
