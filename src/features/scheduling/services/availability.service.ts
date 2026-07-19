/**
 * Müsaitlik: effective_busy aralıkları üzerinden çakışma.
 */

export type BusyBlock = {
  id: string;
  status: string;
  platoId: string | null;
  teamId: string | null;
  effectiveBusyStartAt: string | null;
  effectiveBusyEndAt: string | null;
  timeStatus: string;
};

export type AvailabilityCheckInput = {
  candidateStart: string;
  candidateEnd: string;
  platoId?: string | null;
  teamId?: string | null;
  existing: BusyBlock[];
  excludeReservationId?: string;
};

export type AvailabilityResult = {
  available: boolean;
  hardConflict: boolean;
  softWarnings: string[];
  conflictingReservationIds: string[];
  hasUnknownTimeConfirmed: boolean;
};

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

const HARD_STATUSES = new Set(["confirmed", "payment_review", "deposit_pending"]);

/**
 * Confirmed/hard status çakışması → available=false.
 * Draft/pending → soft warning.
 * Saat unknown confirmed → hasUnknownTimeConfirmed.
 */
export function checkAvailability(
  input: AvailabilityCheckInput
): AvailabilityResult {
  const softWarnings: string[] = [];
  const conflictingReservationIds: string[] = [];
  let hardConflict = false;
  let hasUnknownTimeConfirmed = false;

  for (const block of input.existing) {
    if (
      input.excludeReservationId &&
      block.id === input.excludeReservationId
    ) {
      continue;
    }

    if (
      block.status === "confirmed" &&
      block.timeStatus === "unknown"
    ) {
      // Aynı gün riski — caller tarih filtresiyle geçirmiş olmalı
      hasUnknownTimeConfirmed = true;
      softWarnings.push(
        "Bu tarihte saati netleşmemiş confirmed rezervasyon var."
      );
    }

    if (!block.effectiveBusyStartAt || !block.effectiveBusyEndAt) {
      continue;
    }

    const samePlato =
      input.platoId &&
      block.platoId &&
      input.platoId === block.platoId;
    const sameTeam =
      input.teamId && block.teamId && input.teamId === block.teamId;

    if (!samePlato && !sameTeam) {
      // Genel ekip yoksa yine zaman çakışmasını kontrol et (tek ekip varsayımı)
      if (!input.teamId && !block.teamId) {
        // fall through to overlap check as single-crew business
      } else if (!samePlato) {
        continue;
      }
    }

    const isOverlap = overlaps(
      input.candidateStart,
      input.candidateEnd,
      block.effectiveBusyStartAt,
      block.effectiveBusyEndAt
    );

    if (!isOverlap) {
      continue;
    }

    conflictingReservationIds.push(block.id);

    if (HARD_STATUSES.has(block.status)) {
      hardConflict = true;
    } else {
      softWarnings.push(
        `Taslak/bekleyen rezervasyon ile çakışma: ${block.id}`
      );
    }
  }

  return {
    available: !hardConflict && !hasUnknownTimeConfirmed,
    hardConflict,
    softWarnings,
    conflictingReservationIds,
    hasUnknownTimeConfirmed,
  };
}

/**
 * effective busy = start - travel_before - prep ; end + travel_after
 */
export function computeEffectiveBusyWindow(params: {
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  travelBeforeMinutes?: number;
  preparationBeforeMinutes?: number;
  travelAfterMinutes?: number;
}): { effectiveBusyStartAt: Date; effectiveBusyEndAt: Date } {
  const travelBefore = params.travelBeforeMinutes ?? 0;
  const prep = params.preparationBeforeMinutes ?? 0;
  const travelAfter = params.travelAfterMinutes ?? 0;

  const start = new Date(params.scheduledStartAt);
  start.setMinutes(start.getMinutes() - travelBefore - prep);

  const end = new Date(params.scheduledEndAt);
  end.setMinutes(end.getMinutes() + travelAfter);

  return { effectiveBusyStartAt: start, effectiveBusyEndAt: end };
}

/** İki konum arası varsayılan yol (dakika). */
export function defaultTravelMinutesBetween(params: {
  sameLocation: boolean;
  sameDistrict: boolean;
  defaultTravelMinutes: number;
}): number {
  if (params.sameLocation) {
    return 0;
  }
  if (params.sameDistrict) {
    return Math.min(30, params.defaultTravelMinutes);
  }
  return params.defaultTravelMinutes;
}
