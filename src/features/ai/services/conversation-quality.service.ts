/**
 * Conversation Quality Score (0–100) + +/- faktörler + alternatif cevap.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { listRecentMessagesByConversation } from "@/features/conversations/repositories/messages.repository";
import {
  filterProductionConversationIds,
  listProductionInstagramConversationIds,
} from "@/features/ai/services/production-conversation-filter";

type TypedSupabase = SupabaseClient<Database>;

export type QualityFactor = {
  label: string;
  delta: number;
  sign: "+" | "-";
};

export type ConversationQualityResult = {
  conversationId: string;
  score: number;
  grade: string;
  primaryIssue: string | null;
  issues: string[];
  factors: QualityFactor[];
  summary: string;
  lossReason: string | null;
  suggestedReply: string | null;
};

const PRICE_RE =
  /11\.?000|14\.?000|21\.?000|fiyat|ne\s*kadar|kaç\s*tl|ücret/i;
const REJECT_PRICE_RE =
  /pahalı|bütçe|düşünelim|bakarız|başka\s*yer|çok\s*yüksek/i;
const ACCEPT_RE =
  /tamam|olur|yapalım|alalım|kapora|rezerve|uygun|anlaştık|gönder/i;
const LONG_REPLY_CHARS = 420;

export const RESERVATION_OK_STATUSES = new Set([
  "deposit_pending",
  "payment_review",
  "confirmed",
  "completed",
  "shoot_completed",
]);

/** Gerçek kapora metriği — yalnızca verified. */
export const DEPOSIT_OK_STATUSES = new Set(["verified"]);

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function gradeForScore(score: number, primaryIssue: string | null): string {
  if (score >= 90) return "Harika";
  if (score >= 75) return "İyi";
  if (score >= 60) return primaryIssue ?? "Orta";
  if (score >= 40) return primaryIssue ?? "Zayıf";
  return primaryIssue ?? "Kritik";
}

function pushFactor(
  factors: QualityFactor[],
  label: string,
  delta: number
): void {
  if (delta === 0) return;
  factors.push({
    label,
    delta: Math.abs(delta),
    sign: delta > 0 ? "+" : "-",
  });
}

/** Deterministik alternatif cevap — LLM beklemeden düzeltme önerir. */
export function buildSuggestedReply(params: {
  lossReason: string | null;
  primaryIssue: string | null;
  lastCustomerText: string | null;
}): string {
  const issue = params.lossReason ?? params.primaryIssue ?? "";
  const customerHint = (params.lastCustomerText ?? "").trim().slice(0, 80);

  if (/cevap vermedi|no_reply|ghost/i.test(issue)) {
    return customerHint
      ? `Merhaba, "${customerHint.slice(0, 40)}…" diye yazmıştınız — hâlâ yardımcı olayım mı? Kısa soru: düğün tarihi netleşti mi?`
      : "Merhaba, geçen yazışmamızda kaldığımız yerden devam edebiliriz. Düğün tarihiniz net mi, yoksa önce paketleri mi konuşalım?";
  }
  if (/uzun|too_long/i.test(issue)) {
    return "Kısaca: paketlerimiz 11.000 / 14.000 / 21.000 TL. Tarih ve mekanı yazarsanız size net uygun paketi söyleyeyim.";
  }
  if (/fiyat|price|erken/i.test(issue)) {
    return "Anlıyorum, bütçe önemli. Önce sizin için neyin kritik olduğunu netleştirelim (tarih / mekan / video süresi). Sonra katalog fiyatını net paylaşırım — sürpriz olmaz.";
  }
  if (/güven|trust/i.test(issue)) {
    return "Haklısınız, karar vermeden görmek isterim. İsterseniz benzer bir düğünden 1 kısa örnek göndereyim; sonra paket detayına geçeriz.";
  }
  if (/rakip|competitor/i.test(issue)) {
    return "Karşılaştırma yapmanız normal. Bizde fark: tek ekip + sinematik kurgu. Sizin tarihe özel net teklif çıkarayım — başka yerle yan yana koyabilirsiniz.";
  }
  return "Devam edelim: tarih / mekan / hangi paket sizin için öncelik? Netleşince size tek net adım önereyim.";
}

/**
 * Tek konuşma için deterministik kalite skoru (+/- faktörler).
 */
