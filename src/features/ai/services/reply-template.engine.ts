/**
 * Template Engine — her Strategy için zorunlu iskelet.
 * GPT yalnızca slot doldurur; validator geçmeden mesaj çıkmaz.
 */

import type { DecisionPack, StrategyId } from "@/features/ai/services/decision-engine.service";
import { isInformalChitchat } from "@/features/ai/services/message-intent";
import type { ShortReplyResolution } from "@/features/ai/services/short-reply-context.service";

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
      cta: "Hangisine yakınsanız yazın.",
    },
  },
  TRUST_BUILD_v2: {
    strategyId: "TRUST_BUILD_v2",
    requireCta: false,
    requireReference: false,
    requireQuestion: true,
    allowPrice: false,
    maxWords: 70,
    parts: [
      { type: "slot", slot: "hook" },
      { type: "slot", slot: "question" },
    ],
    defaults: {
      hook: "Anladım.",
      value: "",
      proof: "",
      question: "Sizin için en önemlisi ne — tarih mi, çekim tarzı mı?",
      cta: "",
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
      cta: "Hangisine yakınsanız yazın.",
    },
  },
  SHOW_EXAMPLE_v1: {
    strategyId: "SHOW_EXAMPLE_v1",
    requireCta: false,
    requireReference: true,
    requireQuestion: true,
    allowPrice: false,
    maxWords: 70,
    parts: [
      { type: "slot", slot: "hook" },
      { type: "slot", slot: "proof" },
      { type: "slot", slot: "question" },
    ],
    defaults: {
      hook: "Tabii.",
      value: "",
      proof: "Size uygun kısa bir örnek paylaşayım.",
      question: "Daha doğal mı, sinematik mi bakıyorsunuz?",
      cta: "",
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
      question: "Tarih tarafı net mi sizde?",
      cta: "Netleşince yazın, özel teklifi çıkarayım.",
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
    requireCta: false,
    requireReference: false,
    requireQuestion: true,
    allowPrice: false,
    maxWords: 50,
    parts: [
      { type: "slot", slot: "hook" },
      { type: "slot", slot: "question" },
    ],
    defaults: {
      hook: "Tamamdır.",
      value: "",
      proof: "",
      question: "Sizin için en önemlisi ne — tarih mi, çekim tarzı mı?",
      cta: "",
    },
  },
  DATE_CONFIRM_v1: {
    strategyId: "DATE_CONFIRM_v1",
    requireCta: false,
    requireReference: false,
    requireQuestion: true,
    allowPrice: false,
    maxWords: 55,
    parts: [
      { type: "slot", slot: "hook" },
      { type: "slot", slot: "question" },
    ],
    defaults: {
      hook: "Not aldım.",
      value: "",
      proof: "",
      question: "Çekim dış çekim mi olacak?",
      cta: "",
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
      hook: "Tamamdır. Aklınıza takılanı yazabilirsiniz.",
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

export type TemplateContext = {
  customerMessage?: string;
  shortReply?: ShortReplyResolution | null;
  dateHint?: string | null;
  styleHint?: string | null;
  lastAiReply?: string | null;
  referenceAlreadyOffered?: boolean;
};

/**
 * Strategy + kısa cevap bağlamına göre slot defaults (sabit satış cümlesi yok).
 */
export function getTemplateForDecision(
  pack: DecisionPack,
  customerMessageOrCtx?: string | TemplateContext
): ReplyTemplate {
  const ctx: TemplateContext =
    typeof customerMessageOrCtx === "string" || customerMessageOrCtx == null
      ? { customerMessage: customerMessageOrCtx }
      : customerMessageOrCtx;

  const base = getReplyTemplate(pack.strategyId);
  const template: ReplyTemplate = {
    ...base,
    defaults: { ...base.defaults },
    allowPrice: base.allowPrice && pack.allowPrice,
    maxWords: Math.min(base.maxWords, pack.maxWords),
  };

  const msg = ctx.customerMessage?.trim() ?? "";
  const short = ctx.shortReply;
  const dateHint = ctx.dateHint?.trim() || null;
  const styleHint = ctx.styleHint?.trim() || null;
  const resolvedDate =
    short?.kind === "date_answer"
      ? short.resolvedValue
      : dateHint;
  const outdoorKnown =
    /dış\s*çekim|dis\s*cekim/i.test(msg) || styleHint === "dış çekim";

  if (
    pack.strategyId === "GREETING_ACK_v1" &&
    msg &&
    isInformalChitchat(msg)
  ) {
    template.defaults = {
      ...template.defaults,
      hook: "İyidir.",
      question: "Çekim için mi yazdınız, yoksa bir şey mi soracaktınız?",
    };
  }

  if (pack.strategyId === "DATE_CONFIRM_v1") {
    const label = resolvedDate || "o tarih";
    template.defaults = {
      ...template.defaults,
      hook: outdoorKnown
        ? `${label} dış çekim için önce müsaitliği kontrol edelim.`
        : `${label} için önce müsaitliği kontrol edelim.`,
      question: outdoorKnown
        ? "Saat aralığı belli mi?"
        : "Çekim dış çekim mi olacak?",
      cta: "",
    };
  }

  if (pack.strategyId === "SHOW_EXAMPLE_v1") {
    if (ctx.referenceAlreadyOffered) {
      // Tekrar pitch yok — INFO'ya benzer yumuşak devam
      template.requireReference = false;
      template.parts = [
        { type: "slot", slot: "hook" },
        { type: "slot", slot: "question" },
      ];
      template.defaults = {
        ...template.defaults,
        hook: "Tabii.",
        proof: "",
        question: styleHint
          ? "Albüm sizin için önemli mi?"
          : "Daha doğal mı, sinematik mi bakıyorsunuz?",
        cta: "",
      };
    } else {
      template.defaults = {
        ...template.defaults,
        hook: "Tabii.",
        proof: "Size uygun kısa bir örnek paylaşayım.",
        question: styleHint
          ? "Albüm sizin için önemli mi?"
          : "Daha doğal mı, sinematik mi bakıyorsunuz?",
        cta: "",
      };
    }
  }

  if (pack.strategyId === "TRUST_BUILD_v2") {
    if (!ctx.referenceAlreadyOffered && !styleHint) {
      template.requireReference = true;
      template.parts = [
        { type: "slot", slot: "hook" },
        { type: "slot", slot: "proof" },
        { type: "slot", slot: "question" },
      ];
      template.defaults = {
        ...template.defaults,
        hook: "Anladım.",
        proof: "İsterseniz benzer bir çekimden kısa örnek atayım.",
        question: "Daha sinematik mi bakıyorsunuz, yoksa sade mi?",
        cta: "",
      };
    } else {
      template.defaults = {
        ...template.defaults,
        hook: styleHint ? `${styleHint} tarafını not ettim.` : "Anladım.",
        proof: "",
        question: dateHint
          ? "Albüm sizin için önemli mi?"
          : "Tarih tarafı net mi sizde?",
        cta: "",
      };
    }
  }

  if (pack.strategyId === "INFO_ONE_QUESTION_v2") {
    // "Nasıl yani" — aynı stil sorusunu tekrar etme
    if (short?.resolvedValue === "needs_clarification") {
      template.defaults = {
        ...template.defaults,
        hook: "Kısaca şöyle:",
        question: styleHint
          ? "Örnek video mu istersiniz, yoksa paket detayı mı?"
          : "Çekim tarzınız sade mi olsun, daha sinematik mi?",
        cta: "",
      };
      if (styleHint) {
        // Stil zaten var — net alternatif sor
        template.defaults.question =
          "Örnek kısa video mu atayım, yoksa paketleri mi anlatayım?";
      }
    } else if (short?.answeredTopic === "style" || styleHint) {
      const style = short?.resolvedValue || styleHint || "bu tarz";
      template.defaults = {
        ...template.defaults,
        hook: `${style} tamam.`,
        question: dateHint
          ? "Albüm de ister misiniz, yoksa video ağırlıklı mı?"
          : "Tarih tarafı net mi sizde?",
        cta: "",
      };
    } else if (short?.kind === "agreement" || short?.kind === "unclear") {
      if (dateHint && !styleHint) {
        template.defaults = {
          ...template.defaults,
          hook: "Tamamdır.",
          question: "Çekim tarzında doğal mı, daha sinematik mi istersiniz?",
          cta: "",
        };
      } else if (short.answeredTopic === "none" || !short.previousAiQuestion) {
        template.defaults = {
          ...template.defaults,
          hook: "Tamamdır.",
          question: "Aklınıza takılan bir şey var mı?",
          cta: "",
        };
        template.requireQuestion = false;
        template.parts = [{ type: "slot", slot: "hook" }];
      } else {
        template.defaults = {
          ...template.defaults,
          hook: "Tamamdır.",
          question: "Sizin için en önemlisi ne — tarih mi, çekim tarzı mı?",
          cta: "",
        };
      }
    } else if (dateHint && styleHint) {
      template.defaults = {
        ...template.defaults,
        hook: "Anladım.",
        question: "Albüm sizin için önemli mi?",
        cta: "",
      };
    } else if (dateHint) {
      template.defaults = {
        ...template.defaults,
        hook: "Anladım.",
        question: "Çekim tarzında doğal mı, sinematik mi bakıyorsunuz?",
        cta: "",
      };
    }
  }

  if (pack.strategyId === "WAIT_SPACE_v1") {
    if (short?.kind === "soft_defer") {
      template.defaults = {
        ...template.defaults,
        hook: "Tamam, siz netleşince yazın yeter.",
      };
    } else {
      template.defaults = {
        ...template.defaults,
        hook: "Tamamdır. Aklınıza takılanı yazabilirsiniz.",
      };
    }
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
