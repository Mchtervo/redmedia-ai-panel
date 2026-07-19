/**
 * Template Engine pipeline: slot fill → compose → validate → fallback.
 * Validator geçmeden reply dönülmez. Fallback stage'e özel — fiyat dump yok.
 */

import type { DecisionPack } from "@/features/ai/services/decision-engine.service";
import {
  alternateGreetingDefaults,
  composeDeterministicFallback,
  composeReplyFromTemplate,
  getTemplateForDecision,
  type ReplySlotValues,
  type ReplyTemplate,
} from "@/features/ai/services/reply-template.engine";
import { fillReplySlots } from "@/features/ai/services/reply-slot-filler.service";
import {
  validateTemplatedReply,
  type ReplyValidationResult,
  type ValidationViolation,
} from "@/features/ai/services/reply-validator.service";

export type TemplatedReplyResult = {
  reply: string;
  template: ReplyTemplate;
  slots: ReplySlotValues;
  usedGptSlots: boolean;
  usedFallback: boolean;
  validation: ReplyValidationResult;
  attempts: {
    source: "gpt_slots" | "defaults" | "stage_fallback";
    violations: ValidationViolation[];
  }[];
  model: string | null;
};

/**
 * Strategy için zorunlu template cevabı üret.
 */
export async function generateTemplatedReply(params: {
  pack: DecisionPack;
  customerMessage: string;
  dateHint?: string | null;
  /** Aynı conversation'da son AI cevabı — duplicate engeli */
  lastAiReply?: string | null;
}): Promise<TemplatedReplyResult> {
  let template = getTemplateForDecision(
    params.pack,
    params.customerMessage
  );
  const attempts: TemplatedReplyResult["attempts"] = [];

  const filled = await fillReplySlots({
    template,
    pack: params.pack,
    customerMessage: params.customerMessage,
    dateHint: params.dateHint,
  });

  let reply = composeReplyFromTemplate(template, filled.slots);
  let validation = validateTemplatedReply({
    reply,
    template,
    pack: params.pack,
  });

  attempts.push({
    source: "gpt_slots",
    violations: validation.ok ? [] : validation.violations,
  });

  let usedFallback = false;
  if (!validation.ok) {
    usedFallback = true;
    reply = stageSafeFallback(params.pack, template);
    validation = validateTemplatedReply({
      reply,
      template,
      pack: params.pack,
    });
    attempts.push({
      source: "stage_fallback",
      violations: validation.ok ? [] : validation.violations,
    });
  }

  // Duplicate: aynı cevap tekrarlanıyorsa greeting alternatifi
  if (
    validation.ok &&
    params.lastAiReply &&
    params.pack.strategyId === "GREETING_ACK_v1"
  ) {
    const { isNearDuplicateReply } = await import(
      "@/features/ai/services/message-intent"
    );
    if (isNearDuplicateReply(reply, params.lastAiReply)) {
      usedFallback = true;
      const alt = alternateGreetingDefaults(Date.now());
      reply = composeReplyFromTemplate(template, {
        ...template.defaults,
        ...alt,
      });
      validation = validateTemplatedReply({
        reply,
        template,
        pack: params.pack,
      });
      attempts.push({
        source: "defaults",
        violations: validation.ok ? [] : validation.violations,
      });
    }
  }

  return {
    reply,
    template,
    slots: filled.slots,
    usedGptSlots: filled.usedGpt && !usedFallback,
    usedFallback,
    validation,
    attempts,
    model: filled.model,
  };
}

/** Validator fail → asla fiyat şablonuna düşme. */
function stageSafeFallback(
  pack: DecisionPack,
  template: ReplyTemplate
): string {
  if (
    pack.strategyId === "GREETING_ACK_v1" ||
    pack.move === "greeting_ack" ||
    pack.move === "ask_one_question"
  ) {
    return composeDeterministicFallback(
      pack.strategyId === "GREETING_ACK_v1"
        ? template
        : {
            ...template,
            strategyId: "GREETING_ACK_v1",
            allowPrice: false,
            requireCta: false,
            requireReference: false,
            requireQuestion: true,
            maxWords: 35,
            parts: [
              { type: "slot", slot: "hook" },
              { type: "slot", slot: "question" },
            ],
            defaults: {
              hook: "Merhaba.",
              value: "",
              proof: "",
              question: "Nasıl bir çekim bakıyorsunuz?",
              cta: "",
            },
          }
    );
  }

  if (pack.strategyId === "GIVE_PRICE_SHORT_v2" && pack.allowPrice) {
    return composeDeterministicFallback(template);
  }

  // Trust / diğer — kısa discovery, fiyat yok
  return "Anladım. Sizin için en önemlisi ne — tarih mi, yoksa çekim tarzı mı?";
}
