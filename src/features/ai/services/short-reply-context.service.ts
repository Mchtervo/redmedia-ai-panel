/**
 * Kısa müşteri cevaplarını tek başına intent sayma —
 * önceki AI sorusuna bağla.
 */

import type { ConversationMove } from "@/features/ai/services/conversation-strategist.service";
import type { StrategyId } from "@/features/ai/services/decision-engine.service";

export type HistoryMessage = {
  senderType: "customer" | "ai" | "staff" | string;
  content: string;
};

export type ShortReplyTopic =
  | "date"
  | "reference_offer"
  | "style"
  | "venue"
  | "generic_question"
  | "none";

export type ShortReplyKind =
  | "date_answer"
  | "agreement"
  | "disagreement"
  | "soft_defer"
  | "unclear"
  | "not_short";

export type ShortReplyResolution = {
  isShort: boolean;
  kind: ShortReplyKind;
  answeredTopic: ShortReplyTopic;
  previousAiQuestion: string | null;
  resolvedValue: string | null;
  suggestedMove: ConversationMove | null;
  suggestedStrategyId: StrategyId | null;
  rationale: string;
};

const SHORT_ACK_RE =
  /^(tamam|tamamdır|olur|olur\s*hocam|peki|evet|eyvallah|ok|okay|okey|tabii|tabi|süper|super|güzel|guzel|anladım|anladim|hmm+|hı+m+|hm+)([\s!.?,🙂😊👍]*)?$/i;

const SHORT_DEFER_RE =
  /^(bakarız|bakariz|düşünürüz|dusunuruz|eşime\s*soracağım|esime\s*soracagim|eşime\s*sorucam|esime\s*sorucam|sonra\s*yazarım|sonra\s*yazarim|bilemedim)([\s!.?,]*)?$/i;

const SHORT_NO_RE =
  /^(hayır|hayir|yok|istemiyorum|olmaz|gerek\s*yok)([\s!.?,]*)?$/i;

const RELATIVE_DATE_RE =
  /^(yarın|yarin|bugün|bugun|öbür\s*gün|obur\s*gun|haftaya|gelecek\s*hafta|bu\s*hafta|pazartesi|salı|sali|çarşamba|carsamba|perşembe|persembe|cuma|cumartesi|pazar)([\s!.?,]*)?$/i;

const DATE_PREFIX_RE =
  /^(yarın|yarin|bugün|bugun|öbür\s*gün|obur\s*gun|haftaya|gelecek\s*hafta)\b/i;

const ABSOLUTE_DATE_RE =
  /^(\d{1,2}\s*(?:ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)(?:\s*\d{4})?|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)([\s!.?,]*)?$/i;

const STYLE_ANSWER_RE =
  /^(sade|sinematik|doğal|dogal|dış\s*çekim|dis\s*cekim|salon)([\s!.?,]*)?$/i;

const CLARIFY_RE =
  /^(nasıl\s*yani|nasil\s*yani|ne\s*demek|ne\s*anlama|anlamadım|anlamadim)([\s!.?,]*)?$/i;

const DATE_ASK_RE =
  /(tarih|ne\s*zaman|hangi\s*gün|hangi\s*gun|müsait|musait|düğün\s*tarih|dugun\s*tarih)/i;

const REFERENCE_ASK_RE =
  /(örnek|ornek|referans|kesit|portföy|portfoy|göndereyim|gondereyim|atayım|atayim|göstereyim|gostereyim|paylaşayım|paylasayim)/i;

const STYLE_ASK_RE =
  /(sinematik|sade|doğal|dogal|dış\s*çekim|dis\s*cekim|salon|albüm|album|video|fotoğraf|fotograf)/i;

const VENUE_ASK_RE = /(mekân|mekan|salon|nerede|şehir|sehir|ankara|istanbul)/i;

