import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInitialSalesBrain } from "@/features/ai/services/sales-brain.service";
import {
  composeDecisionEnginePromptBlock,
  decideSalesDecision,
  enforceDecisionEngineOnReply,
} from "./decision-engine.service";

describe("decision-engine", () => {
  it("kararsız + fiyat riskinde PRICE_DEFENSE_v3 seçer", () => {
    const brain = createInitialSalesBrain("t", 4);
    brain.persona = "undecided";
    brain.state = "objection";
    brain.mainBlocker = "price";
    brain.scores.priceSensitivity = 80;
    brain.scores.trust = 50;
    brain.scores.purchaseIntent = 55;
    brain.objective = "resolve_objection";
    brain.nextBestAction = "ask_question";

    const pack = decideSalesDecision({
      brain,
      customerMessage: "biraz pahalı geldi açıkçası",
    });

    assert.equal(pack.strategyId, "PRICE_DEFENSE_v3");
    assert.equal(pack.analysis.personaLabel, "Kararsız");
    assert.equal(pack.analysis.stageLabel, "İtiraz");
    assert.equal(pack.analysis.risk, "Fiyat");
    assert.equal(pack.allowPrice, false);
    assert.ok(pack.analysis.leadTemperature >= 0);
  });

  it("NBA give_price iken GIVE_PRICE_SHORT_v2", () => {
    const brain = createInitialSalesBrain("t", 5);
    brain.nextBestAction = "give_price";
    brain.objective = "give_price";
    brain.scores.trust = 70;
    const pack = decideSalesDecision({
      brain,
      customerMessage: "paketleriniz neler",
    });
    assert.equal(pack.strategyId, "GIVE_PRICE_SHORT_v2");
    assert.equal(pack.allowPrice, true);
  });

  it("prompt bloğu Strategy + yasak kalıplar içerir", () => {
    const brain = createInitialSalesBrain("t", 2);
    const pack = decideSalesDecision({
      brain,
      customerMessage: "merhaba",
    });
    const block = composeDecisionEnginePromptBlock(pack);
    assert.match(block, /DECISION ENGINE/);
    assert.match(block, /Strategy:/);
    assert.match(block, /Harika/i);
    assert.match(block, /SADECE yaz/);
  });

  it("GPT filler ve fazla kelimeyi temizler", () => {
    const brain = createInitialSalesBrain("t", 2);
    const pack = decideSalesDecision({
      brain,
      customerMessage: "merhaba",
    });
    pack.maxWords = 10;
    const raw =
      "Harika! Çok normal, heyecanınızı paylaşıyoruz. Birçok çift böyle düşünüyor ve kararsız kalmanız normal. " +
      "Sonra uzun uzun anlatırım paketleri ve ekstra her şeyi.";
    const { reply, strippedFillers, truncated } = enforceDecisionEngineOnReply(
      raw,
      pack
    );
    assert.ok(strippedFillers.length >= 2);
    assert.ok(truncated);
    assert.doesNotMatch(reply, /harika/i);
    assert.ok(reply.split(/\s+/).length <= 12);
  });
});
