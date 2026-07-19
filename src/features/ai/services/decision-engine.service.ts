/**
 * Decision Engine — kod analiz eder + strateji seçer; GPT yalnızca metni yazar.
 *
 * Akış: Sales Brain → Strategist move → Decision Pack (strategyId) → GPT writer
 */

import type { SalesBrainSnapshot } from "@/features/ai/services/sales-brain.service";
import {
  decideConversationStrategy,
  type ConversationMove,
  type ConversationStrategy,
} from "@/features/ai/services/conversation-strategist.service";
import { hasExplicitPriceIntent } from "@/features/ai/services/message-intent";
import {
  aiAlreadyOfferedReference,
  type ShortReplyResolution,
} from "@/features/ai/services/short-reply-context.service";

/** Versioned strategy playbooks — GPT bunları icat etmez. */
export const STRATEGY_IDS = [
  "GREETING_ACK_v1",
  "PRICE_DEFENSE_v3",
  "TRUST_BUILD_v2",
  "GIVE_PRICE_SHORT_v2",
  "SHOW_EXAMPLE_v1",
  "OBJECTION_RESOLVE_v2",
  "EMPATHY_HOLD_v1",
  "SOFT_CLOSE_v2",
  "ASK_DEPOSIT_v1",
  "INFO_ONE_QUESTION_v2",
  "DATE_CONFIRM_v1",
  "WAIT_SPACE_v1",
] as const;

export type StrategyId = (typeof STRATEGY_IDS)[number];

export type ConversationRisk =
  | "Fiyat"
  | "Güven"
  | "Kararsızlık"
  | "Bilgi"
  | "Zaman"
  | "Gerilim"
  | "Yok";

export type DecisionAnalysis = {
  personaLabel: string;
  stageLabel: string;
  leadTemperature: number;
  risk: ConversationRisk;
};

export type DecisionPack = {
  analysis: DecisionAnalysis;
  strategyId: StrategyId;
  move: ConversationMove;
  allowPrice: boolean;
  allowQuestion: boolean;
  maxWords: number;
  maxQuestions: number;
  requireSocialProof: boolean;
  requireCta: boolean;
  /** GPT'ye madde madde ne yazacağı — düşünme yok. */
  writerBrief: string[];
  /** Personel DM tarzı örnekler (taklit et, kopyalama). */
  naturalExamples: string[];
  rationale: string;
  /** Strategist uyumu */
  conversationStrategy: ConversationStrategy;
};

/** GPT kokan kalıplar — yazdırma / temizle. */
export const GPT_FILLER_PHRASES = [
  "harika",
  "çok normal",
  "heyecanınızı paylaşıyoruz",
  "heyecanınızı paylaşıyorum",
  "birçok çift",
  "kararsız kalmanız normal",
  "anlayışla karşılıyorum",
  "kesinlikle kelime",
  "tabii ki yardımcı olurum",
  "memnuniyetle yardımcı",
  "bu konuda size yardımcı",
  "anlıyorum sizi",
  "çok güzel bir seçim",
  "harika bir karar",
  "endişelenmeyin",
  "içiniz rahat olsun",
] as const;

const PERSONA_LABELS: Record<string, string> = {
  price: "Fiyat odaklı",
  quality: "Kalite odaklı",
  trust: "Güven arayan",
  undecided: "Kararsız",
  ready: "Hazır",
  romantic: "Romantik",
  logical: "Mantıklı",
};

const STAGE_LABELS: Record<string, string> = {
  greeting: "Selamlama",
  discovery: "Keşif",
  trust_building: "Güven",
  needs: "İhtiyaç",
  price: "Fiyat",
  objection: "İtiraz",
  close: "Kapanış",
  deposit: "Kapora",
  follow_up: "Takip",
};

function mapStage(brain: SalesBrainSnapshot): string {
  const s = brain.state;
  if (s === "greeting") return STAGE_LABELS.greeting!;
  if (s === "need_discovery") return STAGE_LABELS.discovery!;
  if (s === "trust" || s === "value") return STAGE_LABELS.trust_building!;
  if (s === "price") return STAGE_LABELS.price!;
  if (s === "objection" || brain.objective === "resolve_objection")
    return STAGE_LABELS.objection!;
  if (s === "closing") return STAGE_LABELS.close!;
  if (s === "deposit") return STAGE_LABELS.deposit!;
  if (s === "follow_up") return STAGE_LABELS.follow_up!;
  if (brain.mainBlocker === "price" && brain.scores.priceSensitivity >= 60)
    return STAGE_LABELS.objection!;
  if (brain.objective === "build_trust") return STAGE_LABELS.trust_building!;
  if (brain.objective === "give_price") return STAGE_LABELS.price!;
  return STAGE_LABELS.needs!;
}