export function isShortCustomerReply(message: string): boolean {
  const t = message.trim();
  if (!t || t.length > 48) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 5) return false;
  return (
    SHORT_ACK_RE.test(t) ||
    SHORT_DEFER_RE.test(t) ||
    SHORT_NO_RE.test(t) ||
    RELATIVE_DATE_RE.test(t) ||
    DATE_PREFIX_RE.test(t) ||
    ABSOLUTE_DATE_RE.test(t) ||
    STYLE_ANSWER_RE.test(t) ||
    CLARIFY_RE.test(t)
  );
}

function lastAiContent(history: HistoryMessage[]): string | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const m = history[i];
    if (!m) continue;
    if (m.senderType === "ai" || m.senderType === "staff") {
      const c = m.content?.trim();
      if (c) return c;
    }
  }
  return null;
}

function classifyAiTopic(aiText: string): ShortReplyTopic {
  if (DATE_ASK_RE.test(aiText)) return "date";
  if (REFERENCE_ASK_RE.test(aiText)) return "reference_offer";
  if (VENUE_ASK_RE.test(aiText) && /[?]/.test(aiText)) return "venue";
  if (STYLE_ASK_RE.test(aiText) && /[?]/.test(aiText)) return "style";
  if (/[?]/.test(aiText)) return "generic_question";
  return "none";
}

function stripTrail(msg: string): string {
  return msg.replace(/[.!?]+$/, "").trim();
}

/**
 * Kısa cevabı son AI mesajına bağla.
 */
