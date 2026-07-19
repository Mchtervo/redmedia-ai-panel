/**
 * Reply Validator — template kuralları. Fail → mesaj gönderilmez (fallback kullanılır).
 */

import type { DecisionPack } from "@/features/ai/services/decision-engine.service";
import type { ReplyTemplate } from "@/features/ai/services/reply-template.engine";
import type { ShortReplyResolution } from "@/features/ai/services/short-reply-context.service";

export type ValidationViolation =
  | "missing_cta"
  | "missing_reference"
  | "question_count"
  | "price_not_allowed"
  | "strategy_drift"
  | "semantic_relevance"
  | "too_long"
  | "empty";

export type ReplyValidationResult =
  | { ok: true }
  | { ok: false; violations: ValidationViolation[]; detail: string[] };

const CTA_RE =
  /(yazın|yazin|atayım|atayim|ileteyim|netleştirelim|netlestirelim|devam edelim|örnek at|ornek at|iban|kapora|not düş|not dus|hangisine|ister misiniz|ister misin\b|çıkarayım|cikarayim|göndereyim|gondereyim|söyleyin|soyleyin)/i;

const REFERENCE_RE =
  /(örnek|ornek|referans|benzer|kesit|çift|cift|portföy|portfoy|daha önce|daha once|instagram|gösterebilir|gosterebilir|atayım|atayim)/i;

const CATALOG_PRICE_RE = /11\.?000|14\.?000|21\.?000/;
/** Eski seed/pitch: 12k / 15k paket — katalog değil, her zaman reject. */
const LEGACY_PACKAGE_PRICE_RE = /(?<![.\d])(?:12|15)\.?000\b/;
const ANY_PRICE_RE = /11\.?000|14\.?000|21\.?000|\d{2}\.?\d{3}\s*(tl|₺)?/i;

/** Strateji dışı drift — yasak intent'ler. */
function strategyDrift(
  reply: string,
  pack: DecisionPack,
  template: ReplyTemplate
): string | null {
  const r = reply.toLocaleLowerCase("tr-TR");

  if (LEGACY_PACKAGE_PRICE_RE.test(reply)) {
    return "Eski paket fiyatı (12/15k) — katalog dışı.";
  }

  if (
    !template.allowPrice &&
    ANY_PRICE_RE.test(reply) &&
    pack.strategyId !== "GIVE_PRICE_SHORT_v2"
  ) {
    return "Fiyat yasak stratejide rakam var.";
  }

  if (
    template.allowPrice &&
    ANY_PRICE_RE.test(reply) &&
    !CATALOG_PRICE_RE.test(reply)
  ) {
    return "Fiyat var ama katalog paket (11/14/21) yok.";
  }

  if (
    pack.strategyId === "WAIT_SPACE_v1" &&
    /kapora\s*yat|hemen\s*karar|bugün\s*kilit|bugun\s*kilit/i.test(reply)
  ) {
    return "WAIT stratejisinde baskılı kapanış.";
  }

  if (
    pack.strategyId === "EMPATHY_HOLD_v1" &&
    (/11\.?000|14\.?000|21\.?000/.test(reply) || /paketlerimiz/i.test(reply))
  ) {
    return "EMPATHY stratejisinde paket/fiyat dump.";
  }

  if (
    pack.strategyId === "ASK_DEPOSIT_v1" &&
    !/kapora|iban|dekont|tarih/i.test(r)
  ) {
    return "ASK_DEPOSIT stratejisinde kapora/tarih yok.";
  }

  if (
    pack.strategyId === "SHOW_EXAMPLE_v1" &&
    template.requireReference &&
    !REFERENCE_RE.test(reply)
  ) {
    return "Referans stratejisinde örnek/referans yok.";
  }

  // Serbest deneme / indirim uydurma
  if (/özel fiyat|ozel fiyat|size özel indirim|size ozel indirim/i.test(reply)) {
    return "Uydurma özel fiyat.";
  }

  return null;
}

