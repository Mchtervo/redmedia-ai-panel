import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;

export type PanelNotificationRow =
  Database["public"]["Tables"]["panel_notifications"]["Row"];

export type CreatePanelNotificationParams = {
  type: string;
  title: string;
  body?: string | null;
  payload?: Json;
  staffMemberId?: string | null;
  reservationId?: string | null;
};

/**
 * Notification Engine (docs/15): panel içi bildirim oluşturur.
 * Bildirim hatası çağıran akışı bozmamalıdır; hata durumunda null döner.
 */
export async function createPanelNotification(
  supabase: TypedSupabaseClient,
  params: CreatePanelNotificationParams
): Promise<PanelNotificationRow | null> {
  const { data, error } = await supabase
    .from("panel_notifications")
    .insert({
      type: params.type,
      title: params.title.trim().slice(0, 200),
      body: params.body?.trim().slice(0, 500) ?? null,
      payload: params.payload ?? {},
      staff_member_id: params.staffMemberId ?? null,
      reservation_id: params.reservationId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[notifications] bildirim oluşturulamadı:", error.message);
    return null;
  }
  return data;
}

/** Bildirim listesi (en yeni önce). */
export async function listPanelNotifications(
  supabase: TypedSupabaseClient,
  options?: { unreadOnly?: boolean; limit?: number }
): Promise<PanelNotificationRow[]> {
  let query = supabase
    .from("panel_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function countUnreadNotifications(
  supabase: TypedSupabaseClient
): Promise<number> {
  const { count, error } = await supabase
    .from("panel_notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

/** Tek bildirimi okundu işaretler. */
export async function markNotificationRead(
  supabase: TypedSupabaseClient,
  notificationId: string
): Promise<void> {
  const { error } = await supabase
    .from("panel_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null);
  if (error) throw error;
}

/** Tüm bildirimleri okundu işaretler. */
export async function markAllNotificationsRead(
  supabase: TypedSupabaseClient
): Promise<void> {
  const { error } = await supabase
    .from("panel_notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}