function mapRisk(brain: SalesBrainSnapshot, upset: boolean): ConversationRisk {
  if (upset) return "Gerilim";
  if (brain.mainBlocker === "price" || brain.scores.priceSensitivity >= 65)
    return "Fiyat";
  if (brain.mainBlocker === "trust" || brain.scores.trust < 40) return "Güven";
  if (brain.mainBlocker === "indecision" || brain.persona === "undecided")
    return "Kararsızlık";
  if (brain.mainBlocker === "timing") return "Zaman";
  if (brain.mainBlocker === "info") return "Bilgi";
  return "Yok";
}

function leadTemperature(brain: SalesBrainSnapshot): number {
  const t =
    brain.scores.purchaseIntent * 0.45 +
    brain.scores.urgency * 0.25 +
    brain.scores.trust * 0.2 +
    (100 - brain.scores.priceSensitivity) * 0.1;
  return Math.max(0, Math.min(100, Math.round(t)));
}

function asksPrice(message: string): boolean {
  return hasExplicitPriceIntent(message);
}

function looksUpset(message: string): boolean {
  return /sinir|kızdım|kötü|berbat|saçma|yeter|bıktım|rahatsız/i.test(message);
}

type StrategySpec = {
  id: StrategyId;
  writerBrief: string[];
  naturalExamples: string[];
  requireSocialProof: boolean;
  requireCta: boolean;
  maxWords: number;
};

