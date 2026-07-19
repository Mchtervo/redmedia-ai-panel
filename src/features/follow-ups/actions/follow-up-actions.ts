"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/server/supabase/admin";
import { sendFollowUpViaMeta } from "@/features/follow-ups/services/follow-ups.service";

export type FollowUpActionResult =
  | { success: true }
  | { success: false; error: string };

const idSchema = z.string().uuid();

/**
 * Personel mesajı manuel gönderdikten sonra paneli "sent" işaretler.
 * (Meta IGSID yoksa / pencere dışındaysa fallback)
 */
export async function markFollowUpSentAction(
  taskId: string
): Promise<FollowUpActionResult> {
  const parsed = idSchema.safeParse(taskId);
  if (!parsed.success) {
    return { success: false, error: "Geçersiz görev." };
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("follow_up_tasks")
      .update({
        status: "sent",
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", parsed.data)
      .in("status", ["queued", "pending"]);

    if (error) throw error;
    revalidatePath("/dashboard/follow-ups");
    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Güncellenemedi.",
    };
  }
}

/** Meta Instagram Messaging API ile follow-up DM gönder. */
export async function sendFollowUpViaMetaAction(
  taskId: string
): Promise<FollowUpActionResult> {
  const parsed = idSchema.safeParse(taskId);
  if (!parsed.success) {
    return { success: false, error: "Geçersiz görev." };
  }

  try {
    const supabase = createAdminClient();
    const result = await sendFollowUpViaMeta(supabase, parsed.data);
    revalidatePath("/dashboard/follow-ups");
    revalidatePath("/dashboard/notifications");
    if (!result.ok) {
      return { success: false, error: result.message };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gönderilemedi.",
    };
  }
}

export async function skipFollowUpAction(
  taskId: string
): Promise<FollowUpActionResult> {
  const parsed = idSchema.safeParse(taskId);
  if (!parsed.success) {
    return { success: false, error: "Geçersiz görev." };
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("follow_up_tasks")
      .update({
        status: "skipped",
        cancelled_reason: "manual_skip",
      })
      .eq("id", parsed.data)
      .in("status", ["queued", "pending"]);

    if (error) throw error;
    revalidatePath("/dashboard/follow-ups");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Güncellenemedi.",
    };
  }
}
