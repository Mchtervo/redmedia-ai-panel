import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInitialSalesBrain } from "@/features/ai/services/sales-brain.service";
import {
  composeStrategistPromptBlock,
  decideConversationStrategy,
} from "./conversation-strategist.service";

describe("conversation-strategist", () => {
  it("güven düşükken fiyat sorusunda withhold_price seçer", () => {
    const brain = createInitialSalesBrain("t", 1);
    brain.scores.trust = 30;
    brain.objective = "build_trust";
    const s = decideConversationStrategy({
      brain,
      customerMessage: "fiyat ne kadar?",
    });
    assert.equal(s.move, "withhold_price");
    assert.equal(s.allowPrice, false);
  });

  it("sinirli mesajda empathy_only seçer", () => {
    const brain = createInitialSalesBrain("t", 2);
    const s = decideConversationStrategy({
      brain,
      customerMessage: "yeter artık sinir oldum",
    });
    assert.equal(s.move, "empathy_only");
    assert.equal(s.allowQuestion, false);
  });

  it("NBA give_price + açık fiyat niyeti → give_price", () => {
    const brain = createInitialSalesBrain("t", 4);
    brain.nextBestAction = "give_price";
    brain.objective = "give_price";
    brain.scores.trust = 70;
    const s = decideConversationStrategy({
      brain,
      customerMessage: "fiyat nedir?",
    });
    assert.equal(s.move, "give_price");
    assert.equal(s.allowPrice, true);
  });

  it("NBA give_price olsa bile selamlamada fiyat vermez", () => {
    const brain = createInitialSalesBrain("t", 4);
    brain.nextBestAction = "give_price";
    brain.objective = "give_price";
    const s = decideConversationStrategy({
      brain,
      customerMessage: "Merhabalar",
    });
    assert.equal(s.move, "greeting_ack");
    assert.equal(s.allowPrice, false);
  });

  it("prompt bloğu hamle emri içerir", () => {
    const brain = createInitialSalesBrain("t", 1);
    const s = decideConversationStrategy({
      brain,
      customerMessage: "merhaba",
    });
    assert.equal(s.move, "greeting_ack");
    const block = composeStrategistPromptBlock(s);
    assert.match(block, /CONVERSATION STRATEGIST/);
    assert.match(block, new RegExp(s.move));
  });
});