function countQuestionMarks(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

/**
 * Semantic soru sayacı: `?` + sonda mi/mı kalıbı (tek ? ile çift soru yakalama sınırlı).
 */
export function countQuestionsSemantic(text: string): number {
  const marks = countQuestionMarks(text);
  if (marks > 0) return marks;
  // Soru işareti yok ama soru kipinde cümle
  if (/\b(mi|mı|mu|mü)\b\s*$/i.test(text.trim())) return 1;
  return 0;
}

const DATE_QUESTION_RE =
  /(tarih(?:iniz)?\s*net|hangi\s*tarih|ne\s*zaman|düğün\s*tarih|dugun\s*tarih)/i;

/**
 * Cevap müşteri mesajı + önceki AI sorusuyla mantıken bağlı mı?
 */
export function validateSemanticRelevance(params: {
  reply: string;
  pack: DecisionPack;
  customerMessage: string;
  shortReply?: ShortReplyResolution | null;
  dateHint?: string | null;
  styleHint?: string | null;
  referenceAlreadyOffered?: boolean;
}): ReplyValidationResult {
  const text = params.reply.trim();
  const msg = params.customerMessage.trim();
  const short = params.shortReply;
  const violations: ValidationViolation[] = [];
  const detail: string[] = [];

  if (short?.kind === "date_answer" || /^(yarın|yarin|bugün|bugun)\b/i.test(msg)) {
    if (DATE_QUESTION_RE.test(text)) {
      violations.push("semantic_relevance");
      detail.push("Tarih cevabı verildi; AI yeniden tarih soruyor.");
    }
    if (params.pack.strategyId === "SHOW_EXAMPLE_v1") {
      violations.push("semantic_relevance");
      detail.push("Tarih cevabında SHOW_EXAMPLE seçilmiş.");
    }
  }

  if (params.dateHint && DATE_QUESTION_RE.test(text)) {
    violations.push("semantic_relevance");
    detail.push("Memory'de tarih varken tekrar tarih soruluyor.");
  }

  if (
    params.pack.strategyId === "SHOW_EXAMPLE_v1" &&
    short?.isShort &&
    short.answeredTopic !== "reference_offer" &&
    !/örnek|ornek|referans/i.test(msg)
  ) {
    violations.push("semantic_relevance");
    detail.push("Referans istemeden SHOW_EXAMPLE.");
  }

  if (
    short?.kind === "unclear" &&
    short.answeredTopic === "none" &&
    (DATE_QUESTION_RE.test(text) ||
      /11\.?000|14\.?000|21\.?000|kapora|paket/i.test(text) ||
      /referans|örnek kesit|ornek kesit/i.test(text))
  ) {
    violations.push("semantic_relevance");
    detail.push("Bağlamsız kısa onayda satış/tarih/referans hamlesi.");
  }

  if (
    short?.kind === "agreement" &&
    short.answeredTopic === "reference_offer" &&
    DATE_QUESTION_RE.test(text)
  ) {
    violations.push("semantic_relevance");
    detail.push("Referans onayında tarih sorusu patladı.");
  }

  const styleKnown =
    params.styleHint ||
    (short?.answeredTopic === "style" ? short.resolvedValue : null);
  if (
    styleKnown &&
    /sinematik\s*mi|sade\s*mi|doğal\s*mı|dogal\s*mi/i.test(text)
  ) {
    violations.push("semantic_relevance");
    detail.push("Stil zaten belli; sinematik/sade tekrar soruluyor.");
  }

  if (
    params.referenceAlreadyOffered &&
    /örnek\s*atayım|ornek\s*atayim|benzer\s*(bir\s*)?çekimden\s*kısa/i.test(
      text
    )
  ) {
    violations.push("semantic_relevance");
    detail.push("Aynı referans teklifi tekrarlanıyor.");
  }

  if (
    short?.resolvedValue === "needs_clarification" &&
    styleKnown &&
    /sinematik\s*mi|sade\s*mi/i.test(text)
  ) {
    violations.push("semantic_relevance");
    detail.push("Nasıl yani cevabında stil sorusu tekrarlandı.");
  }

  if (violations.length > 0) {
    return { ok: false, violations, detail };
  }
  return { ok: true };
}

export function validateTemplatedReply(params: {
  reply: string;
  template: ReplyTemplate;
  pack: DecisionPack;
  customerMessage?: string;
  shortReply?: ShortReplyResolution | null;
  dateHint?: string | null;
  styleHint?: string | null;
  referenceAlreadyOffered?: boolean;
}): ReplyValidationResult {
  const { reply, template, pack } = params;
  const text = reply.trim();
  const violations: ValidationViolation[] = [];
  const detail: string[] = [];

  if (!text) {
    return {
      ok: false,
      violations: ["empty"],
      detail: ["Boş cevap."],
    };
  }

  const words = text.split(/\s+/).filter(Boolean).length;
  if (words > template.maxWords) {
    violations.push("too_long");
    detail.push(`Kelime ${words} > max ${template.maxWords}.`);
  }

  if (template.requireCta && !CTA_RE.test(text)) {
    violations.push("missing_cta");
    detail.push("CTA yok.");
  }

  if (template.requireReference && !REFERENCE_RE.test(text)) {
    violations.push("missing_reference");
    detail.push("Referans/sosyal kanıt yok.");
  }

  const q = countQuestionsSemantic(text);
  if (template.requireQuestion) {
    if (q !== 1) {
      violations.push("question_count");
      detail.push(`Soru sayısı ${q}, beklenen 1.`);
    }
  } else if (q > 0) {
    violations.push("question_count");
    detail.push(`Soru yasak, bulunan ${q}.`);
  }

  if (LEGACY_PACKAGE_PRICE_RE.test(text)) {
    violations.push("price_not_allowed");
    detail.push("Eski paket fiyatı (12/15k) yasak.");
  } else if (!template.allowPrice && ANY_PRICE_RE.test(text)) {
    violations.push("price_not_allowed");
    detail.push("Fiyat/rakam yasak.");
  } else if (
    template.allowPrice &&
    ANY_PRICE_RE.test(text) &&
    !CATALOG_PRICE_RE.test(text)
  ) {
    violations.push("price_not_allowed");
    detail.push("Yalnızca katalog paket fiyatı (11/14/21).");
  }

  // Doğrulanmamış kampanya / hediye — prompttan uydurma yasak
  if (
    /%20|yüzde\s*20|yuzde\s*20|erken\s*rezervasyon/i.test(text) ||
    (/drone/i.test(text) && /hediye/i.test(text))
  ) {
    violations.push("price_not_allowed");
    detail.push("Doğrulanmamış %20 / drone hediye yazılamaz.");
  }

  if (
    template.strategyId === "GREETING_ACK_v1" &&
    /(paket|kapora|11\.?000|14\.?000|21\.?000|albüm\s*set|album\s*set)/i.test(
      text
    )
  ) {
    violations.push("strategy_drift");
    detail.push("Greeting'de paket/fiyat dump.");
  }

  const drift = strategyDrift(text, pack, template);
  if (drift) {
    violations.push("strategy_drift");
    detail.push(drift);
  }

  if (params.customerMessage) {
    const semantic = validateSemanticRelevance({
      reply: text,
      pack,
      customerMessage: params.customerMessage,
      shortReply: params.shortReply,
      dateHint: params.dateHint,
      styleHint: params.styleHint,
      referenceAlreadyOffered: params.referenceAlreadyOffered,
    });
    if (!semantic.ok) {
      violations.push(...semantic.violations);
      detail.push(...semantic.detail);
    }
  }

  if (violations.length > 0) {
    return { ok: false, violations, detail };
  }
  return { ok: true };
}
