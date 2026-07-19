import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;

const ADMIN_OFFSETS_DAYS = [7, 3, 1, 0] as const;

export async function ensureReminderJobsForReservation(
  supabase: TypedSupabaseClient,
  reservation: {
    id: string;
    event_date: string | null;
    status: string;
    time_status: string;
    location_status: string;
    needs_time_followup: boolean;
    needs_location_followup: boolean;
  }
) {
  if (!reservation.event_date) return;
  if (!["confirmed", "deposit_pending", "payment_review"].includes(reservation.status)) {
    return;
  }

  const eventDate = new Date(`${reservation.event_date}T09:00:00+03:00`);

  for (const days of ADMIN_OFFSETS_DAYS) {
    const scheduled = new Date(eventDate);
    scheduled.setDate(scheduled.getDate() - days);
    if (scheduled.getTime() < Date.now() - 86400000) continue;

    const reminderType =
      days === 0 ? "shoot_day_morning" : `admin_${days}d`;

    await supabase.from("reminder_jobs").upsert(
      {
        reservation_id: reservation.id,
        reminder_type: reminderType,
        scheduled_at: scheduled.toISOString(),
        status: "pending",
        channel: "admin",
        payload: {
          eventDate: reservation.event_date,
          daysBefore: days,
        } as Json,
      },
      { onConflict: "reservation_id,reminder_type,scheduled_at" }
    );
  }

  if (reservation.needs_time_followup || reservation.time_status === "unknown") {
    const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString();
    await supabase.from("reminder_jobs").upsert(
      {
        reservation_id: reservation.id,
        reminder_type: "missing_time",
        scheduled_at: sevenDays,
        status: "pending",
        channel: "both",
        payload: { field: "time" } as Json,
      },
      { onConflict: "reservation_id,reminder_type,scheduled_at" }
    );
  }

  if (
    reservation.needs_location_followup ||
    reservation.location_status === "unknown"
  ) {
    const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString();
    await supabase.from("reminder_jobs").upsert(
      {
        reservation_id: reservation.id,
        reminder_type: "missing_location",
        scheduled_at: sevenDays,
        status: "pending",
        channel: "both",
        payload: { field: "location" } as Json,
      },
      { onConflict: "reservation_id,reminder_type,scheduled_at" }
    );
  }
}

export async function listReminderJobs(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("reminder_jobs")
    .select("*")
    .order("scheduled_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function runDueReminders(supabase: TypedSupabaseClient) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("reminder_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .limit(100);
  if (error) throw error;

  let sent = 0;
  for (const job of data ?? []) {
    await supabase
      .from("reminder_jobs")
      .update({ status: "sent", sent_at: now })
      .eq("id", job.id);
    sent += 1;
  }
  return { sent, total: data?.length ?? 0 };
}
