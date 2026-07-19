"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { reviewKnowledgeDocument } from "@/features/learning/services/knowledge-review.service";
import { runConversationLearningBatch } from "@/features/learning/services/learning-automation.service";
import { importHistoricalConversations } from "@/features/learning/services/import-conversations.service";
import { importConversationsPayloadSchema } from "@/features/learning/validators/import-conversations";
import {
  knowledgeReviewActionSchema,
  type KnowledgeReviewActionInput,
} from "@/features/learning/validators/extraction-schema";

export type LearningActionResult =
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

function revalidateLearning() {
  revalidatePath("/dashboard/ai");
  revalidatePath("/dashboard/knowledge");
}

export async function reviewKnowledgeAction(
  input: KnowledgeReviewActionInput
): Promise<LearningActionResult> {
  const parsed = knowledgeReviewActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Geçersiz girdi.",
    };
  }

  try {
    const userId = await requireCurrentUserId();
    const admin = createAdminClient();
    const result = await reviewKnowledgeDocument(admin, parsed.data, userId);
    if (!result.success) {
      return result;
    }
    revalidateLearning();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "İşlem başarısız.";
    return { success: false, error: message };
  }
}

export async function runLearningBatchAction(): Promise<LearningActionResult> {
  try {
    await requireCurrentUserId();
    const admin = createAdminClient();
    const result = await runConversationLearningBatch(admin, {
      triggerSource: "manual",
      limit: 40,
    });
    revalidateLearning();
    return {
      success: true,
      message: `${result.analyzed} konuşma analiz edildi (${result.failed} hata, ${result.skipped} atlandı), ${result.knowledgeProposed} bilgi önerisi.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "İşlem başarısız.";
    return { success: false, error: message };
  }
}

export async function importConversationsAction(
  rawJson: string
): Promise<LearningActionResult> {
  try {
    await requireCurrentUserId();

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawJson) as unknown;
    } catch {
      return { success: false, error: "Geçersiz JSON." };
    }

    const payload = importConversationsPayloadSchema.safeParse(parsedJson);
    if (!payload.success) {
      return {
        success: false,
        error: payload.error.issues[0]?.message ?? "Import şeması geçersiz.",
      };
    }

    const admin = createAdminClient();
    const imported = await importHistoricalConversations(admin, payload.data);

    const learning = await runConversationLearningBatch(admin, {
      triggerSource: "import",
      conversationIds: imported.conversationIds,
      force: true,
    });

    revalidateLearning();
    return {
      success: true,
      message: `${imported.conversationsProcessed} konuşma, ${imported.messagesInserted} yeni mesaj içe aktarıldı (${imported.messagesSkippedDuplicate} tekrar atlandı). ${learning.analyzed} analiz edildi.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import başarısız.";
    return { success: false, error: message };
  }
}