export function resolveShortReplyContext(params: {
  customerMessage: string;
  recentMessages?: HistoryMessage[];
  lastAiReply?: string | null;
  dateHint?: string | null;
}): ShortReplyResolution {
  const msg = params.customerMessage.trim();
  const history = params.recentMessages ?? [];
  const previousAi =
    params.lastAiReply?.trim() || lastAiContent(history) || null;
  const topic = previousAi ? classifyAiTopic(previousAi) : "none";

  const datePrefix = msg.match(DATE_PREFIX_RE)?.[1] ?? null;
  const isDateToken =
    RELATIVE_DATE_RE.test(msg) ||
    ABSOLUTE_DATE_RE.test(msg) ||
    Boolean(datePrefix);
  const isShort = isShortCustomerReply(msg);

  if (!isShort && !isDateToken && !STYLE_ANSWER_RE.test(msg) && !CLARIFY_RE.test(msg)) {
    return {
      isShort: false,
      kind: "not_short",
      answeredTopic: "none",
      previousAiQuestion: previousAi,
      resolvedValue: null,
      suggestedMove: null,
      suggestedStrategyId: null,
      rationale: "Kısa cevap değil — normal intent.",
    };
  }

  // 0) "Nasıl yani" — önceki soruyu tekrar etme, netleştir
  if (CLARIFY_RE.test(msg)) {
    return {
      isShort: true,
      kind: "unclear",
      answeredTopic: topic,
      previousAiQuestion: previousAi,
      resolvedValue: "needs_clarification",
      suggestedMove: "ask_one_question",
      suggestedStrategyId: "INFO_ONE_QUESTION_v2",
      rationale: "Müşteri anlamadı — kısa netleştir, aynı soruyu döndürme.",
    };
  }

  // 1) Açık tarih token'ı / "Yarın dış çekim"
  if (isDateToken) {
    return {
      isShort: true,
      kind: "date_answer",
      answeredTopic: "date",
      previousAiQuestion: previousAi,
      resolvedValue: datePrefix
        ? datePrefix
        : stripTrail(msg),
      suggestedMove: "ask_one_question",
      suggestedStrategyId: "DATE_CONFIRM_v1",
      rationale:
        topic === "date"
          ? "Önceki tarih sorusuna tarih cevabı."
          : "Tarih ifadesi algılandı.",
    };
  }

  // 1b) Stil cevabı: Sade / Sinematik (Tamam/olur ACK değil)
  if (
    STYLE_ANSWER_RE.test(msg) ||
    (topic === "style" &&
      msg.length <= 24 &&
      !SHORT_ACK_RE.test(msg) &&
      !SHORT_DEFER_RE.test(msg) &&
      !SHORT_NO_RE.test(msg))
  ) {
    return {
      isShort: true,
      kind: "agreement",
      answeredTopic: "style",
      previousAiQuestion: previousAi,
      resolvedValue: stripTrail(msg).toLocaleLowerCase("tr-TR"),
      suggestedMove: "ask_one_question",
      suggestedStrategyId: "INFO_ONE_QUESTION_v2",
      rationale: "Stil cevabı alındı — tekrar sinematik/sade sorma.",
    };
  }

  // 2) Erteleme
  if (SHORT_DEFER_RE.test(msg)) {
    return {
      isShort: true,
      kind: "soft_defer",
      answeredTopic: topic,
      previousAiQuestion: previousAi,
      resolvedValue: null,
      suggestedMove: "wait",
      suggestedStrategyId: "WAIT_SPACE_v1",
      rationale: "Erteleme — alan bırak.",
    };
  }

  // 3) Red
  if (SHORT_NO_RE.test(msg)) {
    return {
      isShort: true,
      kind: "disagreement",
      answeredTopic: topic,
      previousAiQuestion: previousAi,
      resolvedValue: null,
      suggestedMove: "empathy_only",
      suggestedStrategyId: "EMPATHY_HOLD_v1",
      rationale: "Red — baskısız empati.",
    };
  }

  // 4) Kısa onay
  if (SHORT_ACK_RE.test(msg)) {
    if (topic === "reference_offer") {
      return {
        isShort: true,
        kind: "agreement",
        answeredTopic: "reference_offer",
        previousAiQuestion: previousAi,
        resolvedValue: "accepted_reference",
        suggestedMove: "show_example",
        suggestedStrategyId: "SHOW_EXAMPLE_v1",
        rationale: "Referans teklifi onaylandı.",
      };
    }
    const greetingLike =
      !previousAi ||
      /merhaba|hoş geldiniz|hos geldiniz|selam|nasıl bir çekim|nasil bir cekim/i.test(
        previousAi
      );
    if (topic === "none" || greetingLike) {
      return {
        isShort: true,
        kind: "unclear",
        answeredTopic: topic === "none" ? "none" : topic,
        previousAiQuestion: previousAi,
        resolvedValue: null,
        suggestedMove: "wait",
        suggestedStrategyId: "WAIT_SPACE_v1",
        rationale: "Selamlama sonrası / bağlamsız kısa onay — satış hamlesi yok.",
      };
    }
    return {
      isShort: true,
      kind: "agreement",
      answeredTopic: topic,
      previousAiQuestion: previousAi,
      resolvedValue: "ack",
      suggestedMove: "ask_one_question",
      suggestedStrategyId: "INFO_ONE_QUESTION_v2",
      rationale: "Kısa onay — yumuşak devam, tarih/fiyat dump yok.",
    };
  }

  return {
    isShort: true,
    kind: "unclear",
    answeredTopic: topic,
    previousAiQuestion: previousAi,
    resolvedValue: null,
    suggestedMove: "wait",
    suggestedStrategyId: "WAIT_SPACE_v1",
    rationale: "Kısa cevap çözülemedi — güvenli fallback.",
  };
}

/** Memory'ye yazılacak tarih ipucu (relative dahil). */
export function extractShortDateHint(message: string): string | null {
  const t = message.trim();
  const prefix = t.match(DATE_PREFIX_RE)?.[1];
  if (prefix) return prefix;
  if (RELATIVE_DATE_RE.test(t) || ABSOLUTE_DATE_RE.test(t)) {
    return stripTrail(t);
  }
  return null;
}

export function aiAlreadyOfferedReference(aiText: string | null | undefined): boolean {
  if (!aiText) return false;
  return /örnek\s*atayım|ornek\s*atayim|referans\s*kesit|benzer\s*(bir\s*)?(çekim|düğün)/i.test(
    aiText
  );
}

export function shortReplyToJson(
  r: ShortReplyResolution
): Record<string, unknown> {
  return { ...r };
}
