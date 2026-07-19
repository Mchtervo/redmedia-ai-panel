"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import {
  insertAdminNote,
  updateProfileTagsAndScores,
} from "@/features/smart-sales/repositories/smart-sales.repository";
import { LIFECYCLE_STAGES, SALES_TAG_OPTIONS } from "@/features/smart-sales/types";
import { appendTimelineEvent } from "@/features/smart-sales/repositories/smart-sales.repository";

export type ActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

async function requireUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Oturum bulunamadı.");
  return data.user.id;
}

export async function addAdminNoteAction(
  contactId: string,
  body: string
): Promise<ActionResult> {
  const parsed = z
    .object({ contactId: z.string().uuid(), body: z.string().min(2).max(4000) })
    .safeParse({ contactId, body });
  if (!parsed.success) {
    return { success: false, error: "Geçersiz not." };
  }
  try {
    const userId = await requireUserId();
    const admin = createAdminClient();
    await insertAdminNote(admin, {
      contactId: parsed.data.contactId,
      body: parsed.data.body,
      authorId: userId,
    });
    // Profil admin_notes alanına da ekle (AI prompt için)
    const { data: profile } = await admin
      .from("customer_profiles")
      .select("admin_notes")
      .eq("contact_id", parsed.data.contactId)
      .maybeSingle();
    const merged = [profile?.admin_notes, parsed.data.body]
      .filter(Boolean)
      .join("\n---\n")
      .slice(0, 8000);
    await updateProfileTagsAndScores(admin, parsed.data.contactId, {
      adminNotes: merged,
    });
    revalidatePath(`/dashboard/customers/${contactId}`);
    return { success: true, message: "Not eklendi." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Not eklenemedi",
    };
  }
}

export async function updateCustomerTagsAction(
  contactId: string,
  tags: string[]
): Promise<ActionResult> {
  const allowed = new Set<string>(SALES_TAG_OPTIONS);
  const cleaned = tags.filter((t) => allowed.has(t));
  try {
    await requireUserId();
    const admin = createAdminClient();
    await updateProfileTagsAndScores(admin, contactId, { tags: cleaned });
    await appendTimelineEvent(admin, {
      contactId,
      eventType: "tags_updated",
      title: "Etiketler güncellendi",
      body: cleaned.join(", ") || "(temizlendi)",
      actorType: "staff",
    });
    revalidatePath(`/dashboard/customers/${contactId}`);
    return { success: true, message: "Etiketler güncellendi." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Güncelleme başarısız",
    };
  }
}

export async function updateLifecycleStageAction(
  contactId: string,
  stage: string
): Promise<ActionResult> {
  if (!(LIFECYCLE_STAGES as readonly string[]).includes(stage)) {
    return { success: false, error: "Geçersiz aşama." };
  }
  try {
    await requireUserId();
    const admin = createAdminClient();
    await updateProfileTagsAndScores(admin, contactId, {
      lifecycleStage: stage,
    });
    await appendTimelineEvent(admin, {
      contactId,
      eventType: "lifecycle_override",
      title: `Aşama (admin): ${stage}`,
      actorType: "staff",
    });
    revalidatePath(`/dashboard/customers/${contactId}`);
    return { success: true, message: "Aşama güncellendi." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Güncelleme başarısız",
    };
  }
}