const SPECS: Record<StrategyId, StrategySpec> = {
  GREETING_ACK_v1: {
    id: "GREETING_ACK_v1",
    requireSocialProof: false,
    requireCta: false,
    maxWords: 35,
    writerBrief: [
      "1–2 kısa cümle.",
      "Fiyat/paket/indirim/drone/kapora YASAK.",
      "Tek ihtiyaç sorusu (dış çekim / düğün günü vb.).",
    ],
    naturalExamples: [
      "Merhaba, hoş geldiniz. Dış çekim mi yoksa düğün günü çekimi mi düşünüyorsunuz?",
      "Selam. Nasıl bir çekim bakıyorsunuz?",
    ],
  },
  PRICE_DEFENSE_v3: {
    id: "PRICE_DEFENSE_v3",
    requireSocialProof: true,
    requireCta: true,
    maxWords: 120,
    writerBrief: [
      "Fiyatı savunma / indirim uydurma YOK.",
      "Kısa empati (1 yarım cümle, kalıp yok).",
      "Değer: neyin dahil olduğunu 1 satır (katalogdan).",
      "Sosyal kanıt: abartısız, sahte kota yok (örn. benzer tarihte çeken çiftler).",
      "Tek soru + net CTA (tarih / paket tercihi / devam).",
    ],
    naturalExamples: [
      "Bütçe kısmı önemli haklısınız. Premium'da kapora+plato dahil; video ağırlıklı mı bakıyorsunuz, albüm de olsun mu?",
      "Rakam yüksek gelebilir — Basic ile Premium farkı albüm/kurgu tarafında. Tarihiniz net mi, ona göre netleştirelim?",
    ],
  },
  TRUST_BUILD_v2: {
    id: "TRUST_BUILD_v2",
    requireSocialProof: true,
    requireCta: true,
    maxWords: 90,
    writerBrief: [
      "Fiyat YOK.",
      "Kısa güven + 1 somut örnek teklifi.",
      "Tek soru (tarih veya neyin önemli olduğu).",
      "CTA: örnek göndermek / devam.",
    ],
    naturalExamples: [
      "Benzer bir düğünden kısa bir kesit atayım mı? Sizin için video mu yoksa fotoğraf mı daha önde?",
    ],
  },
  GIVE_PRICE_SHORT_v2: {
    id: "GIVE_PRICE_SHORT_v2",
    requireSocialProof: false,
    requireCta: true,
    maxWords: 100,
    writerBrief: [
      "Katalog rakamları: 11.000 / 14.000 / 21.000 — uydurma yok.",
      "Tek paket odağı veya kısa üçlü; dump yok.",
      "Tek soru + CTA (hangi paket / tarih).",
    ],
    naturalExamples: [
      "Basic 11.000, Premium Albümlü 14.000, Elite 21.000. Albüm sizin için önemli mi, yoksa daha çok video tarafı mı?",
    ],
  },
  SHOW_EXAMPLE_v1: {
    id: "SHOW_EXAMPLE_v1",
    requireSocialProof: true,
    requireCta: true,
    maxWords: 80,
    writerBrief: [
      "Örnek/referans teklif et; fiyat listesi yapıştırma.",
      "Tek soru (stil / tarih).",
      "CTA: örnek atmak.",
    ],
    naturalExamples: [
      "İsterseniz benzer bir çekimden 1 kısa örnek atayım. Daha sinematik mi bakıyorsunuz, yoksa sade mi?",
    ],
  },
  OBJECTION_RESOLVE_v2: {
    id: "OBJECTION_RESOLVE_v2",
    requireSocialProof: true,
    requireCta: true,
    maxWords: 110,
    writerBrief: [
      "İtirazı kabul et, savunmacı olma.",
      "Tek net fark / çözüm (katalog içi).",
      "Sosyal kanıt hafif.",
      "Tek soru + CTA.",
    ],
    naturalExamples: [
      "Karşılaştırma yapmanız normal. Bizde tek ekip + kurgu birlikte yürüyor. Sizin tarihe özel net teklif çıkarayım mı?",
    ],
  },
  EMPATHY_HOLD_v1: {
    id: "EMPATHY_HOLD_v1",
    requireSocialProof: false,
    requireCta: false,
    maxWords: 40,
    writerBrief: [
      "Sadece kısa empati / onay.",
      "Fiyat yok, soru yok, paket yok.",
      "İnsan gibi; kalıp cümle yok.",
    ],
    naturalExamples: ["Haklısınız, sinir bozucu olmuş. Nasıl ilerleyelim istersiniz?"],
  },
  SOFT_CLOSE_v2: {
    id: "SOFT_CLOSE_v2",
    requireSocialProof: false,
    requireCta: true,
    maxWords: 70,
    writerBrief: [
      "Baskısız kapanış.",
      "Tek net sonraki adım (tarih / telefon / kapora bilgisinden biri).",
      "Tek soru veya yumuşak CTA.",
    ],
    naturalExamples: [
      "İsterseniz tarihi not düşeyim, netleşince kapora adımını da yazarım. Tarih net mi sizin tarafta?",
    ],
  },
  ASK_DEPOSIT_v1: {
    id: "ASK_DEPOSIT_v1",
    requireSocialProof: false,
    requireCta: true,
    maxWords: 80,
    writerBrief: [
      "Kapora / tarih kilidine yönlendir.",
      "Kısa, net, baskısız.",
      "Tek CTA.",
    ],
    naturalExamples: [
      "Tarihi tutmak için kapora adımı gerekiyor; IBAN'ı atayım mı, yoksa önce saati netleştirelim mi?",
    ],
  },
  INFO_ONE_QUESTION_v2: {
    id: "INFO_ONE_QUESTION_v2",
    requireSocialProof: false,
    requireCta: true,
    maxWords: 60,
    writerBrief: [
      "Bilgi dump YOK.",
      "En fazla 1 net soru.",
      "Kısa, personel DM tarzı.",
    ],
    naturalExamples: [
      "17 Ağustos mu hocam? O tarih güzel 😊 Mekân Ankara'da mı?",
      "Size bir şey soracağım; albüm sizin için önemli mi, yoksa daha çok video tarafı mı?",
    ],
  },
  DATE_CONFIRM_v1: {
    id: "DATE_CONFIRM_v1",
    requireSocialProof: false,
    requireCta: true,
    maxWords: 50,
    writerBrief: [
      "Tarihi yansıt / onayla.",
      "Tek takip sorusu (mekan veya paket).",
    ],
    naturalExamples: ["17 Ağustos mu hocam? O tarih güzel 😊 Mekân belli mi?"],
  },
  WAIT_SPACE_v1: {
    id: "WAIT_SPACE_v1",
    requireSocialProof: false,
    requireCta: false,
    maxWords: 35,
    writerBrief: [
      "Baskı yok.",
      "Kısa onay; alan bırak.",
      "Soru yok.",
    ],
    naturalExamples: ["Tamam, siz netleşince yazın yeter."],
  },
};

