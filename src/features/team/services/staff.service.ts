import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getReservationSettings } from "@/features/pricing/services/quote-from-db.service";
import { resolveRequiredRoles } from "@/features/team/services/role-resolution.service";
import {
  countAvailableForRole,
  evaluateStaffCandidate,
  rankStaffSuggestions,
  type StaffBusyBlock,
  type StaffLeaveBlock,
} from "@/features/team/services/staff-availability.service";
import {
  cancelStaffAssignment,
  getStaffMemberById,
  insertPanelNotification,
  insertStaffAssignment,
  insertStaffAuditLog,
  insertStaffMember,
  insertUnavailability,
  listActiveAssignmentsInRange,
  listAssignmentsForStaff,
  listStaffMembers,
  listStaffRoles,
  listUnavailabilityForStaff,
  listUnavailabilityInRange,
  mapMemberRoleSlugs,
  replaceStaffMemberRoles,
  updateStaffMember,
} from "@/features/team/repositories/staff.repository";
import type {
  RequiredRoleSlot,
  StaffCandidate,
  StaffRoleSlug,
  UnavailabilityType,
} from "@/features/team/types";
import { ensureStaffReminderJobs } from "@/features/team/services/staff-reminders.service";

type TypedSupabaseClient = SupabaseClient<Database>;

export async function createStaffMemberWithRoles(
  supabase: TypedSupabaseClient,
  input: {
    fullName: string;
    phone?: string | null;
    email?: string | null;
    profilePhotoUrl?: string | null;
    active?: boolean;
    notes?: string | null;
    defaultStartTime?: string | null;
    defaultEndTime?: string | null;
    roleIds: string[];
    primaryRoleId?: string | null;
    actorId?: string | null;
  }
) {
  const member = await insertStaffMember(supabase, {
    full_name: input.fullName,
    phone: input.phone ?? null,
    email: input.email ?? null,
    profile_photo_url: input.profilePhotoUrl ?? null,
    active: input.active ?? true,
    notes: input.notes ?? null,
    default_start_time: input.defaultStartTime ?? null,
    default_end_time: input.defaultEndTime ?? null,
  });

  await replaceStaffMemberRoles(
    supabase,
    member.id,
    input.roleIds,
    input.primaryRoleId
  );

  await insertStaffAuditLog(supabase, {
    actor_id: input.actorId,
    action: "staff.create",
    entity_type: "staff_member",
    entity_id: member.id,
    after_data: { full_name: member.full_name, roleIds: input.roleIds },
  });

  return getStaffMemberById(supabase, member.id);
}

export async function updateStaffMemberWithRoles(
  supabase: TypedSupabaseClient,
  id: string,
  input: {
    fullName?: string;
    phone?: string | null;
    email?: string | null;
    profilePhotoUrl?: string | null;
    active?: boolean;
    notes?: string | null;
    defaultStartTime?: string | null;
    defaultEndTime?: string | null;
    roleIds?: string[];
    primaryRoleId?: string | null;
    actorId?: string | null;
  }
) {
  const before = await getStaffMemberById(supabase, id);
  const updated = await updateStaffMember(supabase, id, {
    full_name: input.fullName,
    phone: input.phone,
    email: input.email,
    profile_photo_url: input.profilePhotoUrl,
    active: input.active,
    notes: input.notes,
    default_start_time: input.defaultStartTime,
    default_end_time: input.defaultEndTime,
  });

  if (input.roleIds) {
    await replaceStaffMemberRoles(
      supabase,
      id,
      input.roleIds,
      input.primaryRoleId
    );
  }

  await insertStaffAuditLog(supabase, {
    actor_id: input.actorId,
    action: "staff.update",
    entity_type: "staff_member",
    entity_id: id,
    before_data: before
      ? { full_name: before.full_name, active: before.active }
      : null,
    after_data: { full_name: updated.full_name, active: updated.active },
  });

  return getStaffMemberById(supabase, id);
}

export async function setStaffActive(
  supabase: TypedSupabaseClient,
  id: string,
  active: boolean,
  actorId?: string | null
) {
  const updated = await updateStaffMember(supabase, id, { active });
  await insertStaffAuditLog(supabase, {
    actor_id: actorId,
    action: active ? "staff.activate" : "staff.deactivate",
    entity_type: "staff_member",
    entity_id: id,
    after_data: { active },
  });
  return updated;
}

