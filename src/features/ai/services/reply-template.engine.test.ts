import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInitialSalesBrain } from "@/features/ai/services/sales-brain.service";
import { decideSalesDecision, STRATEGY_IDS } from "./decision-engine.service";
import {
  composeDeterministicFallback,
  getTemplateForDecision,
} from "./reply-template.engine";
import { validateTemplatedReply } from "./reply-validator.service";

describe("reply-template-engine", () => {
  it("tüm strategy default fallback'ları validator'dan geçer", () => {
    for (const strategyId of STRATEGY_IDS) {
      const brain = createInitialSalesBrain("t", 3);
      brain.persona = "undecided";
      brain.state = "objection";
      brain.mainBlocker = "price";
      const pack = decideSalesDecision({
        brain,
        customerMessage: "fiyat yüksek geldi",
      });
      // Force each strategy once via pack override
      const forced = { ...pack, strategyId };
      const template = getTemplateForDecision(forced);
      // getTemplateForDecision uses pack flags — align with template
      const aligned = {
        ...forced,
        requireCta: template.requireCta,
        requireSocialProof: template.requireReference,
        allowPrice: template.allowPrice,
        maxQuestions: template.requireQuestion ? 1 : 0,
        maxWords: template.maxWords,
      };
      const reply = composeDeterministicFallback(template);
      const v = validateTemplatedReply({
        reply,
        template,
        pack: aligned,
      });
      assert.equal(
        v.ok,
        true,
        `${strategyId} fail: ${v.ok ? "" : v.detail.join("; ")} | reply=${reply}`
      );
    }
  });

  it("CTA yoksa reject", () => {
    const brain = createInitialSalesBrain("t", 2);
    const pack = decideSalesDecision({
      brain,
      customerMessage: "merhaba",
    });
    const template = getTemplateForDecision(pack);
    if (!template.requireCta) return;
    const v = validateTemplatedReply({
      reply: "Sadece bilgi veriyorum, başka bir şey yok.",
      template,
      pack,
    });
    assert.equal(v.ok, false);
    if (!v.ok) assert.ok(v.violations.includes("missing_cta"));
  });

  it("iki soru reject", () => {
    const brain = createInitialSalesBrain("t", 2);
    brain.nextBestAction = "ask_question";
    const pack = decideSalesDecision({
      brain,
      customerMessage: "merhaba",
    });
    const template = getTemplateForDecision(pack);
    if (!template.requireQuestion) return;
    const v = validateTemplatedReply({
      reply: "Tarih net mi? Mekân belli mi? Yazın devam edelim.",
      template: { ...template, requireReference: false },
      pack,
    });
    assert.equal(v.ok, false);
    if (!v.ok) assert.ok(v.violations.includes("question_count"));
  });

  it("eski 12.000 paket fiyatı reject", () => {
    const brain = createInitialSalesBrain("t", 2);
    brain.nextBestAction = "give_price";
    const pack = decideSalesDecision({
      brain,
      customerMessage: "fiyat nedir",
    });
    const template = getTemplateForDecision(pack);
    const v = validateTemplatedReply({
      reply:
        "Dış çekim fotoğraf, sinematik klip, büyük albüm seti %20 ile 12.000 TL; drone hediye. Hangisine yakınsınız yazın.",
      template: { ...template, allowPrice: true, requireReference: false },
      pack,
    });
    assert.equal(v.ok, false);
    if (!v.ok) assert.ok(v.violations.includes("price_not_allowed"));
  });
});
