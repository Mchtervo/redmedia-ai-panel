import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requiresHumanApproval } from "@/features/ai/services/simple-assistant.service";

describe("requiresHumanApproval", () => {
  it("normal soruda false döner", () => {
    assert.equal(requiresHumanApproval("Düğün videonuz var mı?"), false);
  });

  it("indirim talebinde true döner", () => {
    assert.equal(requiresHumanApproval("İndirim yapabilir misiniz?"), true);
  });

  it("iptal talebinde true döner", () => {
    assert.equal(requiresHumanApproval("Rezervasyonu iptal etmek istiyorum"), true);
  });
});
