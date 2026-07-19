"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { analyzeLostSale } from "@/features/ai/services/lost-sale-analyzer.service";
import { getCorrectionCase } from "@/features/ai/services/correction-case.service";
import { sendStaffMessage } from "@/features/conversations/services/conversations.service";
import { recordSuggestionApplication } from "@/features/ai/services/suggestion-success.service";
import { schedulePredictedFollowUp } from "@/features/ai/services/reply-prediction.service";

const idSchema = z.string().uuid();

export type CorrectionActionResult =
  | { success: true; data?: { messageId?: string; followUpTaskId?: string | null } }
  | { success: false; error: { code: string; message: string } };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Oturum bulunamadı.");
  return data.user.id;
}

function revalidateCorrection(conversationId: string) {
  revalidatePath(`/dashboard/ai/corrections/${conversationId}`);
  revalidatePath("/dashboard/ai");
  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${conversationId}`);
  revalidatePath("/dashboard/follow-ups");
}

/**
 * Kayıp analizi + alternatif cevabı yeniden üret (LLM).
 */
export async function regenerateLostSaleAnalysisAction(
  conversationId: string
): Promise<CorrectionActionResult> {
  const parsed = idSchema.safeParse(conversationId);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "invalid_id", message: "Geçersiz konuşma." },
    };
  }

  try {
    const supabase = createAdminClient();
    const analysis = await analyzeLostSale(supabase, parsed.data);
    if (!analysis) {
      return {
        success: false,
        error: {
          code: "analysis_failed",
          message:
            "Analiz üretilemedi. OpenAI yapılandırmasını veya konuşma uzunluğunu kontrol edin.",
        },
      };
    }
    await getCorrectionCase(supabase, parsed.data);
    revalidateCorrection(parsed.data);
    return { success: true };
  } catch {
    return {
      success: false,
      error: { code: "server_error", message: "Analiz sırasında hata oluştu." },
    };
  }
}

const applySchema = z.object({
  conversationId: z.string().uuid(),
  text: z.string().trim().min(1).max(4000),
  originalSuggestion: z.string().max(4000),
  lossReason: z.string().max(200).optional().nullable(),
  scheduleFollowUp: z.boolean().optional().default(true),
});

/**
 * Önerilen cevabı tek tıkla / düzenleyerek gönder + başarı takibine yaz.
 */
export async function applySuggestedReplyAction(
  input: z.input<typeof applySchema>
): Promise<CorrectionActionResult> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "invalid_input",
        message: parsed.error.issues[0]?.message ?? "Geçersiz girdi.",
      },
    };
  }

  try {
    const userId = await requireUserId();
    const supabase = createAdminClient();
    const { conversationId, text, originalSuggestion, lossReason, scheduleFollowUp } =
      parsed.data;

    const { data: conv } = await supabase
      .from("conversations")
      .select("id, contact_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conv) {
      return {
        success: false,
        error: { code: "not_found", message: "Konuşma bulunamadı." },
      };
    }

    const edited =
      text.trim() !== originalSuggestion.trim() ? "manual_edit" : "quality_score";

    const message = await sendStaffMessage(
      supabase,
      { conversationId, content: text, source: "unknown" },
      { actorId: userId }
    );

    await recordSuggestionApplication(supabase, {
      conversationId,
      contactId: conv.contact_id,
      staffMessageId: message.id,
      lossReason: lossReason ?? null,
      suggestionSource: edited,
      originalSuggestion,
      sentText: text,
      appliedBy: userId,
    });

    let followUpTaskId: string | null = null;
    if (scheduleFollowUp) {
      try {
        const scheduled = await schedulePredictedFollowUp(
          supabase,
          conversationId
        );
        followUpTaskId = scheduled.taskId;
      } catch {
        /* takip opsiyonel */
      }
    }

    revalidateCorrection(conversationId);
    return {
      success: true,
      data: { messageId: message.id, followUpTaskId },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "server_error",
        message:
          error instanceof Error ? error.message : "Gönderim başarısız.",
      },
    };
  }
}

/**
 * Yalnızca takip görevini tahminle oluştur (mesaj göndermeden).
 */
export async function scheduleCorrectionFollowUpAction(
  conversationId: string
): Promise<CorrectionActionResult> {
  const parsed = idSchema.safeParse(conversationId);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "invalid_id", message: "Geçersiz konuşma." },
    };
  }

  try {
    await requireUserId();
    const supabase = createAdminClient();
    const { taskId } = await schedulePredictedFollowUp(supabase, parsed.data);
    revalidateCorrection(parsed.data);
    return { success: true, data: { followUpTaskId: taskId } };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "server_error",
        message:
          error instanceof Error ? error.message : "Takip planlanamadı.",
      },
    };
  }
}
