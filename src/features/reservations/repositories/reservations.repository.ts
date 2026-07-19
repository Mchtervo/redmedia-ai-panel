import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;
type ReservationRow = Database["public"]["Tables"]["reservations"]["Row"];
type ReservationInsert = Database["public"]["Tables"]["reservations"]["Insert"];
type ReservationUpdate = Database["public"]["Tables"]["reservations"]["Update"];

export async function listReservations(
  supabase: TypedSupabaseClient,
  filters?: {
    status?: ReservationRow["status"];
    fromDate?: string;
    toDate?: string;
    depositStatus?: ReservationRow["deposit_status"];
    source?: ReservationRow["source"];
  }
) {
  let query = supabase
    .from("reservations")
    .select("*")
    .order("event_date", { ascending: true, nullsFirst: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.depositStatus)
    query = query.eq("deposit_status", filters.depositStatus);
  if (filters?.source) query = query.eq("source", filters.source);
  if (filters?.fromDate) query = query.gte("event_date", filters.fromDate);
  if (filters?.toDate) query = query.lte("event_date", filters.toDate);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getReservationById(
  supabase: TypedSupabaseClient,
  id: string
) {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listReservationItems(
  supabase: TypedSupabaseClient,
  reservationId: string
) {
  const { data, error } = await supabase
    .from("reservation_items")
    .select("*")
    .eq("reservation_id", reservationId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertReservation(
  supabase: TypedSupabaseClient,
  payload: ReservationInsert
): Promise<ReservationRow> {
  const { data, error } = await supabase
    .from("reservations")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateReservation(
  supabase: TypedSupabaseClient,
  id: string,
  payload: ReservationUpdate
): Promise<ReservationRow> {
  const { data, error } = await supabase
    .from("reservations")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function replaceReservationItems(
  supabase: TypedSupabaseClient,
  reservationId: string,
  items: Database["public"]["Tables"]["reservation_items"]["Insert"][]
) {
  const { error: delError } = await supabase
    .from("reservation_items")
    .delete()
    .eq("reservation_id", reservationId);
  if (delError) throw delError;

  if (items.length === 0) return [];

  const { data, error } = await supabase
    .from("reservation_items")
    .insert(items)
    .select("*");
  if (error) throw error;
  return data ?? [];
}

export async function insertReservationChange(
  supabase: TypedSupabaseClient,
  params: {
    reservationId: string;
    changedByType: "staff" | "ai" | "system" | "customer";
    changedById?: string | null;
    fieldName: string;
    oldValue?: Json;
    newValue?: Json;
    reason?: string;
    requiresAdminApproval?: boolean;
    approvalStatus?: "pending" | "approved" | "rejected" | "applied";
  }
) {
  const { data, error } = await supabase
    .from("reservation_changes")
    .insert({
      reservation_id: params.reservationId,
      changed_by_type: params.changedByType,
      changed_by_id: params.changedById ?? null,
      field_name: params.fieldName,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
      reason: params.reason ?? null,
      requires_admin_approval: params.requiresAdminApproval ?? false,
      approval_status: params.approvalStatus ?? "applied",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listReservationChanges(
  supabase: TypedSupabaseClient,
  reservationId: string
) {
  const { data, error } = await supabase
    .from("reservation_changes")
    .select("*")
    .eq("reservation_id", reservationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listBusyReservationsForDate(
  supabase: TypedSupabaseClient,
  eventDate: string
) {
  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, status, selected_plato_id, assigned_team_id, effective_busy_start_at, effective_busy_end_at, time_status, event_date"
    )
    .eq("event_date", eventDate)
    .not("status", "in", '("cancelled","lost")');
  if (error) throw error;
  return data ?? [];
}

export async function findDraftByConversation(
  supabase: TypedSupabaseClient,
  conversationId: string
) {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("conversation_id", conversationId)
    .in("status", [
      "draft",
      "inquiry",
      "availability_check",
      "pending_customer",
      "deposit_pending",
      "payment_review",
    ])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
