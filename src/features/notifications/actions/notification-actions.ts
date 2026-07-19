"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/services/notifications.service";

export type NotificationActionResult =
  | { success: true }
  | { success: false; error: string };

async function requireCurrentUserId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    throw new Error("Oturum bulunamadı.");
  }
  return data.user.id;
}

const markReadSchema = z.object({ notificationId: z.string().uuid() });

export async function markNotificationReadAction(
  input: unknown
): Promise<NotificationActionResult> {
  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Geçersiz girdi." };
  }
  try {
    await requireCurrentUserId();
    const admin = createAdminClient();
    await markNotificationRead(admin, parsed.data.notificationId);
    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "İşlem başarısız.";
    return { success: false, error: message };
  }
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionResult> {
  try {
    await requireCurrentUserId();
    const admin = createAdminClient();
    await markAllNotificationsRead(admin);
    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "İşlem başarısız.";
    return { success: false, error: message };
  }
}