export async function computeConversationQualityScore(
  supabase: TypedSupabase,
  conversationId: string
): Promise<ConversationQualityResult> {
  const messages = await listRecentMessagesByConversation(
    supabase,
    conversationId,
    120
  );

  const { data: tag } = await supabase
    .from("conversation_outcome_tags")
    .select(
      "reservation, deposit, customer_lost, lost_reason, customer_replied, price_mentioned, price_accepted, conversation_length"
    )
    .eq("conversation_id", conversationId)
    .maybeSingle();

  const { data: reservations } = await supabase
    .from("reservations")
    .select("id, status, deposit_status")
    .eq("conversation_id", conversationId)
    .limit(5);

  return scoreFromSignals({
    conversationId,
    messages: messages.map((m) => ({
      sender_type: m.sender_type,
      content: m.content,
      created_at: m.created_at,
    })),
    tag: tag ?? null,
    reservations: reservations ?? [],
  });
}

export function scoreFromSignals(input: {
  conversationId: string;
  messages: {
    sender_type: string;
    content: string | null;
    created_at: string;
  }[];
  tag: {
    reservation: boolean;
    deposit: boolean;
    customer_lost: boolean;
    lost_reason: string | null;
    customer_replied: boolean;
    price_mentioned: boolean;
    price_accepted: boolean | null;
    conversation_length: number;
  } | null;
  reservations: { status: string; deposit_status: string }[];
}): ConversationQualityResult {
  const { conversationId, messages, tag, reservations } = input;

  const hasReservation = Boolean(
    tag?.reservation ||
      reservations.some((r) => RESERVATION_OK_STATUSES.has(r.status))
  );
  const hasDeposit = Boolean(
    tag?.deposit ||
      reservations.some((r) => DEPOSIT_OK_STATUSES.has(r.deposit_status))
  );

  const customerMsgs = messages.filter((m) => m.sender_type === "customer");
  const aiMsgs = messages.filter((m) => m.sender_type === "ai");
  const staffMsgs = messages.filter((m) => m.sender_type === "staff");
  const outbound = [...aiMsgs, ...staffMsgs];

  const allText = messages.map((m) => m.content ?? "").join("\n");
  const priceMentioned = tag?.price_mentioned ?? PRICE_RE.test(allText);
  const customerReplied =
    tag?.customer_replied ?? customerMsgs.length >= 2;
  const priceRejected =
    tag?.price_accepted === false ||
    customerMsgs.some((m) => REJECT_PRICE_RE.test(m.content ?? ""));
  const priceAccepted =
    tag?.price_accepted === true ||
    customerMsgs.some((m) => ACCEPT_RE.test(m.content ?? ""));

  const avgOutboundLen =
    outbound.length > 0
      ? outbound.reduce((s, m) => s + (m.content?.length ?? 0), 0) /
        outbound.length
      : 0;
  const tooLong = avgOutboundLen >= LONG_REPLY_CHARS;

  const lastCustomerAt = customerMsgs.at(-1)?.created_at;
  const lastOutboundAt = outbound.at(-1)?.created_at;
  const ghosted =
    Boolean(lastOutboundAt) &&
    (!lastCustomerAt ||
      new Date(lastOutboundAt!).getTime() >
        new Date(lastCustomerAt).getTime()) &&
    customerMsgs.length <= 1 &&
    outbound.length >= 1;

  const factors: QualityFactor[] = [];
  const issues: string[] = [];
  let score = 50;
  pushFactor(factors, "Başlangıç tabanı", 50);

  let primaryIssue: string | null = null;
  let lossReason: string | null = null;

  if (messages.length === 0) {
    score = 15;
    pushFactor(factors, "Boş konuşma", -35);
    issues.push("empty");
    primaryIssue = "Boş konuşma.";
    lossReason = "Boş konuşma";
  } else if (hasReservation) {
    score += 42;
    pushFactor(factors, "Rezervasyon alındı", 42);
    if (hasDeposit) {
      score += 5;
      pushFactor(factors, "Kapora doğrulandı", 5);
    }
  } else {
    if (hasDeposit) {
      score += 28;
      pushFactor(factors, "Kapora / depozito sinyali", 28);
    }
    if (priceMentioned) {
      score += 8;
      pushFactor(factors, "Fiyat paylaşıldı", 8);
    }
    if (priceAccepted && !priceRejected) {
      score += 10;
      pushFactor(factors, "Fiyat kabul sinyali", 10);
    }
    if (customerReplied) {
      score += 6;
      pushFactor(factors, "Müşteri devam etti", 6);
    }
    if ((tag?.conversation_length ?? messages.length) >= 6) {
      score += 4;
      pushFactor(factors, "Yeterli diyalog uzunluğu", 4);
    }

    if (ghosted || (!customerReplied && messages.length >= 2)) {
      score -= 28;
      pushFactor(factors, "Müşteri cevap vermedi", -28);
      issues.push("no_reply");
      primaryIssue = "Müşteri cevap vermedi.";
      lossReason = "Müşteri cevap vermedi";
    }
    if (tooLong) {
      score -= 18;
      pushFactor(factors, "Cevaplar çok uzun", -18);
      issues.push("too_long");
      if (!primaryIssue || score < 55) primaryIssue = "Çok uzun.";
      lossReason = lossReason ?? "Çok uzun cevap";
    }
    if (priceRejected || tag?.lost_reason === "price") {
      score -= 22;
      pushFactor(factors, "Fiyat itirazı / kayıp", -22);
      issues.push("price");
      primaryIssue = "Fiyatta kaybedildi.";
      lossReason = "Fiyatta kaybedildi";
    }
    if (tag?.lost_reason === "early_price") {
      score -= 14;
      pushFactor(factors, "Çok erken fiyat", -14);
      issues.push("early_price");
      primaryIssue = primaryIssue ?? "Çok erken fiyat.";
      lossReason = lossReason ?? "Çok erken fiyat";
    }
    if (tag?.lost_reason === "trust") {
      score -= 16;
      pushFactor(factors, "Güven oluşmadı", -16);
      issues.push("trust");
      primaryIssue = primaryIssue ?? "Güven oluşmadı.";
      lossReason = lossReason ?? "Güven oluşmadı";
    }
    if (tag?.lost_reason === "competitor") {
      score -= 12;
      pushFactor(factors, "Rakibe kayıp", -12);
      issues.push("competitor");
      primaryIssue = primaryIssue ?? "Rakibe kaybedildi.";
      lossReason = lossReason ?? "Rakibe kaybedildi";
    }
    if (tag?.customer_lost && !lossReason) {
      score -= 16;
      pushFactor(factors, "Kayıp etiketli konuşma", -16);
      issues.push("lost");
      primaryIssue = primaryIssue ?? "Kayıp konuşma.";
      lossReason = "Kayıp konuşma";
    }
  }

  // Tabanı factors'tan çıkarılmış gibi gösterme: score mutlak
  // factors içinde taban + deltalar; skor clamp
  const deltaSum = factors
    .filter((f) => f.label !== "Başlangıç tabanı")
    .reduce((s, f) => s + (f.sign === "+" ? f.delta : -f.delta), 0);
  score = clamp(Math.round(50 + deltaSum), 0, 100);
  if (hasReservation && score < 90) score = 92;

  const grade = gradeForScore(score, primaryIssue);
  const summary =
    primaryIssue ??
    (hasReservation
      ? "Rezervasyon alındı."
      : hasDeposit
        ? "Kapora alındı."
        : priceMentioned
          ? "Fiyat konuşuldu, sonuç açık."
          : "Devam eden / belirsiz.");

  const lastCustomerText =
    customerMsgs.at(-1)?.content ?? null;
  const suggestedReply =
    hasReservation || score >= 85
      ? null
      : buildSuggestedReply({
          lossReason,
          primaryIssue,
          lastCustomerText,
        });

  return {
    conversationId,
    score,
    grade,
    primaryIssue,
    issues,
    factors,
    summary,
    lossReason,
    suggestedReply,
  };
}

