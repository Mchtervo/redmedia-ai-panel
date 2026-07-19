import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeSalesPlaybookBlock } from "./sales-playbook.service";
import { composeCompanyBrainPromptBlock } from "./company-brain.service";

describe("sales-playbook", () => {
  it("kısa paket referansı ve kırmızı çizgileri içerir", () => {
    const block = composeSalesPlaybookBlock();
    assert.match(block, /Premium Albümlü 14\.000/);
    assert.match(block, /Basic Cinema 11\.000/);
    assert.match(block, /Elite Premium 21\.000/);
    assert.match(block, /kapanış scripti YASAK|kesinleşti DEME/);
  });

  it("şirket beynine gömülür", () => {
    const brain = composeCompanyBrainPromptBlock({
      catalogBlock: "katalog test",
      salesLearningBlock: null,
    });
    assert.match(brain, /DM satış/);
    assert.match(brain, /katalog test/);
    assert.match(brain, /Premium Albümlü = 14\.000/);
  });
});
