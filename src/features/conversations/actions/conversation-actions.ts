"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import {
  assignConversation,
  sendStaffMessage,
  updateConversationStatus,
} from "@/features/conversations/services/conversations.service";
import { sendStaffMessageSchema } from "@/features/conversations/validators/send-message";
import { CONVERSATION_STATUS_VALUES } from "@/features/conversations/types";

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

type CurrentUser = { id: string; email: string | null };

async function requireCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    throw new Error("Oturum bulunamadı.");
  }

  return { id: data.user.id, email: data.user.email ?? null };
}

async function requireCurrentUserId(): Promise<string> {
  const user = await requireCurrentUser();
  return user.id;
}

/**
 * `conversations.assigned_to` → `profiles.id` foreign key'i, atama yapılacak
 * kullanıcının `profiles` tablosunda bir satırı olmasını gerektirir.
 * Personel yönetimi (Team feature, `docs/ROADMAP.md` Aşama 2) henüz
 * kurulmadığı için, oturum açmış bir kullanıcının kendi profilini
 * "kendi kendine" oluşturması burada dar kapsamlı olarak sağlanır —
 * yalnızca atama akışında, yalnızca eksikse (bkz. kullanıcı onayı).
 */
async function ensureOwnProfileExists(
  supabase: ReturnType<typeof createAdminClient>,
  user: CurrentUser
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email }, { onConflict: "id", ignoreDuplicates: true });

  if (error) {
    throw error;
  }
}

function revalidateInbox(conversationId: string) {
  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${conversationId}`);
}

export async function sendStaffMessageAction(
  conversationId: string,
  content: string
): Promise<ActionResult> {
  const parsed = sendStaffMessageSchema.safeParse({ conversationId, content });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz girdi." };
  }

  try {
    // Kimlik doğrulaması RLS'e tabi (anon+cookie) istemciyle yapılır;
    // veri yazma işlemi ise service role ile (bkz. docs/DATABASE.md — RLS
    // henüz personel rol politikaları içermiyor, .cursor/rules/02-security.mdc).
    await requireCurrentUserId();
    const supabase = createAdminClient();
    await sendStaffMessage(supabase, parsed.data);
    revalidateInbox(conversationId);
    return { success: true };
  } catch {
    return { success: false, error: "Mesaj gönderilemedi. Lütfen tekrar deneyin." };
  }
}

const statusSchema = z.enum(CONVERSATION_STATUS_VALUES);

export async function updateConversationStatusAction(
  conversationId: string,
  status: string
): Promise<ActionResult> {
  const parsedId = z.uuid().safeParse(conversationId);
  const parsedStatus = statusSchema.safeParse(status);

  if (!parsedId.success || !parsedStatus.success) {
    return { success: false, error: "Geçersiz durum." };
  }

  try {
    await requireCurrentUserId();
    const supabase = createAdminClient();
    await updateConversationStatus(supabase, parsedId.data, parsedStatus.data);
    revalidateInbox(parsedId.data);
    return { success: true };
  } catch {
    return { success: false, error: "Durum güncellenemedi. Lütfen tekrar deneyin." };
  }
}

export async function assignToMeAction(conversationId: string): Promise<ActionResult> {
  const parsedId = z.uuid().safeParse(conversationId);

  if (!parsedId.success) {
    return { success: false, error: "Geçersiz konuşma." };
  }

  try {
    const user = await requireCurrentUser();
    const supabase = createAdminClient();
    await ensureOwnProfileExists(supabase, user);
    await assignConversation(supabase, parsedId.data, user.id);
    revalidateInbox(parsedId.data);
    return { success: true };
  } catch (error) {
    // Hata detayı/mesajı istemciye sızdırılmaz, yalnızca teşhis için
    // sunucu konsoluna yazılır (bkz. .cursor/rules/02-security.mdc).
    console.error("[assignToMeAction] hata:", error);
    return { success: false, error: "Atama yapılamadı. Lütfen tekrar deneyin." };
  }
}

export async function unassignConversationAction(
  conversationId: string
): Promise<ActionResult> {
  const parsedId = z.uuid().safeParse(conversationId);

  if (!parsedId.success) {
    return { success: false, error: "Geçersiz konuşma." };
  }

  try {
    await requireCurrentUserId();
    const supabase = createAdminClient();
    await assignConversation(supabase, parsedId.data, null);
    revalidateInbox(parsedId.data);
    return { success: true };
  } catch {
    return { success: false, error: "Atama kaldırılamadı. Lütfen tekrar deneyin." };
  }
}
