import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getKnowledgeDocumentById,
  updateKnowledgeReview,
} from "@/features/knowledge/repositories/knowledge-documents.repository";
import {
  knowledgeReviewActionSchema,
  type KnowledgeReviewActionInput,
} from "@/features/learning/validators/extraction-schema";
import { maskPii } from "@/features/learning/utils/pii-mask";
import { indexKnowledgeDocument } from "@/features/knowledge/services/rag.service";

type TypedSupabaseClient = SupabaseClient<Database>;

export type ReviewKnowledgeResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Pending knowledge kaydını onayla / reddet / düzenle.
 * Onaylı kayıtlar AI cevap bağlamına girer.
 */
export async function reviewKnowledgeDocument(
  supabase: TypedSupabaseClient,
  input: KnowledgeReviewActionInput,
  reviewedBy: string | null
): Promise<ReviewKnowledgeResult> {
  const parsed = knowledgeReviewActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Geçersiz girdi.",
    };
  }

  const existing = await getKnowledgeDocumentById(
    supabase,
    parsed.data.knowledgeId
  );
  if (!existing) {
    return { success: false, error: "Bilgi kaydı bulunamadı." };
  }

  if (parsed.data.action === "approve") {
    if (existing.is_pricing_sensitive && !parsed.data.content) {
      // Fiyat içeren kayıtlar düzenlenmeden onaylanabilir ama personel
      // bilerek onaylamış olur; içerik maskeli kalır.
    }

    await updateKnowledgeReview(supabase, {
      id: existing.id,
      reviewStatus: "approved",
      reviewedBy,
      title: parsed.data.title ? maskPii(parsed.data.title) : undefined,
      content: parsed.data.content ? maskPii(parsed.data.content) : undefined,
      category: parsed.data.category,
      reviewNotes: parsed.data.reviewNotes ?? null,
    });

    // RAG (docs/29): onaylanan doküman embedding ile indekslenir.
    // İndeksleme hatası onayı geri almaz; backfill cron'u telafi eder.
    try {
      await indexKnowledgeDocument(supabase, existing.id);
    } catch (indexError) {
      console.error(
        "[knowledge-review] RAG indeksleme hatası:",
        indexError instanceof Error ? indexError.message : "bilinmeyen"
      );
    }
    return { success: true };
  }

  if (parsed.data.action === "reject") {
    await updateKnowledgeReview(supabase, {
      id: existing.id,
      reviewStatus: "rejected",
      reviewedBy,
      reviewNotes: parsed.data.reviewNotes ?? null,
    });
    return { success: true };
  }

  // edit — düzenle, pending'de bırak (veya istersen onayla)
  if (!parsed.data.title && !parsed.data.content && !parsed.data.category) {
    return { success: false, error: "Düzenleme için alan gerekli." };
  }

  await updateKnowledgeReview(supabase, {
    id: existing.id,
    reviewStatus: "pending_review",
    reviewedBy,
    title: parsed.data.title ? maskPii(parsed.data.title) : undefined,
    content: parsed.data.content ? maskPii(parsed.data.content) : undefined,
    category: parsed.data.category,
    reviewNotes: parsed.data.reviewNotes ?? null,
  });

  return { success: true };
}