export async function upsertConversationQualityScore(
  supabase: TypedSupabase,
  result: ConversationQualityResult
): Promise<void> {
  const { error } = await supabase.from("conversation_quality_scores").upsert(
    {
      conversation_id: result.conversationId,
      score: result.score,
      grade: result.grade,
      primary_issue: result.primaryIssue,
      issues: result.issues,
      factors: result.factors as unknown as Json,
      summary: result.summary,
      loss_reason: result.lossReason,
      suggested_reply: result.suggestedReply,
      scored_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id" }
  );
  if (error) throw error;
}

/**
 * Yalnızca üretim Instagram konuşmalarını skorla (batch).
 */
export async function scoreInstagramConversations(
  supabase: TypedSupabase,
  options?: { limit?: number; onlyMissing?: boolean }
): Promise<{ scored: number; skippedNonProduction: number }> {
  const limit = options?.limit ?? 320;
  const onlyMissing = options?.onlyMissing ?? false;

  let ids = await listProductionInstagramConversationIds(supabase, { limit });
  const skippedNonProduction = Math.max(0, limit - ids.length);

  if (onlyMissing && ids.length > 0) {
    const { data: existing } = await supabase
      .from("conversation_quality_scores")
      .select("conversation_id")
      .in("conversation_id", ids);
    const have = new Set((existing ?? []).map((r) => r.conversation_id));
    ids = ids.filter((id) => !have.has(id));
  }

  let scored = 0;
  const CHUNK = 40;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);

    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, sender_type, content, created_at")
      .in("conversation_id", chunk)
      .order("created_at", { ascending: true });

    const { data: tags } = await supabase
      .from("conversation_outcome_tags")
      .select(
        "conversation_id, reservation, deposit, customer_lost, lost_reason, customer_replied, price_mentioned, price_accepted, conversation_length"
      )
      .in("conversation_id", chunk);

    const { data: reservations } = await supabase
      .from("reservations")
      .select("conversation_id, status, deposit_status")
      .in("conversation_id", chunk);

    const msgsBy = new Map<string, typeof msgs>();
    for (const m of msgs ?? []) {
      const list = msgsBy.get(m.conversation_id) ?? [];
      list.push(m);
      msgsBy.set(m.conversation_id, list);
    }
    const tagBy = new Map(
      (tags ?? []).map((t) => [t.conversation_id, t] as const)
    );
    const resBy = new Map<string, { status: string; deposit_status: string }[]>();
    for (const r of reservations ?? []) {
      if (!r.conversation_id) continue;
      const list = resBy.get(r.conversation_id) ?? [];
      list.push(r);
      resBy.set(r.conversation_id, list);
    }

    for (const id of chunk) {
      const result = scoreFromSignals({
        conversationId: id,
        messages: msgsBy.get(id) ?? [],
        tag: tagBy.get(id) ?? null,
        reservations: resBy.get(id) ?? [],
      });
      await upsertConversationQualityScore(supabase, result);
      scored += 1;
    }
  }

  return { scored, skippedNonProduction };
}

