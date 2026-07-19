/**
 * Conversation Recorder + Outcome Tracker
 * Konuşma bitince gerçek sonuç etiketi yazar (Judge skoru değil).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { listRecentMessagesByConversation } from "@/features/conversations/repositories/messages.repository";
import { getConversationSalesBrainState } from "@/features/conversations/repositories/conversations.repository";
import { parseSalesBrainSnapshot } from "@/features/ai/services/sales-brain.service";
import { recordConversationOutcome } from "@/features/ai-brain/services/ai-brain.service";

type TypedSupabase = SupabaseClient<Database>;

export type ConversationOutcomeTag = {
  reservation: boolean;
  deposit: boolean;
  customerLost: boolean;
  reason: string | null;
  confidence: number;
  conversationLength: number;
  customerType: string | null;
  customerReplied: boolean;
  priceMentioned: boolean;
  priceAccepted: boolean | null;
  replyVariant: "A" | "B" | null;
  abExperimentKey: string | null;
  recommendation: string | null;
};

const PRICE_RE =
  /11\.?000|14\.?000|21\.?000|fiyat|ne\s*kadar|kaç\s*tl|ücret/i;
const ACCEPT_RE =
  /tamam|olur|yapalım|alalım|kapora|rezerve|uygun|anlaştık|gönder/i;
const REJECT_PRICE_RE =
  /pahalı|bütçe|düşünelim|bakarız|başka\s*yer|çok\s*yüksek/i;

function buildRecommendation(reason: string | null): string | null {
  switch (reason) {
    case "price":
    case "early_price":
      return "Price objection → build trust → önce örnek göster → sonra fiyat";
    case "trust":
      return "Güven düşük → empathy + referans → fiyatı ertele";
    case "too_long":
      return "Çok uzun cevap → max 3 satır, tek soru, dump yok";
    case "misunderstood":
    case "wrong_reply":
      return "Yanlış anlama → müşteri cümlesini yansıt, sonra net cevap";
    case "late_price":
      return "Geç fiyat → ikinci fiyat talebinde katalog rakamını ver";
    case "competitor":
      return "Rakip → saldırmadan farkı kısaca anlat, baskı yapma";
    default:
      return null;
  }
}

/**
 * Konuşma kapanışında Outcome Tracker etiketi üret ve kaydet.
 */