export async function addStaffUnavailability(
  supabase: TypedSupabaseClient,
  input: {
    staffMemberId: string;
    startAt: string;
    endAt: string;
    reason?: string | null;
    type: UnavailabilityType;
    actorId?: string | null;
  }
) {
  if (new Date(input.endAt) <= new Date(input.startAt)) {
    throw new Error("Bitiş zamanı başlangıçtan sonra olmalıdır.");
  }
  const row = await insertUnavailability(supabase, {
    staff_member_id: input.staffMemberId,
    start_at: input.startAt,
    end_at: input.endAt,
    reason: input.reason ?? null,
    type: input.type,
  });
  await insertStaffAuditLog(supabase, {
    actor_id: input.actorId,
    action: "staff.unavailability.create",
    entity_type: "staff_unavailability",
    entity_id: row.id,
    after_data: {
      staff_member_id: row.staff_member_id,
      type: row.type,
      start_at: row.start_at,
      end_at: row.end_at,
    },
  });
  return row;
}

export async function resolveRolesForServiceIds(
  supabase: TypedSupabaseClient,
  serviceIds: string[]
): Promise<RequiredRoleSlot[]> {
  if (serviceIds.length === 0) return [];

  const { data: services, error } = await supabase
    .from("services")
    .select(
      "id, slug, service_type, required_role_slug, category_id, service_categories(slug)"
    )
    .in("id", serviceIds);
  if (error) throw error;

  type ServiceJoin = {
    id: string;
    slug: string;
    service_type: string;
    required_role_slug: string | null;
    service_categories: { slug: string } | { slug: string }[] | null;
  };

  const withCategory = ((services ?? []) as unknown as ServiceJoin[]).map(
    (s) => {
      const cat = s.service_categories;
      const categorySlug = Array.isArray(cat)
        ? cat[0]?.slug ?? "unknown"
        : cat?.slug ?? "unknown";
      return {
        id: s.id,
        slug: s.slug,
        service_type: s.service_type,
        category_slug: categorySlug,
        required_role_slug: s.required_role_slug ?? null,
      };
    }
  );
  return resolveRequiredRoles(withCategory);
}

export async function suggestStaffForRole(
  supabase: TypedSupabaseClient,
  params: {
    requiredRole: StaffRoleSlug;
    candidateStartAt: string;
    candidateEndAt: string;
    excludeReservationId?: string;
  }
): Promise<{
  candidates: StaffCandidate[];
  availableCount: number;
  suggestedStaffIds: string[];
}> {
  const settings = await getReservationSettings(supabase);
  const travelBuffer = Number(settings?.default_travel_minutes ?? 60);

  const members = await listStaffMembers(supabase);
  const leave = await listUnavailabilityInRange(
    supabase,
    params.candidateStartAt,
    params.candidateEndAt
  );
  const assignments = await listActiveAssignmentsInRange(
    supabase,
    params.candidateStartAt,
    params.candidateEndAt
  );

  const busyBlocks: StaffBusyBlock[] = assignments
    .filter((a) => {
      if (!params.excludeReservationId) return true;
      return a.reservation_id !== params.excludeReservationId;
    })
    .map((a) => {
      const res = a.reservations as {
        id: string;
        customer_full_name: string | null;
        venue_name: string | null;
        effective_busy_start_at: string | null;
        effective_busy_end_at: string | null;
        event_date: string | null;
      };
      return {
        staffMemberId: a.staff_member_id,
        reservationId: res.id,
        startAt:
          res.effective_busy_start_at ??
          `${res.event_date}T09:00:00+03:00`,
        endAt:
          res.effective_busy_end_at ?? `${res.event_date}T18:00:00+03:00`,
        customerName: res.customer_full_name,
        venue: res.venue_name,
        role: a.assigned_role,
      };
    });

  const leaveBlocks: StaffLeaveBlock[] = leave.map((l) => ({
    staffMemberId: l.staff_member_id,
    startAt: l.start_at,
    endAt: l.end_at,
    type: l.type,
  }));

  const candidates = members.map((m) =>
    evaluateStaffCandidate({
      member: {
        id: m.id,
        fullName: m.full_name,
        active: m.active,
        roleSlugs: mapMemberRoleSlugs(m),
      },
      requiredRole: params.requiredRole,
      candidateStartAt: params.candidateStartAt,
      candidateEndAt: params.candidateEndAt,
      busyBlocks,
      leaveBlocks,
      defaultTravelBufferMinutes: travelBuffer,
    })
  );

  const ranked = rankStaffSuggestions(candidates);
  const availableCount = countAvailableForRole(ranked);
  const suggestedStaffIds = ranked
    .filter((c) => c.status === "available")
    .slice(0, 3)
    .map((c) => c.staffMemberId);

  return { candidates: ranked, availableCount, suggestedStaffIds };
}