function customerAskedReference(message: string): boolean {
  return /örnek|ornek|referans|portföy|portfoy|kesit\s*at|video\s*var\s*mı/i.test(
    message
  );
}

function messageLooksLikeDateAnswer(message: string): boolean {
  return /^(yarın|yarin|bugün|bugun|haftaya)|(\d{1,2}\s*(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)|\d{1,2}[./]\d{1,2})/i.test(
    message.trim()
  );
}

function pickStrategyId(
  move: ConversationMove,
  brain: SalesBrainSnapshot,
  risk: ConversationRisk,
  message: string,
  shortReply?: ShortReplyResolution | null
): StrategyId {
  if (shortReply?.suggestedStrategyId) {
    return shortReply.suggestedStrategyId;
  }
  if (move === "greeting_ack") return "GREETING_ACK_v1";
  if (move === "empathy_only") return "EMPATHY_HOLD_v1";
  if (move === "wait") return "WAIT_SPACE_v1";
  if (move === "ask_deposit") return "ASK_DEPOSIT_v1";
  if (move === "soft_close") return "SOFT_CLOSE_v2";
  if (move === "show_example") return "SHOW_EXAMPLE_v1";
  if (move === "build_trust" || move === "withhold_price") {
    if (risk === "Fiyat" || asksPrice(message)) return "PRICE_DEFENSE_v3";
    return "TRUST_BUILD_v2";
  }
  if (move === "resolve_objection") {
    if (risk === "Fiyat") return "PRICE_DEFENSE_v3";
    return "OBJECTION_RESOLVE_v2";
  }
  // Sert: give_price yalnızca açık fiyat niyetiyle
  if (move === "give_price") {
    return asksPrice(message) ? "GIVE_PRICE_SHORT_v2" : "GREETING_ACK_v1";
  }
  if (move === "no_question") return "WAIT_SPACE_v1";

  // ask_one_question
  if (messageLooksLikeDateAnswer(message)) {
    return "DATE_CONFIRM_v1";
  }
  if (
    asksPrice(message) &&
    risk === "Fiyat" &&
    (brain.persona === "undecided" || brain.scores.priceSensitivity >= 60)
  ) {
    return "PRICE_DEFENSE_v3";
  }
  return "INFO_ONE_QUESTION_v2";
}

/**
 * Strategy önkoşulları — ihlalde güvenli stratejiye düş.
 */
export function enforceStrategyPreconditions(params: {
  strategyId: StrategyId;
  brain: SalesBrainSnapshot;
  customerMessage: string;
  shortReply?: ShortReplyResolution | null;
  lastAiReply?: string | null;
}): { strategyId: StrategyId; rationale: string } {
  const { brain, customerMessage, shortReply, lastAiReply } = params;
  let strategyId = params.strategyId;
  const notes: string[] = [];
  const msg = customerMessage.trim();
  const lastAi = lastAiReply ?? shortReply?.previousAiQuestion ?? "";

  const refOfferPending =
    shortReply?.kind === "agreement" &&
    shortReply.answeredTopic === "reference_offer";
  const customerWantsRef = customerAskedReference(msg);

  if (strategyId === "SHOW_EXAMPLE_v1") {
    if (!customerWantsRef && !refOfferPending) {
      strategyId = shortReply?.isShort ? "WAIT_SPACE_v1" : "INFO_ONE_QUESTION_v2";
      notes.push("SHOW_EXAMPLE önkoşul yok → güvenli devam");
    } else if (
      aiAlreadyOfferedReference(lastAi) &&
      !refOfferPending &&
      !customerWantsRef
    ) {
      strategyId = "INFO_ONE_QUESTION_v2";
      notes.push("Referans zaten teklif edildi → tekrar SHOW_EXAMPLE yok");
    }
  }

  if (
    strategyId === "TRUST_BUILD_v2" &&
    (brain.memory.styleHint ||
      shortReply?.answeredTopic === "style" ||
      aiAlreadyOfferedReference(lastAi))
  ) {
    strategyId = "INFO_ONE_QUESTION_v2";
    notes.push("TRUST_BUILD döngüsü kırıldı → INFO");
  }

  if (strategyId === "DATE_CONFIRM_v1") {
    const hasDateNow =
      messageLooksLikeDateAnswer(msg) || shortReply?.kind === "date_answer";
    if (!hasDateNow) {
      strategyId = "INFO_ONE_QUESTION_v2";
      notes.push("DATE_CONFIRM için tarih cevabı yok");
    }
  }

  if (strategyId === "INFO_ONE_QUESTION_v2") {
    // Tarih zaten var / bu turda verildi → tekrar tarih sorma stratejisi olmasın
    const justGaveDate =
      shortReply?.kind === "date_answer" || messageLooksLikeDateAnswer(msg);
    if (justGaveDate) {
      strategyId = "DATE_CONFIRM_v1";
      notes.push("Tarih cevabı → DATE_CONFIRM");
    } else if (
      shortReply?.kind === "unclear" &&
      shortReply.answeredTopic === "none"
    ) {
      strategyId = "WAIT_SPACE_v1";
      notes.push("Bağlamsız kısa onay → WAIT_SPACE");
    } else if (brain.memory.dateHint) {
      notes.push("dateHint mevcut — template tarih sormayacak");
    }
  }

  void lastAi;
  return {
    strategyId,
    rationale: notes.length ? notes.join("; ") : "önkoşul OK",
  };
}

