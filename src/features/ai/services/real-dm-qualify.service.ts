/**
 * Gerçek müşteri DM filtreleme — spam / arkadaş / alakasız / sistem mesajı elenir.
 */

export type QualifyRejectReason =
  | "spam"
  | "friend_chat"
  | "irrelevant"
  | "system_auto"
  | "ad_notification"
  | "too_short"
  | "no_customer";

export type QualifyResult =
  | { ok: true }
  | { ok: false; reason: QualifyRejectReason };

const SPAM_RE =
  /crypto|forex|bet\b|bahis|onlyfans|nude|sexy|follow\s*back|kazanç|para\s*kazan|tıkla\s*kazan|dm\s*for\s*promo|reklam\s*işbirliği\s*ücretli/i;

const FRIEND_RE =
  /napıyon|naber|napıyorsun|görüşelim mi|kahve içelim|akşam çık|özledim|iyi geceler aşk|canım benim|kanka\s+nerdesin/i;

const SYSTEM_RE =
  /^(story mentioned you|mentioned you in|you started a conversation|mesaj isteği|message request|accepted your message|otomatik yanıt)/i;

const AD_RE =
  /reklamınız|ad\s*account|boost\s*post|kampanya\s*onay|instagram\s*ads|meta\s*business/i;

const WEDDING_SIGNAL_RE =
  /düğün|nişan|kına|after|plato|video|çekim|album|albüm|fiyat|paket|kapora|organizasyon|gelin|damat|drone|sinema/i;

/**
 * Konuşma metni + mesaj sayısına göre gerçek satış adayı mı?
 */
export function qualifyRealCustomerConversation(params: {
  messages: { sender_type: string; content: string | null }[];
}): QualifyResult {
  const msgs = params.messages.filter((m) => (m.content ?? "").trim());
  if (msgs.length === 0) return { ok: false, reason: "too_short" };

  const customer = msgs.filter((m) => m.sender_type === "customer");
  if (customer.length === 0) return { ok: false, reason: "no_customer" };

  const joined = msgs.map((m) => m.content ?? "").join("\n");
  const customerJoined = customer.map((m) => m.content ?? "").join("\n");

  if (SYSTEM_RE.test(customerJoined.trim()) || msgs.every((m) => SYSTEM_RE.test((m.content ?? "").trim()))) {
    return { ok: false, reason: "system_auto" };
  }
  if (AD_RE.test(joined)) return { ok: false, reason: "ad_notification" };
  if (SPAM_RE.test(customerJoined)) return { ok: false, reason: "spam" };

  // Tek emoji / "selam" ve satış sinyali yok
  const substantive = customer.filter((m) => {
    const t = (m.content ?? "").trim();
    return t.length >= 8 || WEDDING_SIGNAL_RE.test(t);
  });
  if (substantive.length === 0 && msgs.length < 3) {
    return { ok: false, reason: "too_short" };
  }

  // Arkadaş sohbeti: samimi + düğün/satış sinyali yok
  if (FRIEND_RE.test(customerJoined) && !WEDDING_SIGNAL_RE.test(joined)) {
    return { ok: false, reason: "friend_chat" };
  }

  // Alakasız: uzun konuşma ama hiç düğün/hizmet sinyali yok
  if (msgs.length >= 6 && !WEDDING_SIGNAL_RE.test(joined)) {
    return { ok: false, reason: "irrelevant" };
  }

  return { ok: true };
}