export async function recordConversationOutcomeTag(
  supabase: TypedSupabase,
  conversationId: string
): Promise<ConversationOutcomeTag | null> {
  const messages = await listRecentMessagesByConversation(
    supabase,
    conversationId,
    80
  );
  const conversationLength = messages.length;
  const customerMsgs = messages.filter((m) => m.sender_type === "customer");
  const aiMsgs = messages.filter((m) => m.sender_type === "ai");
  const customerReplied = customerMsgs.length >= 2;
  const allText = messages.map((m) => m.content ?? "").join("\n");
  const priceMentioned = PRICE_RE.test(allText);

  let priceAccepted: boolean | null = null;
  if (priceMentioned) {
    const afterPrice = customerMsgs
      .map((m) => m.content ?? "")
      .filter((t) => ACCEPT_RE.test(t) || REJECT_PRICE_RE.test(t));
    if (afterPrice.some((t) => ACCEPT_RE.test(t))) priceAccepted = true;
    else if (afterPrice.some((t) => REJECT_PRICE_RE.test(t)))
      priceAccepted = false;
  }

  // Rezervasyon / kapora — conversation + contact
  const { data: convMeta } = await supabase
    .from("conversations")
    .select("contact_id")
    .eq("id", conversationId)
    .maybeSingle();

  const { data: byConvRes } = await supabase
    .from("reservations")
    .select("id, deposit_status, status")
    .eq("conversation_id", conversationId)
    .limit(10);

  let reservations = [...(byConvRes ?? [])];
  if (convMeta?.contact_id) {
    const { data: byContactRes } = await supabase
      .from("reservations")
      .select("id, deposit_status, status")
      .eq("contact_id", convMeta.contact_id)
      .limit(10);
    const seen = new Set(reservations.map((r) => r.id));
    for (const r of byContactRes ?? []) {
      if (!seen.has(r.id)) reservations.push(r);
    }
  }

  const reservation = reservations.some((r) =>
    ["confirmed", "completed", "shoot_completed"].includes(r.status)
  );
  const deposit = reservations.some((r) => r.deposit_status === "verified");

  // Brain customer type
  let customerType: string | null = null;
  try {
    const brainRaw = await getConversationSalesBrainState(
      supabase,
      conversationId
    );
    const brain = parseSalesBrainSnapshot(brainRaw);
    customerType = brain?.customerType ?? null;
  } catch {
    /* ignore */
  }

  // A/B
  const { data: ab } = await supabase
    .from("reply_ab_assignments")
    .select("variant, experiment_key")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  // Lost sale
  let reason: string | null = null;
  let confidence = 0.5;
  let customerLost = !reservation && conversationLength >= 2;

  if (customerLost) {
    const { data: lostRow } = await supabase
      .from("lost_sale_analyses")
      .select("primary_reason, reasons")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lostRow?.primary_reason) {
      reason = lostRow.primary_reason;
      const reasonCount = Array.isArray(lostRow.reasons)
        ? lostRow.reasons.length
        : 1;
      confidence = Math.min(0.95, 0.55 + reasonCount * 0.08);
    } else {
      const { data: analysis } = await supabase
        .from("conversation_analyses")
        .select("sale_outcome, loss_reason")
        .eq("conversation_id", conversationId)
        .order("analyzed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (analysis?.sale_outcome === "won") {
        customerLost = false;
      } else {
        reason = analysis?.loss_reason ?? reason ?? "unknown";
        confidence = analysis?.loss_reason ? 0.7 : 0.45;
      }
    }
  }

  if (reservation) {
    customerLost = false;
    reason = null;
    confidence = 0.95;
  }

  const recommendation = customerLost ? buildRecommendation(reason) : null;

  const tag: ConversationOutcomeTag = {
    reservation,
    deposit,
    customerLost,
    reason,
    confidence: Math.round(confidence * 100) / 100,
    conversationLength,
    customerType,
    customerReplied,
    priceMentioned,
    priceAccepted,
    replyVariant: ab?.variant ?? null,
    abExperimentKey: ab?.experiment_key ?? null,
    recommendation,
  };

  const tagJson = {
    reservation: tag.reservation,
    deposit: tag.deposit,
    customerLost: tag.customerLost,
    reason: tag.reason,
    confidence: tag.confidence,
    conversation_length: tag.conversationLength,
    customer_type: tag.customerType,
    customer_replied: tag.customerReplied,
    price_mentioned: tag.priceMentioned,
    price_accepted: tag.priceAccepted,
    reply_variant: tag.replyVariant,
  };

  const { error } = await supabase.from("conversation_outcome_tags").upsert(
    {
      conversation_id: conversationId,
      reservation: tag.reservation,
      deposit: tag.deposit,
      customer_lost: tag.customerLost,
      lost_reason: tag.reason,
      conversation_length: tag.conversationLength,
      customer_type: tag.customerType,
      confidence: tag.confidence,
      customer_replied: tag.customerReplied,
      price_mentioned: tag.priceMentioned,
      price_accepted: tag.priceAccepted,
      reply_variant: tag.replyVariant,
      ab_experiment_key: tag.abExperimentKey,
      recommendation: tag.recommendation,
      tag: tagJson as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id" }
  );

  if (error) {
    console.error("[conversation-recorder]", error.message);
  }

  // Kalite skoru — kapanışta güncelle
  try {
    const {
      computeConversationQualityScore,
      upsertConversationQualityScore,
    } = await import("@/features/ai/services/conversation-quality.service");
    const quality = await computeConversationQualityScore(
      supabase,
      conversationId
    );
    await upsertConversationQualityScore(supabase, quality);
  } catch {
    /* quality tablo/migration opsiyonel */
  }

  // Eski outcome event tablosu ile senkron
  try {
    if (tag.reservation) {
      await recordConversationOutcome(supabase, {
        conversationId,
        outcome: "sale",
        metadata: tagJson as Json,
      });
    } else if (tag.customerLost) {
      await recordConversationOutcome(supabase, {
        conversationId,
        outcome: "customer_abandoned",
        notes: tag.reason,
        metadata: tagJson as Json,
      });
    } else if (!tag.customerReplied && aiMsgs.length > 0) {
      await recordConversationOutcome(supabase, {
        conversationId,
        outcome: "no_reply",
        metadata: tagJson as Json,
      });
    }
  } catch {
    /* optional */
  }

  return tag;
}