export type WorstConversationRow = {
  conversationId: string;
  score: number;
  grade: string;
  primaryIssue: string | null;
  summary: string | null;
  lossReason: string | null;
  factors: QualityFactor[];
  suggestedReply: string | null;
  contactName: string | null;
  externalConversationId: string | null;
};

function parseFactors(raw: unknown): QualityFactor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      if (typeof o.label !== "string" || typeof o.delta !== "number")
        return null;
      const sign = o.sign === "-" ? "-" : "+";
      return { label: o.label, delta: o.delta, sign } as QualityFactor;
    })
    .filter((x): x is QualityFactor => x != null);
}

/**
 * En kötü N üretim konuşması.
 */
export async function listWorstConversations(
  supabase: TypedSupabase,
  limit = 20
): Promise<WorstConversationRow[]> {
  const { data, error } = await supabase
    .from("conversation_quality_scores")
    .select(
      "conversation_id, score, grade, primary_issue, summary, factors, loss_reason, suggested_reply"
    )
    .order("score", { ascending: true })
    .limit(Math.max(limit * 4, 80));

  if (error) throw error;
  if (!data?.length) return [];

  const productionIds = new Set(
    await filterProductionConversationIds(
      supabase,
      data.map((r) => r.conversation_id)
    )
  );

  const filtered = data
    .filter((r) => productionIds.has(r.conversation_id))
    .slice(0, limit);
  if (filtered.length === 0) return [];

  const ids = filtered.map((r) => r.conversation_id);
  const { data: convs } = await supabase
    .from("conversations")
    .select(
      "id, external_conversation_id, contact_id, contact:contacts(full_name, username)"
    )
    .in("id", ids);

  const byId = new Map(
    (convs ?? []).map((c) => {
      const contact = c.contact as
        | { full_name: string | null; username: string | null }
        | { full_name: string | null; username: string | null }[]
        | null;
      const one = Array.isArray(contact) ? contact[0] : contact;
      return [
        c.id,
        {
          externalConversationId: c.external_conversation_id,
          contactName: one?.full_name ?? one?.username ?? null,
        },
      ] as const;
    })
  );

  return filtered.map((r) => {
    const meta = byId.get(r.conversation_id);
    return {
      conversationId: r.conversation_id,
      score: r.score,
      grade: r.grade,
      primaryIssue: r.primary_issue,
      summary: r.summary,
      lossReason: r.loss_reason,
      factors: parseFactors(r.factors),
      suggestedReply: r.suggested_reply,
      contactName: meta?.contactName ?? null,
      externalConversationId: meta?.externalConversationId ?? null,
    };
  });
}
