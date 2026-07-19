import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ConversationExtraction } from "@/features/learning/validators/extraction-schema";
import {
  upsertAiMistake,
  upsertPersonalityTrait,
  upsertSalesPattern,
} from "@/features/sales-learning/repositories/sales-learning.repository";
import { maskPii } from "@/features/learning/utils/pii-mask";

type TypedSupabaseClient = SupabaseClient<Database>;

/** Best Library eşiği: kazanılmış + yüksek satış kalitesi. */
const BEST_CONVERSATION_MIN_SCORE = 80;

export type SalesLearningIngestResult = {
  patternsUpserted: number;
  traitsUpserted: number;
  mistakesUpserted: number;
  markedBest: boolean;
};

export function shouldMarkBestConversation(
  extraction: ConversationExtraction
): boolean {
  const quality = extraction.scores?.salesQuality ?? 0;
  const success =
    extraction.saleOutcome === "won" ||
    extraction.reservationCreated ||
    extraction.depositReceived;
  return success && quality >= BEST_CONVERSATION_MIN_SCORE;
}

/**
 * Extraction sonucundaki öğrenme sinyallerini kalıcı hafızaya işler:
 * satış kalıpları, şirket kişiliği, AI hataları. Kayıtlar silinmez;
 * tekrar görülen kalıpların sayaçları büyür (Continuous Memory).
 */
export async function ingestSalesLearningSignals(
  supabase: TypedSupabaseClient,
  conversationId: string,
  extraction: ConversationExtraction
): Promise<SalesLearningIngestResult> {
  let patternsUpserted = 0;
  let traitsUpserted = 0;
  let mistakesUpserted = 0;

  for (const pattern of extraction.salesPatterns) {
    try {
      await upsertSalesPattern(supabase, {
        patternType: pattern.patternType,
        patternText: maskPii(pattern.patternText),
        contextNote: pattern.contextNote ? maskPii(pattern.contextNote) : null,
        conversationId,
        outcome: extraction.saleOutcome,
      });
      patternsUpserted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      console.error("[sales-learning] kalıp kaydı hatası:", message);
    }
  }

  for (const observation of extraction.personalityObservations) {
    try {
      await upsertPersonalityTrait(supabase, {
        traitType: observation.traitType,
        traitText: maskPii(observation.traitText),
        conversationId,
      });
      traitsUpserted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      console.error("[sales-learning] kişilik kaydı hatası:", message);
    }
  }

  for (const mistake of extraction.aiMistakes) {
    try {
      await upsertAiMistake(supabase, {
        mistakeType: mistake.mistakeType,
        triggerContext: maskPii(mistake.triggerContext),
        wrongReply: mistake.wrongReply ? maskPii(mistake.wrongReply) : null,
        correctApproach: maskPii(mistake.correctApproach),
        conversationId,
      });
      mistakesUpserted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      console.error("[sales-learning] hata kaydı hatası:", message);
    }
  }

  return {
    patternsUpserted,
    traitsUpserted,
    mistakesUpserted,
    markedBest: shouldMarkBestConversation(extraction),
  };
}