export async function checkStaffCapacityForServices(
  supabase: TypedSupabaseClient,
  params: {
    serviceIds: string[];
    candidateStartAt: string;
    candidateEndAt: string;
    excludeReservationId?: string;
  }
): Promise<{
  roles: RequiredRoleSlot[];
  allSatisfied: boolean;
  lines: string[];
  suggestedStaffIds: string[];
}> {
  const roles = await resolveRolesForServiceIds(supabase, params.serviceIds);
  const lines: string[] = [];
  const suggestedStaffIds: string[] = [];
  let allSatisfied = true;

  for (const slot of roles) {
    const result = await suggestStaffForRole(supabase, {
      requiredRole: slot.roleSlug,
      candidateStartAt: params.candidateStartAt,
      candidateEndAt: params.candidateEndAt,
      excludeReservationId: params.excludeReservationId,
    });
    const enough = result.availableCount >= slot.quantity;
    if (!enough) allSatisfied = false;
    lines.push(
      `${slot.roleLabel}: ${result.availableCount}/${slot.quantity} müsait${enough ? "" : " (yetersiz)"}`
    );
    suggestedStaffIds.push(...result.suggestedStaffIds);
  }

  return {
    roles,
    allSatisfied,
    lines,
    suggestedStaffIds: [...new Set(suggestedStaffIds)],
  };
}

export async function assignStaffToReservation(
  supabase: TypedSupabaseClient,
  input: {
    reservationId: string;
    reservationItemId?: string | null;
    staffMemberId: string;
    assignedRole: StaffRoleSlug;
    candidateStartAt: string;
    candidateEndAt: string;
    overrideConflict?: boolean;
    overrideReason?: string | null;
    notes?: string | null;
    actorId?: string | null;
  }
) {
  const suggestion = await suggestStaffForRole(supabase, {
    requiredRole: input.assignedRole,
    candidateStartAt: input.candidateStartAt,
    candidateEndAt: input.candidateEndAt,
    excludeReservationId: input.reservationId,
  });

  const candidate = suggestion.candidates.find(
    (c) => c.staffMemberId === input.staffMemberId
  );

  if (!candidate) {
    throw new Error("Personel bulunamadı.");
  }

  if (candidate.status !== "available") {
    if (!input.overrideConflict) {
      throw new Error(
        `Personel uygun değil: ${candidate.statusLabel}. Devam için gerekçeli override gerekir.`
      );
    }
    if (!input.overrideReason?.trim()) {
      throw new Error("Override için gerekçe zorunludur.");
    }
  }

  const assignment = await insertStaffAssignment(supabase, {
    reservation_id: input.reservationId,
    reservation_item_id: input.reservationItemId,
    staff_member_id: input.staffMemberId,
    assigned_role: input.assignedRole,
    assignment_status: "assigned",
    assigned_by: input.actorId,
    notes: input.notes,
    override_conflict: Boolean(input.overrideConflict),
    override_reason: input.overrideReason ?? null,
  });

  await insertPanelNotification(supabase, {
    type: "staff_assigned",
    title: "Personel atandı",
    body: `${candidate.fullName} → ${input.assignedRole}`,
    staff_member_id: input.staffMemberId,
    reservation_id: input.reservationId,
    payload: {
      assignmentId: assignment.id,
      role: input.assignedRole,
      override: Boolean(input.overrideConflict),
    },
  });

  await insertStaffAuditLog(supabase, {
    actor_id: input.actorId,
    action: "staff.assign",
    entity_type: "reservation_staff_assignment",
    entity_id: assignment.id,
    after_data: {
      reservation_id: input.reservationId,
      staff_member_id: input.staffMemberId,
      role: input.assignedRole,
      override: Boolean(input.overrideConflict),
    },
    reason: input.overrideReason ?? null,
  });

  await ensureStaffReminderJobs(supabase, {
    reservationId: input.reservationId,
    staffMemberId: input.staffMemberId,
    assignmentId: assignment.id,
  });

  return assignment;
}

export async function removeStaffAssignment(
  supabase: TypedSupabaseClient,
  assignmentId: string,
  actorId?: string | null
) {
  const row = await cancelStaffAssignment(supabase, assignmentId);
  await insertStaffAuditLog(supabase, {
    actor_id: actorId,
    action: "staff.unassign",
    entity_type: "reservation_staff_assignment",
    entity_id: assignmentId,
    after_data: { status: "cancelled" },
  });
  return row;
}

export async function getStaffDetailBundle(
  supabase: TypedSupabaseClient,
  id: string
) {
  const member = await getStaffMemberById(supabase, id);
  if (!member) return null;
  const [roles, unavailability, assignments] = await Promise.all([
    listStaffRoles(supabase),
    listUnavailabilityForStaff(supabase, id),
    listAssignmentsForStaff(supabase, id),
  ]);
  return { member, roles, unavailability, assignments };
}

export { listStaffMembers, listStaffRoles, mapMemberRoleSlugs };
