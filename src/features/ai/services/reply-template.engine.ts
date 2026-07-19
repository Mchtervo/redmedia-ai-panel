/**
 * Template Engine — her Strategy için zorunlu iskelet.
 * GPT yalnızca slot doldurur; validator geçmeden mesaj çıkmaz.
 */

import type { DecisionPack, StrategyId } from "@/features/ai/services/decision-engine.service";
import { isInformalChitchat } from "@/features/ai/services/message-intent";

export const REPLY_SLOT_IDS = [
  "hook",
  "empathy",
  "value",
  "proof",
  "price_line",
  "question",
  "cta",
] as const;

export type ReplySlotId = (typeof REPLY_SLOT_IDS)[number];

export type ReplySlotValues = Partial<Record<ReplySlotId, string>>;

export type TemplatePart =
  | { type: "literal"; text: string }
  | { type: "slot"; slot: ReplySlotId };

export type ReplyTemplate = {
  strategyId: StrategyId;
  parts: TemplatePart[];
  requireCta: boolean;
  requireReference: boolean;
  /** true → tam 1 soru; false → 0 soru */
  requireQuestion: boolean;
  allowPrice: boolean;
  maxWords: number;
  defaults: Required<
    Pick<ReplySlotValues, "hook" | "value" | "proof" | "question" | "cta">
  > &
    ReplySlotValues;
};

