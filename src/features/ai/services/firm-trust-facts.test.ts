import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeFirmTrustFactsBlock } from "./firm-trust-facts";
import { composeCompanyBrainPromptBlock } from "./company-brain.service";

describe("firm-trust-facts", () => {
  it("işletme güven satırlarını içerir", () => {
    const block = composeFirmTrustFactsBlock();
    assert.match(block, /7 yıldır|Ankara/);
    assert.match(block, /redmedia\.co|redmediadugun\.com/i);
    assert.match(block, /3 gün|7 gün|1 ay/);
    assert.match(block, /yedek ekipman/i);
    assert.match(block, /sözleşme yapmıyoruz|kapora dekontu/i);
    assert.match(block, /Düğün\.com|3\./);
    assert.match(block, /1–2 dk|1-2 dk/);
  });

  it("şirket beyninde görünür", () => {
    const brain = composeCompanyBrainPromptBlock({
      catalogBlock: "x",
      salesLearningBlock: null,
    });
    assert.match(brain, /Güven unsurları/);
  });
});
