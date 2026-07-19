import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { StaffRoleSlug, UnavailabilityType } from "@/features/team/types";

type TypedSupabaseClient = SupabaseClient<Database>;

type StaffRoleRow = Database["public"]["Tables"]["staff_roles"]["Row"];
type StaffMemberRow = Database["public"]["Tables"]["staff_members"]["Row"];
type StaffMemberRoleRow =
  Database["public"]["Tables"]["staff_member_roles"]["Row"];
type AssignmentRow =
  Database["public"]["Tables"]["reservation_staff_assignments"]["Row"];
type ReservationRow = Database["public"]["Tables"]["reservations"]["Row"];

export type StaffMemberWithRoles = StaffMemberRow & {
  staff_member_roles: Array<
    StaffMemberRoleRow & {
      staff_roles: Pick<StaffRoleRow, "id" | "name" | "slug"> | null;
    }
  >;
};

export type AssignmentWithStaff = AssignmentRow & {
  staff_members: Pick<
    StaffMemberRow,
    "id" | "full_name" | "phone" | "active"
  > | null;
};

export type AssignmentWithReservation = AssignmentRow & {
  reservations: Pick<
    ReservationRow,
    | "id"
    | "customer_full_name"
    | "customer_phone"
    | "event_date"
    | "start_time"
    | "end_time"
    | "venue_name"
    | "status"
    | "effective_busy_start_at"
    | "effective_busy_end_at"
  > | null;
};

export type CalendarAssignment = AssignmentRow & {
  staff_members: Pick<StaffMemberRow, "id" | "full_name"> | null;
  reservations: Pick<
    ReservationRow,
    | "id"
    | "customer_full_name"
    | "customer_phone"
    | "event_date"
    | "start_time"
    | "end_time"
    | "venue_name"
    | "status"
    | "effective_busy_start_at"
    | "effective_busy_end_at"
  > | null;
};

export type ActiveAssignmentInRange = AssignmentRow & {
  reservations: Pick<
    ReservationRow,
    | "id"
    | "customer_full_name"
    | "venue_name"
    | "event_date"
    | "status"
    | "effective_busy_start_at"
    | "effective_busy_end_at"
    | "start_time"
    | "end_time"
  >;
};

function asRows<T>(data: unknown): T[] {
  return (data ?? []) as T[];
}

function asRow<T>(data: unknown): T {
  return data as T;
}

