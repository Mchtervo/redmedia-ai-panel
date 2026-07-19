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
import type { ShortReplyResolution } from "@/features/ai/services/short-reply-context.service";

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
  shortReply?: ShortReplyResolution | null;
}): Promise<TemplatedReplyResult> {
  let template = getTemplateForDecision(params.pack, {
    customerMessage: params.customerMessage,
    shortReply: params.shortReply,
    dateHint: params.dateHint,
    lastAiReply: params.lastAiReply,
  });
  const attempts: TemplatedReplyResult["attempts"] = [];

  const validate = (reply: string) =>
    validateTemplatedReply({
      reply,
      template,
      pack: params.pack,
      customerMessage: params.customerMessage,
      shortReply: params.shortReply,
      dateHint: params.dateHint,
    });

  const filled = await fillReplySlots({
    template,
    pack: params.pack,
    customerMessage: params.customerMessage,
    dateHint: params.dateHint,
    shortReply: params.shortReply,
    lastAiReply: params.lastAiReply,
  });

  let reply = composeReplyFromTemplate(template, filled.slots);
  let validation = validate(reply);

  attempts.push({
    source: "gpt_slots",
    violations: validation.ok ? [] : validation.violations,
  });

  let usedFallback = false;
  if (!validation.ok) {
    usedFallback = true;
    reply = stageSafeFallback(params.pack, template, params.shortReply);
    validation = validate(reply);
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
      validation = validate(reply);
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

/** Validator fail → asla fiyat/tarih dump'a düşme. */
function stageSafeFallback(
  pack: DecisionPack,
  template: ReplyTemplate,
  shortReply?: ShortReplyResolution | null
): string {
  if (shortReply?.kind === "date_answer" && shortReply.resolvedValue) {
    return `${shortReply.resolvedValue} için not aldım. Çekim dış çekim mi olacak?`;
  }
  if (
    shortReply?.kind === "unclear" ||
    shortReply?.kind === "agreement" ||
    pack.strategyId === "WAIT_SPACE_v1"
  ) {
    return "Tamamdır. Aklınıza takılanı yazabilirsiniz.";
  }
  if (pack.strategyId === "GREETING_ACK_v1" || pack.move === "greeting_ack") {
    return composeDeterministicFallback(template);
  }

  if (pack.strategyId === "GIVE_PRICE_SHORT_v2" && pack.allowPrice) {
    return composeDeterministicFallback(template);
  }

  return "Tamamdır. Aklınıza takılanı yazabilirsiniz.";
}