const TEMPLATES: Record<StrategyId, ReplyTemplate> = {
  GREETING_ACK_v1: {
    strategyId: "GREETING_ACK_v1",
    requireCta: false,
    requireReference: false,
    requireQuestion: true,
    allowPrice: false,
    maxWords: 35,
    parts: [
      { type: "slot", slot: "hook" },
      { type: "slot", slot: "question" },
    ],
    defaults: {
      hook: "Merhaba, hoş geldiniz.",
      value: "",
      proof: "",
      question: "Dış çekim mi yoksa düğün günü çekimi mi düşünüyorsunuz?",
      cta: "",
      empathy: "",
    },
  },
  PRICE_DEFENSE_v3: {
    strategyId: "PRICE_DEFENSE_v3",
    requireCta: true,
    requireReference: true,
    requireQuestion: true,
    allowPrice: false,
    maxWords: 120,
    parts: [
      { type: "slot", slot: "empathy" },
      { type: "slot", slot: "value" },
      { type: "slot", slot: "proof" },
      { type: "slot", slot: "question" },
      { type: "slot", slot: "cta" },
    ],
    defaults: {
      hook: "",
      empathy: "Bütçe tarafı önemli, haklısınız.",
      value: "Premium'da kapora ve plato dahil; dump yok, net paket.",
      proof: "Benzer tarihte çeken çiftlerde genelde video ağırlığı öne çıkıyor.",
      question: "Sizin için albüm mü önde, yoksa daha çok video mu?",
      cta: "Tarihinizi yazın, ona göre netleştirelim.",
    },
  },
  TRUST_BUILD_v2: {
    strategyId: "TRUST_BUILD_v2",
    requireCta: true,
    requireReference: true,
    requireQuestion: true,
    allowPrice: false,
    maxWords: 90,
    parts: [
      { type: "slot", slot: "hook" },
      { type: "slot", slot: "proof" },
      { type: "slot", slot: "question" },
      { type: "slot", slot: "cta" },
    ],
    defaults: {
      hook: "Anladım.",
      value: "",
      proof: "İsterseniz benzer bir çekimden kısa bir örnek kesit atayım.",
      question: "Daha sinematik mi bakıyorsunuz, yoksa sade mi?",
      cta: "Örnek isterseniz yazın, atayım.",
    },
  },
  GIVE_PRICE_SHORT_v2: {
    strategyId: "GIVE_PRICE_SHORT_v2",
    requireCta: true,
    requireReference: false,
    requireQuestion: true,
    allowPrice: true,
    maxWords: 100,
    parts: [
      { type: "slot", slot: "price_line" },
      { type: "slot", slot: "question" },
      { type: "slot", slot: "cta" },
    ],
    defaults: {
      hook: "",
      value: "",
      proof: "",
      price_line:
        "Basic 11.000, Premium Albümlü 14.000, Elite 21.000 TL.",
      question: "Albüm sizin için önemli mi, yoksa daha çok video tarafı mı?",
      cta: "Hangisine yakınsınız yazın, ona göre devam edelim.",
    },
  },
  SHOW_EXAMPLE_v1: {
    strategyId: "SHOW_EXAMPLE_v1",
    requireCta: true,
    requireReference: true,
    requireQuestion: true,
    allowPrice: false,
    maxWords: 80,
    parts: [
      { type: "slot", slot: "proof" },
      { type: "slot", slot: "question" },
      { type: "slot", slot: "cta" },
    ],
    defaults: {
      hook: "",
      value: "",
      proof: "Benzer bir düğünden 1 kısa referans kesit gönderebilirim.",
      question: "Dış çekim mi, yoksa salona mı daha yakın bakıyorsunuz?",
      cta: "Örnek kesiti atmamı isterseniz yazın.",
    },
  },
  OBJECTION_RESOLVE_v2: {
    strategyId: "OBJECTION_RESOLVE_v2",
    requireCta: true,
    requireReference: true,
    requireQuestion: true,
    allowPrice: false,
    maxWords: 110,
    parts: [
      { type: "slot", slot: "empathy" },
      { type: "slot", slot: "value" },
      { type: "slot", slot: "proof" },
      { type: "slot", slot: "question" },
      { type: "slot", slot: "cta" },
    ],
    defaults: {
      hook: "",
      empathy: "Karşılaştırma yapmanız normal.",
      value: "Bizde tek ekip + kurgu birlikte yürüyor.",
      proof: "Benzer organizasyonlarda bu farkı referans kesitte de görebiliyorsunuz.",
      question: "Tarihiniz net mi?",
      cta: "Yazın, size özel net teklif çıkarayım.",
    },
  },
  EMPATHY_HOLD_v1: {
    strategyId: "EMPATHY_HOLD_v1",
    requireCta: false,
    requireReference: false,
    requireQuestion: false,
    allowPrice: false,
    maxWords: 40,
    parts: [{ type: "slot", slot: "empathy" }],
    defaults: {
      hook: "",
      empathy: "Haklısınız, sinir bozucu olmuş. Siz nasıl ilerlemek istersiniz yazın.",
      value: "",
      proof: "",
      question: "",
      cta: "",
    },
  },
  SOFT_CLOSE_v2: {
    strategyId: "SOFT_CLOSE_v2",
    requireCta: true,
    requireReference: false,
    requireQuestion: true,
    allowPrice: false,
    maxWords: 70,
    parts: [
      { type: "slot", slot: "hook" },
      { type: "slot", slot: "question" },
      { type: "slot", slot: "cta" },
    ],
    defaults: {
      hook: "Tamam, baskı yok.",
      value: "",
      proof: "",
      question: "Tarih sizin tarafta net mi?",
      cta: "Netleşince yazın, kapora adımını da tarif ederim.",
    },
  },
  ASK_DEPOSIT_v1: {
    strategyId: "ASK_DEPOSIT_v1",
    requireCta: true,
    requireReference: false,
    requireQuestion: true,
    allowPrice: false,
    maxWords: 80,
    parts: [
      { type: "slot", slot: "value" },
      { type: "slot", slot: "question" },
      { type: "slot", slot: "cta" },
    ],
    defaults: {
      hook: "",
      value: "Tarihi tutmak için kapora adımı gerekiyor.",
      proof: "",
      question: "Önce IBAN mı atayım, yoksa saati mi netleştirelim?",
      cta: "Siz seçin, kapora bilgisini ileteyim.",
    },
  },
  INFO_ONE_QUESTION_v2: {
    strategyId: "INFO_ONE_QUESTION_v2",
    requireCta: true,
    requireReference: false,
    requireQuestion: true,
    allowPrice: false,
    maxWords: 60,
    parts: [
      { type: "slot", slot: "hook" },
      { type: "slot", slot: "question" },
      { type: "slot", slot: "cta" },
    ],
    defaults: {
      hook: "Anladım.",
      value: "",
      proof: "",
      question: "Düğün tarihiniz net mi?",
      cta: "Yazın, ona göre devam edelim.",
    },
  },
  DATE_CONFIRM_v1: {
    strategyId: "DATE_CONFIRM_v1",
    requireCta: true,
    requireReference: false,
    requireQuestion: true,
    allowPrice: false,
    maxWords: 50,
    parts: [
      { type: "slot", slot: "hook" },
      { type: "slot", slot: "question" },
      { type: "slot", slot: "cta" },
    ],
    defaults: {
      hook: "O tarih güzel.",
      value: "",
      proof: "",
      question: "Mekân belli mi?",
      cta: "Yazın, not düşeyim.",
    },
  },
  WAIT_SPACE_v1: {
    strategyId: "WAIT_SPACE_v1",
    requireCta: false,
    requireReference: false,
    requireQuestion: false,
    allowPrice: false,
    maxWords: 35,
    parts: [{ type: "slot", slot: "hook" }],
    defaults: {
      hook: "Tamam, siz netleşince yazın yeter.",
      value: "",
      proof: "",
      question: "",
      cta: "",
    },
  },
};

