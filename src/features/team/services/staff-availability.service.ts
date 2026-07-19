import {
  STAFF_AVAILABILITY_LABELS,
  type StaffAvailabilityStatus,
  type StaffCandidate,
  type StaffRoleSlug,
} from "@/features/team/types";

export type StaffBusyBlock = {
  staffMemberId: string;
  reservationId: string;
  startAt: string;
  endAt: string;
  customerName?: string | null;
  venue?: string | null;
  role?: string | null;
};

export type StaffLeaveBlock = {
  staffMemberId: string;
  startAt: string;
  endAt: string;
  type: string;
};

export type StaffMemberForSuggest = {
  id: string;
  fullName: string;
  active: boolean;
  roleSlugs: StaffRoleSlug[];
};

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function summarizeBlock(block: StaffBusyBlock | undefined): string | null {
  if (!block) return null;
  const start = new Date(block.startAt);
  const time = start.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${block.customerName ?? "Görev"} · ${time}${block.venue ? ` · ${block.venue}` : ""}`;
}

/**
 * Personel uygunluk durumu: rol, aktiflik, izin, saat/yol çakışması.
 * Yol süresi zaten effective_busy pencerelerine gömülü kabul edilir;
 * ek travelRiskMinutes önceki görev bitişi ile aday başlangıcı arasındaki boşluktur.
 */
export function evaluateStaffCandidate(params: {
  member: StaffMemberForSuggest;
  requiredRole: StaffRoleSlug;
  candidateStartAt: string;
  candidateEndAt: string;
  busyBlocks: StaffBusyBlock[];
  leaveBlocks: StaffLeaveBlock[];
  defaultTravelBufferMinutes?: number;
}): StaffCandidate {
  const {
    member,
    requiredRole,
    candidateStartAt,
    candidateEndAt,
    busyBlocks,
    leaveBlocks,
    defaultTravelBufferMinutes = 60,
  } = params;

  const startMs = new Date(candidateStartAt).getTime();
  const endMs = new Date(candidateEndAt).getTime();
  const memberBusy = busyBlocks
    .filter((b) => b.staffMemberId === member.id)
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
  const memberLeave = leaveBlocks.filter((b) => b.staffMemberId === member.id);

  let status: StaffAvailabilityStatus = "available";

  if (!member.active) {
    status = "inactive";
  } else if (!member.roleSlugs.includes(requiredRole)) {
    status = "role_mismatch";
  } else if (
    memberLeave.some((l) =>
      overlaps(startMs, endMs, new Date(l.startAt).getTime(), new Date(l.endAt).getTime())
    )
  ) {
    status = "on_leave";
  } else {
    const conflicting = memberBusy.filter((b) =>
      overlaps(startMs, endMs, new Date(b.startAt).getTime(), new Date(b.endAt).getTime())
    );
    if (conflicting.length > 0) {
      status = "time_conflict";
      // Aynı gün başka konumda görev = busy_elsewhere (çakışma zaten var)
      if (conflicting.some((c) => c.venue)) {
        status = "busy_elsewhere";
      }
    } else {
      // Yol süresi: önceki görev bitişi ile yeni başlangıç arası < buffer
      const previous = [...memberBusy]
        .filter((b) => new Date(b.endAt).getTime() <= startMs)
        .pop();
      if (previous) {
        const gapMin =
          (startMs - new Date(previous.endAt).getTime()) / 60000;
        if (gapMin < defaultTravelBufferMinutes) {
          status = "travel_insufficient";
        }
      }
    }
  }

  const previous = [...memberBusy]
    .filter((b) => new Date(b.endAt).getTime() <= startMs)
    .pop();
  const next = memberBusy.find((b) => new Date(b.startAt).getTime() >= endMs);

  const sameDay = memberBusy.filter((b) => {
    const d = new Date(b.startAt).toISOString().slice(0, 10);
    const c = new Date(candidateStartAt).toISOString().slice(0, 10);
    return d === c;
  }).length;

  let travelRiskMinutes: number | null = null;
  if (previous) {
    travelRiskMinutes =
      (startMs - new Date(previous.endAt).getTime()) / 60000;
  }

  // Skor: yüksek = daha uygun (öneri sırası)
  let score = 0;
  if (status === "available") score += 1000;
  if (member.roleSlugs.includes(requiredRole)) score += 100;
  if (member.active) score += 50;
  score -= sameDay * 20;
  if (status === "travel_insufficient") score -= 200;
  if (status === "time_conflict" || status === "busy_elsewhere") score -= 500;
  if (status === "on_leave") score -= 800;
  if (status === "role_mismatch" || status === "inactive") score -= 2000;

  return {
    staffMemberId: member.id,
    fullName: member.fullName,
    roles: member.roleSlugs,
    status,
    statusLabel: STAFF_AVAILABILITY_LABELS[status],
    score,
    sameDayAssignmentCount: sameDay,
    previousAssignmentSummary: summarizeBlock(previous),
    nextAssignmentSummary: summarizeBlock(next),
    travelRiskMinutes,
  };
}

/**
 * Öneri listesi: skora göre sıralı. Kesin atama yapmaz.
 */
export function rankStaffSuggestions(
  candidates: StaffCandidate[]
): StaffCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.fullName.localeCompare(b.fullName, "tr");
  });
}

export function countAvailableForRole(
  candidates: StaffCandidate[]
): number {
  return candidates.filter((c) => c.status === "available").length;
}