/**
 * Analiz + strateji seçimi (LLM yok).
 */
export function decideSalesDecision(params: {
  brain: SalesBrainSnapshot;
  customerMessage: string;
  /** Varsa A/B sonrası strategist çıktısı */
  conversationStrategy?: ConversationStrategy;
  shortReply?: ShortReplyResolution | null;
  lastAiReply?: string | null;
}): DecisionPack {
  const strategy =
    params.conversationStrategy ??
    decideConversationStrategy({
      brain: params.brain,
      customerMessage: params.customerMessage,
      shortReply: params.shortReply,
    });

  const upset = looksUpset(params.customerMessage);
  const risk = mapRisk(params.brain, upset);
  const analysis: DecisionAnalysis = {
    personaLabel:
      PERSONA_LABELS[params.brain.persona] ?? params.brain.persona,
    stageLabel: mapStage(params.brain),
    leadTemperature: leadTemperature(params.brain),
    risk,
  };

  let strategyId = pickStrategyId(
    strategy.move,
    params.brain,
    risk,
    params.customerMessage,
    params.shortReply
  );
  const enforced = enforceStrategyPreconditions({
    strategyId,
    brain: params.brain,
    customerMessage: params.customerMessage,
    shortReply: params.shortReply,
    lastAiReply: params.lastAiReply,
  });
  strategyId = enforced.strategyId;
  const spec = SPECS[strategyId];

  // Sert kapılar: fiyat yalnızca açık niyet + GIVE_PRICE
  let allowPrice =
    strategy.allowPrice &&
    strategyId === "GIVE_PRICE_SHORT_v2" &&
    asksPrice(params.customerMessage);
  let allowQuestion = strategy.allowQuestion;
  if (strategyId === "PRICE_DEFENSE_v3") {
    allowPrice = false;
  }
  if (
    strategyId === "EMPATHY_HOLD_v1" ||
    strategyId === "WAIT_SPACE_v1" ||
    strategyId === "GREETING_ACK_v1"
  ) {
    allowPrice = false;
  }
  if (strategyId === "EMPATHY_HOLD_v1" || strategyId === "WAIT_SPACE_v1") {
    allowQuestion = false;
  }

  return {
    analysis,
    strategyId,
    move: strategy.move,
    allowPrice,
    allowQuestion,
    maxWords: spec.maxWords,
    maxQuestions: allowQuestion ? 1 : 0,
    requireSocialProof: spec.requireSocialProof,
    requireCta: spec.requireCta,
    writerBrief: spec.writerBrief,
    naturalExamples: spec.naturalExamples,
    rationale: `${strategy.rationale} → ${strategyId} (${enforced.rationale})`,
    conversationStrategy: {
      ...strategy,
      move:
        strategyId === "WAIT_SPACE_v1"
          ? "wait"
          : strategyId === "SHOW_EXAMPLE_v1"
            ? "show_example"
            : strategyId === "DATE_CONFIRM_v1"
              ? "ask_one_question"
              : strategy.move,
      allowPrice,
      allowQuestion,
      maxLines: Math.max(2, Math.ceil(spec.maxWords / 35)),
      directive: `Strateji ${strategyId}: ${strategy.directive}`,
      rationale: `${strategy.rationale} → ${strategyId} (${enforced.rationale})`,
    },
  };
}

