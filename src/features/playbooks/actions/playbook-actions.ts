"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { generateSalesPlaybookDraft } from "@/features/playbooks/services/playbook-generator.service";
import { updatePlaybookStatus } from "@/features/playbooks/repositories/playbooks.repository";

export type PlaybookActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

async function requireCurrentUserId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    throw new Error("Oturum bulunamadı.");
  }
  return data.user.id;
}

/** Kanıtlardan yeni taslak playbook üretir (insan onayı olmadan aktif olmaz). */
export async function generatePlaybookDraftAction(): Promise<PlaybookActionResult> {
  try {
    await requireCurrentUserId();
    const admin = createAdminClient();
    const result = await generateSalesPlaybookDraft(admin);
    revalidatePath("/dashboard/ai");

    if (result.skipped) {
      return {
        success: false,
        error:
          result.reason === "insufficient_evidence"
            ? "Yeterli kanıt yok: en az 2 kazanan konuşma ve 3 öğrenilmiş kalıp gerekir."
            : "Playbook üretilemedi. Daha sonra tekrar deneyin.",
      };
    }
    if (!result.created) {
      return {
        success: true,
        message: "Benzer bir playbook zaten mevcut; yeni kayıt açılmadı.",
      };
    }
    return {
      success: true,
      message: `Taslak oluşturuldu: "${result.playbook?.title}". İnceleyip aktifleştirin.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "İşlem başarısız.";
    return { success: false, error: message };
  }
}

const statusSchema = z.object({
  playbookId: z.string().uuid(),
  status: z.enum(["draft", "review", "active", "archived"]),
});

/** Playbook durum değişikliği — aktifleştirme insan onayıdır (docs/27). */
export async function setPlaybookStatusAction(
  input: unknown
): Promise<PlaybookActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Geçersiz girdi." };
  }

  try {
    await requireCurrentUserId();
    const admin = createAdminClient();
    await updatePlaybookStatus(
      admin,
      parsed.data.playbookId,
      parsed.data.status
    );
    revalidatePath("/dashboard/ai");
    return { success: true, message: "Playbook durumu güncellendi." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "İşlem başarısız.";
    return { success: false, error: message };
  }
}
