/**
 * Müşterinin ne zaman tekrar yazacağını tahmin et + otomatik takip önerisi.
 * Heuristik: geçmiş yanıt gecikmeleri + soft-close kalıpları.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { classifyFollowUpReason } from "@/features/follow-ups/services/follow-ups.service";
import { scheduleFollowUp } from "@/features/follow-ups/services/follow-ups.service";
import { listRecentMessagesByConversation } from "@/features/conversations/repositories/messages.repository";
import { buildSuggestedReply } from "@/features/ai/services/conversation-quality.service";

type TypedSupabase = SupabaseClient<Database>;

export type ReplyPrediction = {
  conversationId: string;
  predictedReplyAt: string | null;
  predictedReplyHours: number | null;
  confidence: "low" | "medium" | "high";
  basis: string;
  followUpSuggestion: string;
  recommendedFollowUpAt: string;
  recommendedDelayHours: number;
  softCloseReason: string | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Global yanıt gecikmesi medyanı (saat) — outbound sonrası ilk customer.
 */
async function estimateGlobalReplyHours(
  supabase: TypedSupabase
): Promise<number> {
  const { data: convs } = await supabase
    .from("conversations")
    .select("id")
    .eq("channel", "instagram")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(40);

  const gaps: number[] = [];
  for (const c of convs ?? []) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("sender_type, created_at")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: true })
      .limit(40);

    let lastOut: number | null = null;
    for (const m of msgs ?? []) {
      const t = new Date(m.created_at).getTime();
      if (m.sender_type === "ai" || m.sender_type === "staff") {
        lastOut = t;
      } else if (m.sender_type === "customer" && lastOut != null) {
        const hours = (t - lastOut) / (1000 * 60 * 60);
        if (hours > 0.05 && hours < 240) gaps.push(hours);
        lastOut = null;
      }
    }
  }

  return median(gaps) ?? 18;
}

/**
 * Tek konuşma için tahmin + takip önerisi metni.
 */
export async function predictCustomerReply(
  supabase: TypedSupabase,
  conversationId: string
): Promise<ReplyPrediction> {
  const messages = await listRecentMessagesByConversation(
    supabase,
    conversationId,
    40
  );

  const lastCustomer = [...messages]
    .reverse()
    .find((m) => m.sender_type === "customer");
  const lastOutbound = [...messages]
    .reverse()
    .find((m) => m.sender_type === "ai" || m.sender_type === "staff");

  const soft = classifyFollowUpReason(lastCustomer?.content ?? "");
  const globalHours = await estimateGlobalReplyHours(supabase);

  let delayHours = globalHours;
  let confidence: ReplyPrediction["confidence"] = "low";
  let basis = `Benzer konuşmalarda medyan yanıt ~${Math.round(globalHours)} saat.`;
  let softCloseReason: string | null = null;

  if (soft.reason && soft.delayHours != null) {
    delayHours = soft.delayHours;
    softCloseReason = soft.reason;
    confidence = "high";
    basis = `Müşteri mesajı "${soft.reason}" kalıbı; tipik dönüş ${soft.delayHours} saat.`;
  } else if (lastOutbound && lastCustomer) {
    const outT = new Date(lastOutbound.created_at).getTime();
    const custT = new Date(lastCustomer.created_at).getTime();
    if (outT > custT) {
      // Biz son yazdık — cevap bekleniyor
      delayHours = Math.max(4, Math.min(globalHours, 48));
      confidence = "medium";
      basis = `Son mesaj bizden; geçmiş medyan ~${Math.round(globalHours)} saatte yanıt geliyor.`;
    } else {
      // Müşteri son yazdı — biz cevap vermeliyiz; takip daha geç
      delayHours = Math.max(12, globalHours);
      confidence = "medium";
      basis = "Müşteri son yazmış; önce cevap, takip gerekirse sonra.";
    }
  }

  const now = Date.now();
  const predictedReplyAt = new Date(
    now + delayHours * 60 * 60 * 1000
  ).toISOString();

  // Takip: tahmin edilen yanıttan biraz sonra (cevap gelmezse)
  const followDelay = Math.round(delayHours * 1.15 + 2);
  const recommendedFollowUpAt = new Date(
    now + followDelay * 60 * 60 * 1000
  ).toISOString();

  const followUpSuggestion = buildSuggestedReply({
    lossReason: softCloseReason === "price_high" ? "Fiyatta kaybedildi" : null,
    primaryIssue:
      softCloseReason === "thinking" || softCloseReason === "will_return"
        ? "Müşteri cevap vermedi."
        : softCloseReason === "ask_spouse"
          ? "Güven oluşmadı."
          : "Müşteri cevap vermedi.",
    lastCustomerText: lastCustomer?.content ?? null,
  });

  // Persist on conversation
  await supabase
    .from("conversations")
    .update({
      predicted_reply_at: predictedReplyAt,
      predicted_reply_hours: Math.round(delayHours * 100) / 100,
      follow_up_suggestion: followUpSuggestion,
    })
    .eq("id", conversationId);

  return {
    conversationId,
    predictedReplyAt,
    predictedReplyHours: Math.round(delayHours * 10) / 10,
    confidence,
    basis,
    followUpSuggestion,
    recommendedFollowUpAt,
    recommendedDelayHours: followDelay,
    softCloseReason,
  };
}

/**
 * Tahmine göre follow_up_tasks oluştur.
 */
export async function schedulePredictedFollowUp(
  supabase: TypedSupabase,
  conversationId: string
): Promise<{ taskId: string | null; prediction: ReplyPrediction }> {
  const prediction = await predictCustomerReply(supabase, conversationId);

  const { data: conv } = await supabase
    .from("conversations")
    .select("contact_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv?.contact_id) {
    return { taskId: null, prediction };
  }

  const task = await scheduleFollowUp(supabase, {
    contactId: conv.contact_id,
    conversationId,
    reason: prediction.softCloseReason
      ? `predict_${prediction.softCloseReason}`
      : "predict_reply",
    delayHours: prediction.recommendedDelayHours,
    message: prediction.followUpSuggestion,
  });

  return { taskId: task?.id ?? null, prediction };
}
