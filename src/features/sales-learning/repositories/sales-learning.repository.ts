import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  AiMistakeRow,
  AiMistakeType,
  BestConversationEntry,
  CompanyPersonalityTraitRow,
  PersonalityTraitType,
  SalesPatternRow,
  SalesPatternType,
} from "@/features/sales-learning/types";

type TypedSupabaseClient = SupabaseClient<Database>;

const MAX_SOURCE_IDS = 50;

/**
 * Kalıp/hata metnini tekrarları birleştirmek için normalize eder.
 * Aynı cümlenin küçük varyasyonları tek kayda toplanır (Continuous Memory).
 */
export function normalizeKey(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[.,!?;:"'()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function mergeSourceIds(existing: string[], next: string): string[] {
  if (existing.includes(next)) return existing;
  return [...existing, next].slice(-MAX_SOURCE_IDS);
}

function computeSuccessRate(won: number, lost: number): number | null {
  const total = won + lost;
  if (total === 0) return null;
  return Math.round((won / total) * 10000) / 100;
}

/** Kanıt sayısı arttıkça güven artar; tek örnek düşük güvendir. */
function computeConfidence(seenCount: number, successRate: number | null): number {
  const base = Math.min(80, 20 + seenCount * 10);
  if (successRate == null) return base;
  // Başarı oranı netleştikçe (çok kanıt + yüksek oran) güven yükselir.
  const bonus = successRate >= 70 ? 15 : successRate <= 30 ? -10 : 0;
  return Math.max(5, Math.min(95, base + bonus));
}

export type UpsertSalesPatternParams = {
  patternType: SalesPatternType;
  patternText: string;
  contextNote?: string | null;
  conversationId: string;
  outcome: "won" | "lost" | "open" | "unknown";
};

/**
 * Kalıbı ekler veya mevcutsa sayaçları günceller. Kayıt asla silinmez;
 * won/lost sayaçları büyür, success_rate yeniden hesaplanır.
 */
export async function upsertSalesPattern(
  supabase: TypedSupabaseClient,
  params: UpsertSalesPatternParams
): Promise<SalesPatternRow> {
  const key = normalizeKey(params.patternText);
  const nowIso = new Date().toISOString();

  const { data: existing, error: findError } = await supabase
    .from("sales_patterns")
    .select("*")
    .eq("pattern_type", params.patternType)
    .eq("pattern_key", key)
    .maybeSingle();

  if (findError) throw findError;

  const wonDelta = params.outcome === "won" ? 1 : 0;
  const lostDelta = params.outcome === "lost" ? 1 : 0;

  if (existing) {
    const won = existing.won_count + wonDelta;
    const lost = existing.lost_count + lostDelta;
    const seen = existing.seen_count + 1;
    const successRate = computeSuccessRate(won, lost);
    const { data, error } = await supabase
      .from("sales_patterns")
      .update({
        won_count: won,
        lost_count: lost,
        seen_count: seen,
        success_rate: successRate,
        confidence: computeConfidence(seen, successRate),
        context_note: params.contextNote ?? existing.context_note,
        source_conversation_ids: mergeSourceIds(
          existing.source_conversation_ids,
          params.conversationId
        ),
        last_seen_at: nowIso,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const successRate = computeSuccessRate(wonDelta, lostDelta);
  const { data, error } = await supabase
    .from("sales_patterns")
    .insert({
      pattern_type: params.patternType,
      pattern_text: params.patternText.trim(),
      pattern_key: key,
      context_note: params.contextNote ?? null,
      won_count: wonDelta,
      lost_count: lostDelta,
      seen_count: 1,
      success_rate: successRate,
      confidence: computeConfidence(1, successRate),
      source_conversation_ids: [params.conversationId],
      first_seen_at: nowIso,
      last_seen_at: nowIso,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export type UpsertPersonalityTraitParams = {
  traitType: PersonalityTraitType;
  traitText: string;
  conversationId: string;
};

/** Şirket kişiliği gözlemini ekler; mevcutsa kanıt sayısını artırır. */
export async function upsertPersonalityTrait(
  supabase: TypedSupabaseClient,
  params: UpsertPersonalityTraitParams
): Promise<CompanyPersonalityTraitRow> {
  const key = normalizeKey(params.traitText);
  const nowIso = new Date().toISOString();

  const { data: existing, error: findError } = await supabase
    .from("company_personality_traits")
    .select("*")
    .eq("trait_type", params.traitType)
    .eq("trait_key", key)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const evidence = existing.evidence_count + 1;
    const { data, error } = await supabase
      .from("company_personality_traits")
      .update({
        evidence_count: evidence,
        confidence: Math.min(95, 20 + evidence * 12),
        source_conversation_ids: mergeSourceIds(
          existing.source_conversation_ids,
          params.conversationId
        ),
        last_seen_at: nowIso,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("company_personality_traits")
    .insert({
      trait_type: params.traitType,
      trait_text: params.traitText.trim(),
      trait_key: key,
      evidence_count: 1,
      confidence: 32,
      source_conversation_ids: [params.conversationId],
      first_seen_at: nowIso,
      last_seen_at: nowIso,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export type UpsertAiMistakeParams = {
  mistakeType: AiMistakeType;
  triggerContext: string;
  wrongReply?: string | null;
  correctApproach: string;
  conversationId?: string | null;
  aiRunId?: string | null;
};

/**
 * AI hatasını kaydeder; aynı hata daha önce görüldüyse tekrar sayacını
 * artırır ve is_resolved=false yapar (hata geri geldi demektir).
 */
export async function upsertAiMistake(
  supabase: TypedSupabaseClient,
  params: UpsertAiMistakeParams
): Promise<AiMistakeRow> {
  const key = normalizeKey(
    `${params.mistakeType} ${params.triggerContext}`
  );
  const nowIso = new Date().toISOString();

  const { data: existing, error: findError } = await supabase
    .from("ai_mistakes")
    .select("*")
    .eq("mistake_key", key)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { data, error } = await supabase
      .from("ai_mistakes")
      .update({
        occurrence_count: existing.occurrence_count + 1,
        is_resolved: false,
        wrong_reply: params.wrongReply ?? existing.wrong_reply,
        correct_approach: params.correctApproach,
        last_seen_at: nowIso,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("ai_mistakes")
    .insert({
      mistake_type: params.mistakeType,
      trigger_context: params.triggerContext.trim(),
      wrong_reply: params.wrongReply ?? null,
      correct_approach: params.correctApproach.trim(),
      mistake_key: key,
      occurrence_count: 1,
      source_conversation_id: params.conversationId ?? null,
      source_ai_run_id: params.aiRunId ?? null,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * En başarılı aktif kalıplar. Çelişki durumunda daha başarılı olan öne
 * çıkar: success_rate > seen_count sıralaması (Continuous Memory kuralı).
 */
export async function listTopPatterns(
  supabase: TypedSupabaseClient,
  options?: { patternType?: SalesPatternType; limit?: number }
): Promise<SalesPatternRow[]> {
  let query = supabase
    .from("sales_patterns")
    .select("*")
    .eq("status", "active")
    .order("success_rate", { ascending: false, nullsFirst: false })
    .order("seen_count", { ascending: false })
    .limit(options?.limit ?? 20);

  if (options?.patternType) {
    query = query.eq("pattern_type", options.patternType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Aktif şirket kişiliği (kanıt sayısına göre). */
export async function listPersonalityTraits(
  supabase: TypedSupabaseClient,
  limit = 24
): Promise<CompanyPersonalityTraitRow[]> {
  const { data, error } = await supabase
    .from("company_personality_traits")
    .select("*")
    .eq("status", "active")
    .order("evidence_count", { ascending: false })
    .order("confidence", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Çözülmemiş (aktif) AI hataları — cevap üretiminde "yapma" kuralları. */
export async function listActiveMistakes(
  supabase: TypedSupabaseClient,
  limit = 20
): Promise<AiMistakeRow[]> {
  const { data, error } = await supabase
    .from("ai_mistakes")
    .select("*")
    .eq("is_resolved", false)
    .order("occurrence_count", { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Best Conversation Library — en başarılı satış konuşmaları. */
export async function listBestConversations(
  supabase: TypedSupabaseClient,
  limit = 10
): Promise<BestConversationEntry[]> {
  const { data, error } = await supabase
    .from("conversation_analyses")
    .select(
      "id, conversation_id, customer_intent, first_customer_question, first_reply_given, advancing_reply, score_sales_quality, sale_outcome, reservation_created, deposit_received, analyzed_at, extraction"
    )
    .eq("is_best_conversation", true)
    .order("score_sales_quality", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const extraction =
      row.extraction && typeof row.extraction === "object"
        ? (row.extraction as Record<string, unknown>)
        : null;
    const summary =
      extraction && typeof extraction.summary === "string"
        ? extraction.summary
        : null;
    return {
      analysisId: row.id,
      conversationId: row.conversation_id,
      summary,
      customerIntent: row.customer_intent,
      firstCustomerQuestion: row.first_customer_question,
      firstReplyGiven: row.first_reply_given,
      advancingReply: row.advancing_reply,
      scoreSalesQuality: row.score_sales_quality,
      saleOutcome: row.sale_outcome,
      reservationCreated: row.reservation_created,
      depositReceived: row.deposit_received,
      analyzedAt: row.analyzed_at,
    };
  });
}
