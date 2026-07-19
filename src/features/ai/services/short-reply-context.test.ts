import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInitialSalesBrain } from "@/features/ai/services/sales-brain.service";
import { decideConversationStrategy } from "@/features/ai/services/conversation-strategist.service";
import { decideSalesDecision } from "@/features/ai/services/decision-engine.service";
import {
  composeDeterministicFallback,
  getTemplateForDecision,
} from "@/features/ai/services/reply-template.engine";
import { validateTemplatedReply } from "@/features/ai/services/reply-validator.service";
import { resolveShortReplyContext } from "@/features/ai/services/short-reply-context.service";

function decideWithHistory(params: {
  customerMessage: string;
  lastAiReply: string | null;
  dateHint?: string | null;
  brain?: ReturnType<typeof createInitialSalesBrain>;
}) {
  const brain = params.brain ?? createInitialSalesBrain("t", 3);
  if (params.dateHint) brain.memory.dateHint = params.dateHint;
  const shortReply = resolveShortReplyContext({
    customerMessage: params.customerMessage,
    lastAiReply: params.lastAiReply,
    dateHint: brain.memory.dateHint,
  });
  if (shortReply.kind === "date_answer" && shortReply.resolvedValue) {
    brain.memory.dateHint = shortReply.resolvedValue;
  }
  const conversationStrategy = decideConversationStrategy({
    brain,
    customerMessage: params.customerMessage,
    shortReply,
  });
  const pack = decideSalesDecision({
    brain,
    customerMessage: params.customerMessage,
    conversationStrategy,
    shortReply,
    lastAiReply: params.lastAiReply,
  });
  const template = getTemplateForDecision(pack, {
    customerMessage: params.customerMessage,
    shortReply,
    dateHint: brain.memory.dateHint,
    lastAiReply: params.lastAiReply,
  });
  const reply = composeDeterministicFallback(template);
  const validation = validateTemplatedReply({
    reply,
    template,
    pack: {
      ...pack,
      requireCta: template.requireCta,
      requireSocialProof: template.requireReference,
      allowPrice: template.allowPrice,
      maxQuestions: template.requireQuestion ? 1 : 0,
      maxWords: template.maxWords,
    },
    customerMessage: params.customerMessage,
    shortReply,
    dateHint: brain.memory.dateHint,
  });
  return { shortReply, pack, template, reply, validation, brain };
}

describe("short-reply + strategy preconditions", () => {
  it("Senaryo A: tarih sorusu → Yarın → DATE_CONFIRM, SHOW_EXAMPLE yok", () => {
    const r = decideWithHistory({
      customerMessage: "Yarın",
      lastAiReply: "Çekim tarihiniz nedir?",
    });
    assert.equal(r.shortReply.kind, "date_answer");
    assert.equal(r.brain.memory.dateHint, "Yarın");
    assert.equal(r.pack.strategyId, "DATE_CONFIRM_v1");
    assert.notEqual(r.pack.strategyId, "SHOW_EXAMPLE_v1");
    assert.doesNotMatch(r.reply, /tarih(?:iniz)?\s*net/i);
    assert.equal(r.validation.ok, true, r.validation.ok ? "" : r.validation.detail.join("; "));
  });

  it("Senaryo B: örnek teklifi → Tamam → SHOW_EXAMPLE, tarih yok", () => {
    const r = decideWithHistory({
      customerMessage: "Tamam",
      lastAiReply: "Örnek göndereyim mi?",
    });
    assert.equal(r.shortReply.kind, "agreement");
    assert.equal(r.pack.strategyId, "SHOW_EXAMPLE_v1");
    assert.doesNotMatch(r.reply, /tarih(?:iniz)?\s*net/i);
    assert.equal(r.validation.ok, true, r.validation.ok ? "" : r.validation.detail.join("; "));
  });

  it("Senaryo C: Merhaba sonrası Tamam → WAIT_SPACE", () => {
    const r = decideWithHistory({
      customerMessage: "Tamam",
      lastAiReply:
        "Merhaba, hoş geldiniz. Dış çekim mi yoksa düğün günü çekimi mi düşünüyorsunuz?",
    });
    assert.equal(r.pack.strategyId, "WAIT_SPACE_v1");
    assert.doesNotMatch(r.reply, /11\.?000|referans|tarih(?:iniz)?\s*net/i);
    assert.equal(r.validation.ok, true, r.validation.ok ? "" : r.validation.detail.join("; "));
  });

  it("Senaryo D: Ne diyorsun aga → GREETING_ACK, satış yok", () => {
    const brain = createInitialSalesBrain("t", 1);
    brain.nextBestAction = "show_reference";
    const shortReply = resolveShortReplyContext({
      customerMessage: "Ne diyorsun aga",
    });
    const strategy = decideConversationStrategy({
      brain,
      customerMessage: "Ne diyorsun aga",
      shortReply,
    });
    const pack = decideSalesDecision({
      brain,
      customerMessage: "Ne diyorsun aga",
      conversationStrategy: strategy,
      shortReply,
    });
    assert.equal(pack.strategyId, "GREETING_ACK_v1");
    const template = getTemplateForDecision(pack, "Ne diyorsun aga");
    const reply = composeDeterministicFallback(template);
    assert.doesNotMatch(reply, /11\.?000|kapora|referans kesit/i);
  });

  it("Senaryo E: 15 Ağustos memory korunur, Tamam tarih sormaz", () => {
    const r = decideWithHistory({
      customerMessage: "Tamam",
      lastAiReply: "15 Ağustos not. Çekim tarzında doğal mı bakıyorsunuz?",
      dateHint: "15 Ağustos",
    });
    assert.equal(r.brain.memory.dateHint, "15 Ağustos");
    assert.doesNotMatch(r.reply, /tarih(?:iniz)?\s*net|hangi\s*tarih/i);
    assert.notEqual(r.pack.strategyId, "DATE_CONFIRM_v1");
    assert.equal(r.validation.ok, true, r.validation.ok ? "" : r.validation.detail.join("; "));
  });

  it("NBA show_reference kısa Tamam'da SHOW_EXAMPLE zorlamaz", () => {
    const brain = createInitialSalesBrain("t", 4);
    brain.nextBestAction = "show_reference";
    brain.objective = "build_trust";
    const r = decideWithHistory({
      customerMessage: "Tamam",
      lastAiReply: "Merhaba, hoş geldiniz. Nasıl yardımcı olayım?",
      brain,
    });
    assert.notEqual(r.pack.strategyId, "SHOW_EXAMPLE_v1");
  });
});