export async function listStaffRoles(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("staff_roles")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listStaffMembers(
  supabase: TypedSupabaseClient
): Promise<StaffMemberWithRoles[]> {
  const { data, error } = await supabase
    .from("staff_members")
    .select(
      `
      *,
      staff_member_roles (
        id,
        is_primary,
        staff_role_id,
        staff_roles ( id, name, slug )
      )
    `
    )
    .order("full_name", { ascending: true });
  if (error) throw error;
  return asRows<StaffMemberWithRoles>(data);
}

export async function getStaffMemberById(
  supabase: TypedSupabaseClient,
  id: string
): Promise<StaffMemberWithRoles | null> {
  const { data, error } = await supabase
    .from("staff_members")
    .select(
      `
      *,
      staff_member_roles (
        id,
        is_primary,
        staff_role_id,
        staff_roles ( id, name, slug )
      )
    `
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? asRow<StaffMemberWithRoles>(data) : null;
}

export async function insertStaffMember(
  supabase: TypedSupabaseClient,
  input: {
    full_name: string;
    phone?: string | null;
    email?: string | null;
    profile_photo_url?: string | null;
    active?: boolean;
    notes?: string | null;
    default_start_time?: string | null;
    default_end_time?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("staff_members")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateStaffMember(
  supabase: TypedSupabaseClient,
  id: string,
  input: Partial<{
    full_name: string;
    phone: string | null;
    email: string | null;
    profile_photo_url: string | null;
    active: boolean;
    notes: string | null;
    default_start_time: string | null;
    default_end_time: string | null;
  }>
) {
  const { data, error } = await supabase
    .from("staff_members")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function replaceStaffMemberRoles(
  supabase: TypedSupabaseClient,
  staffMemberId: string,
  roleIds: string[],
  primaryRoleId?: string | null
) {
  const { error: delError } = await supabase
    .from("staff_member_roles")
    .delete()
    .eq("staff_member_id", staffMemberId);
  if (delError) throw delError;

  if (roleIds.length === 0) return [];

  const rows = roleIds.map((roleId) => ({
    staff_member_id: staffMemberId,
    staff_role_id: roleId,
    is_primary: primaryRoleId ? roleId === primaryRoleId : false,
  }));

  const { data, error } = await supabase
    .from("staff_member_roles")
    .insert(rows)
    .select("*");
  if (error) throw error;
  return data ?? [];
}

export async function listUnavailabilityForStaff(
  supabase: TypedSupabaseClient,
  staffMemberId: string
) {
  const { data, error } = await supabase
    .from("staff_unavailability")
    .select("*")
    .eq("staff_member_id", staffMemberId)
    .order("start_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listUnavailabilityInRange(
  supabase: TypedSupabaseClient,
  startAt: string,
  endAt: string
) {
  const { data, error } = await supabase
    .from("staff_unavailability")
    .select("*")
    .lt("start_at", endAt)
    .gt("end_at", startAt);
  if (error) throw error;
  return data ?? [];
}

export async function insertUnavailability(
  supabase: TypedSupabaseClient,
  input: {
    staff_member_id: string;
    start_at: string;
    end_at: string;
    reason?: string | null;
    type: UnavailabilityType;
  }
) {
  const { data, error } = await supabase
    .from("staff_unavailability")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listAssignmentsForReservation(
  supabase: TypedSupabaseClient,
  reservationId: string
): Promise<AssignmentWithStaff[]> {
  const { data, error } = await supabase
    .from("reservation_staff_assignments")
    .select(
      `
      *,
      staff_members ( id, full_name, phone, active )
    `
    )
    .eq("reservation_id", reservationId)
    .neq("assignment_status", "cancelled");
  if (error) throw error;
  return asRows<AssignmentWithStaff>(data);
}

export async function listActiveAssignmentsInRange(
  supabase: TypedSupabaseClient,
  startAt: string,
  endAt: string
): Promise<ActiveAssignmentInRange[]> {
  const { data, error } = await supabase
    .from("reservation_staff_assignments")
    .select(
      `
      id,
      reservation_id,
      reservation_item_id,
      staff_member_id,
      assigned_role,
      assignment_status,
      assigned_by,
      notes,
      override_conflict,
      override_reason,
      created_at,
      updated_at,
      reservations!inner (
        id,
        customer_full_name,
        venue_name,
        event_date,
        status,
        effective_busy_start_at,
        effective_busy_end_at,
        start_time,
        end_time
      )
    `
    )
    .in("assignment_status", ["proposed", "assigned", "accepted", "completed"])
    .neq("reservations.status", "cancelled");
  if (error) throw error;

  return asRows<ActiveAssignmentInRange>(data).filter((row) => {
    const res = row.reservations;
    const bStart =
      res.effective_busy_start_at ??
      (res.event_date ? `${res.event_date}T00:00:00+03:00` : null);
    const bEnd =
      res.effective_busy_end_at ??
      (res.event_date ? `${res.event_date}T23:59:59+03:00` : null);
    if (!bStart || !bEnd) return false;
    return bStart < endAt && startAt < bEnd;
  });
}

export async function listAssignmentsForStaff(
  supabase: TypedSupabaseClient,
  staffMemberId: string
): Promise<AssignmentWithReservation[]> {
  const { data, error } = await supabase
    .from("reservation_staff_assignments")
    .select(
      `
      *,
      reservations (
        id,
        customer_full_name,
        customer_phone,
        event_date,
        start_time,
        end_time,
        venue_name,
        status,
        effective_busy_start_at,
        effective_busy_end_at
      )
    `
    )
    .eq("staff_member_id", staffMemberId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return asRows<AssignmentWithReservation>(data);
}

export async function insertStaffAssignment(
  supabase: TypedSupabaseClient,
  input: {
    reservation_id: string;
    reservation_item_id?: string | null;
    staff_member_id: string;
    assigned_role: string;
    assignment_status?: AssignmentRow["assignment_status"];
    assigned_by?: string | null;
    notes?: string | null;
    override_conflict?: boolean;
    override_reason?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("reservation_staff_assignments")
    .insert({
      reservation_id: input.reservation_id,
      reservation_item_id: input.reservation_item_id ?? null,
      staff_member_id: input.staff_member_id,
      assigned_role: input.assigned_role,
      assignment_status: input.assignment_status ?? "assigned",
      assigned_by: input.assigned_by ?? null,
      notes: input.notes ?? null,
      override_conflict: input.override_conflict ?? false,
      override_reason: input.override_reason ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function cancelStaffAssignment(
  supabase: TypedSupabaseClient,
  id: string
) {
  const { data, error } = await supabase
    .from("reservation_staff_assignments")
    .update({ assignment_status: "cancelled" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function insertPanelNotification(
  supabase: TypedSupabaseClient,
  input: {
    type: string;
    title: string;
    body?: string | null;
    payload?: Json;
    staff_member_id?: string | null;
    reservation_id?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("panel_notifications")
    .insert({
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      payload: input.payload ?? {},
      staff_member_id: input.staff_member_id ?? null,
      reservation_id: input.reservation_id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function insertStaffAuditLog(
  supabase: TypedSupabaseClient,
  input: {
    actor_id?: string | null;
    action: string;
    entity_type: string;
    entity_id?: string | null;
    before_data?: Json;
    after_data?: Json;
    reason?: string | null;
  }
) {
  const { error } = await supabase.from("staff_audit_logs").insert({
    actor_id: input.actor_id ?? null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    before_data: input.before_data ?? null,
    after_data: input.after_data ?? null,
    reason: input.reason ?? null,
  });
  if (error) throw error;
}

export async function listStaffCalendarAssignments(
  supabase: TypedSupabaseClient,
  params: { fromDate: string; toDate: string; staffMemberId?: string }
): Promise<CalendarAssignment[]> {
  let query = supabase
    .from("reservation_staff_assignments")
    .select(
      `
      *,
      staff_members ( id, full_name ),
      reservations!inner (
        id,
        customer_full_name,
        customer_phone,
        event_date,
        start_time,
        end_time,
        venue_name,
        status,
        effective_busy_start_at,
        effective_busy_end_at
      )
    `
    )
    .in("assignment_status", ["proposed", "assigned", "accepted", "completed"])
    .gte("reservations.event_date", params.fromDate)
    .lte("reservations.event_date", params.toDate);

  if (params.staffMemberId) {
    query = query.eq("staff_member_id", params.staffMemberId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return asRows<CalendarAssignment>(data);
}

export function mapMemberRoleSlugs(
  member: StaffMemberWithRoles
): StaffRoleSlug[] {
  const roles = member.staff_member_roles ?? [];
  return roles
    .map((r) => {
      const role = r.staff_roles;
      return role?.slug as StaffRoleSlug | undefined;
    })
    .filter((s): s is StaffRoleSlug => Boolean(s));
}
