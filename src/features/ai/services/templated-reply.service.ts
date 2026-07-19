/**
 * Template Engine pipeline: slot fill → compose → validate → fallback.
 * Validator geçmeden reply dönülmez.
 */

import type { DecisionPack } from "@/features/ai/services/decision-engine.service";
import {
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
    source: "gpt_slots" | "defaults";
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
}): Promise<TemplatedReplyResult> {
  const template = getTemplateForDecision(params.pack);
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
    reply = composeDeterministicFallback(template);
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

  // validation.ok false ise çağıran göndermez — asla fake ok:true
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
