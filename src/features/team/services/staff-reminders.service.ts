import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { getReservationById } from "@/features/reservations/repositories/reservations.repository";

type TypedSupabaseClient = SupabaseClient<Database>;

const STAFF_OFFSETS_DAYS = [7, 3, 1, 0] as const;

/**
 * Personel ataması sonrası 7/3/1/0 gün hatırlatmaları oluşturur.
 * Kanal şu an admin/panel; ileride personel paneline taşınabilir.
 */
export async function ensureStaffReminderJobs(
  supabase: TypedSupabaseClient,
  params: {
    reservationId: string;
    staffMemberId: string;
    assignmentId: string;
  }
) {
  const reservation = await getReservationById(supabase, params.reservationId);
  if (!reservation?.event_date) return;

  const eventDate = new Date(`${reservation.event_date}T09:00:00+03:00`);
  const payload: Json = {
    staffMemberId: params.staffMemberId,
    assignmentId: params.assignmentId,
    customer: reservation.customer_full_name,
    phone: reservation.customer_phone,
    venue: reservation.venue_name,
    startTime: reservation.start_time,
    notes: reservation.internal_notes,
    arrivalHint: reservation.effective_busy_start_at,
  };

  for (const days of STAFF_OFFSETS_DAYS) {
    const scheduled = new Date(eventDate);
    scheduled.setDate(scheduled.getDate() - days);
    if (scheduled.getTime() < Date.now() - 86400000) continue;

    const reminderType =
      days === 0 ? `staff_shoot_day:${params.staffMemberId}` : `staff_${days}d:${params.staffMemberId}`;

    await supabase.from("reminder_jobs").upsert(
      {
        reservation_id: params.reservationId,
        staff_member_id: params.staffMemberId,
        reminder_type: reminderType,
        scheduled_at: scheduled.toISOString(),
        status: "pending",
        channel: "admin",
        payload,
      },
      { onConflict: "reservation_id,reminder_type,scheduled_at" }
    );
  }
}
