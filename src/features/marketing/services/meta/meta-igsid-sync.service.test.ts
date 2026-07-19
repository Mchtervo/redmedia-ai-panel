import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeIgUsername } from "@/features/marketing/services/meta/meta-igsid-sync.service";

describe("normalizeIgUsername", () => {
  it("strips @ and lowercases", () => {
    assert.equal(normalizeIgUsername("@RedMedia.co"), "redmedia.co");
    assert.equal(normalizeIgUsername("  _mchtervo "), "_mchtervo");
  });

  it("handles empty", () => {
    assert.equal(normalizeIgUsername(null), "");
    assert.equal(normalizeIgUsername(undefined), "");
  });
});