export function getReplyTemplate(strategyId: StrategyId): ReplyTemplate {
  return TEMPLATES[strategyId];
}

export function getTemplateForDecision(
  pack: DecisionPack,
  customerMessage?: string
): ReplyTemplate {
  const base = getReplyTemplate(pack.strategyId);
  const template: ReplyTemplate = {
    ...base,
    defaults: { ...base.defaults },
    allowPrice: base.allowPrice && pack.allowPrice,
    maxWords: Math.min(base.maxWords, pack.maxWords),
  };

  if (
    pack.strategyId === "GREETING_ACK_v1" &&
    customerMessage &&
    isInformalChitchat(customerMessage)
  ) {
    template.defaults = {
      ...template.defaults,
      hook: "İyidir.",
      question: "Çekim için mi yazdınız, yoksa bir şey mi soracaktınız?",
    };
  }

  return template;
}

/** Duplicate engeli için alternatif greeting defaults. */
export function alternateGreetingDefaults(seed: number): ReplySlotValues {
  const alts = [
    {
      hook: "Merhaba.",
      question: "Nasıl bir çekim bakıyorsunuz?",
    },
    {
      hook: "Selam, hoş geldiniz.",
      question: "Düğün / nişan günü mü, yoksa dış çekim mi?",
    },
    {
      hook: "Merhaba.",
      question: "Size nasıl yardımcı olayım — çekim mi bakıyorsunuz?",
    },
  ];
  return alts[Math.abs(seed) % alts.length]!;
}

/** Slot değerlerini birleştir → nihai mesaj. */
export function composeReplyFromTemplate(
  template: ReplyTemplate,
  slots: ReplySlotValues
): string {
  const merged: ReplySlotValues = { ...template.defaults, ...slots };
  const chunks: string[] = [];

  for (const part of template.parts) {
    if (part.type === "literal") {
      const t = part.text.trim();
      if (t) chunks.push(t);
      continue;
    }
    const raw = (merged[part.slot] ?? "").trim();
    if (!raw) continue;
    chunks.push(raw);
  }

  let text = chunks.join(" ").replace(/\s{2,}/g, " ").trim();

  // Soru slotu ? ile bitsin
  if (template.requireQuestion && merged.question) {
    const q = merged.question.trim();
    if (q && !text.includes(q)) {
      text = `${text} ${q}`.trim();
    }
  }

  // CTA sonda olsun
  if (template.requireCta && merged.cta) {
    const cta = merged.cta.trim();
    if (cta && !text.endsWith(cta) && !text.includes(cta)) {
      text = `${text} ${cta}`.trim();
    }
  }

  return text.replace(/\s{2,}/g, " ").trim();
}

/** Validator fail olursa garantili geçerli fallback. */
export function composeDeterministicFallback(template: ReplyTemplate): string {
  return composeReplyFromTemplate(template, template.defaults);
}

export function listSlotsToFill(template: ReplyTemplate): ReplySlotId[] {
  const slots = new Set<ReplySlotId>();
  for (const part of template.parts) {
    if (part.type === "slot") slots.add(part.slot);
  }
  return [...slots];
}