/**
 * GPT'ye giden blok — "düşünme", sadece yaz.
 */
export function composeDecisionEnginePromptBlock(pack: DecisionPack): string {
  const a = pack.analysis;
  return [
    "## DECISION ENGINE (kod karar verdi — sen SADECE yaz)",
    "",
    "### Analiz (bilgi; yeniden karar verme)",
    `Persona: ${a.personaLabel}`,
    `Stage: ${a.stageLabel}`,
    `Lead sıcaklığı: ${a.leadTemperature}`,
    `Risk: ${a.risk}`,
    "",
    "### Strategy (ZORUNLU)",
    `Strategy: ${pack.strategyId}`,
    `Hamle: ${pack.move}`,
    `Bu stratejiyle yaz. Başka strateji uydurma. Satış planı yapma.`,
    "",
    "### Writer brief (madde madde uygula)",
    ...pack.writerBrief.map((b, i) => `${i + 1}. ${b}`),
    "",
    "### Sert kurallar",
    `- En fazla ${pack.maxQuestions} soru (?).`,
    `- En fazla ${pack.maxWords} kelime.`,
    `- Fiyat: ${pack.allowPrice ? "katalog rakamları OK" : "YASAK — rakam yazma"}.`,
    `- Sosyal kanıt: ${pack.requireSocialProof ? "zorunlu (abartısız, sahte kota yok)" : "gerekmez"}.`,
    `- CTA: ${pack.requireCta ? "sonda net bir sonraki adım" : "zorunlu değil"}.`,
    "",
    "### Yasak GPT kalıpları (ASLA kullanma)",
    GPT_FILLER_PHRASES.map((p) => `"${p}"`).join(", "),
    "",
    "### Doğal üslup (personel DM gibi)",
    "Kısa, samimi, günlük Türkçe. Öğretmen / kurumsal metin değil.",
    "Örnek ton (kopyalama, benzer doğallık):",
    ...pack.naturalExamples.map((e) => `- ${e}`),
    "",
    `Gerekçe: ${pack.rationale}`,
  ].join("\n");
}

export function decisionPackToJson(pack: DecisionPack): Record<string, unknown> {
  return {
    analysis: pack.analysis,
    strategyId: pack.strategyId,
    move: pack.move,
    allowPrice: pack.allowPrice,
    allowQuestion: pack.allowQuestion,
    maxWords: pack.maxWords,
    maxQuestions: pack.maxQuestions,
    requireSocialProof: pack.requireSocialProof,
    requireCta: pack.requireCta,
    rationale: pack.rationale,
  };
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function countQuestions(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

/**
 * GPT çıktısını Decision Engine kurallarına göre temizle.
 */
export function enforceDecisionEngineOnReply(
  reply: string,
  pack: DecisionPack
): { reply: string; strippedFillers: string[]; truncated: boolean } {
  let text = reply.trim();
  const strippedFillers: string[] = [];

  for (const phrase of GPT_FILLER_PHRASES) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    if (re.test(text)) {
      strippedFillers.push(phrase);
      text = text.replace(re, "").replace(/\s{2,}/g, " ").trim();
    }
  }

  // Çift boş satır / baştaki noktalama
  text = text.replace(/^[,.\s]+/, "").replace(/\n{3,}/g, "\n\n").trim();

  let truncated = false;
  if (countWords(text) > pack.maxWords) {
    const words = text.split(/\s+/).filter(Boolean);
    text = words.slice(0, pack.maxWords).join(" ");
    truncated = true;
    if (!/[.!?…]$/.test(text)) text = `${text}…`;
  }

  if (!pack.allowQuestion || pack.maxQuestions === 0) {
    // Fazla soru işaretlerini yumuşat
    const parts = text.split("?");
    if (parts.length > 1) {
      text = parts[0]!.trim();
      if (parts.slice(1).join("").trim()) {
        text = `${text}. ${parts.slice(1).join(" ").replace(/\?/g, "").trim()}`.trim();
      }
    }
  } else if (countQuestions(text) > pack.maxQuestions) {
    let seen = 0;
    text = text.replace(/\?/g, (m) => {
      seen += 1;
      return seen <= pack.maxQuestions ? m : ".";
    });
  }

  return { reply: text.trim(), strippedFillers, truncated };
}
