import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractProfileDeltaHeuristics,
  mergeRequestedServices,
  parseTurkishDateMention,
} from "@/features/customer-intelligence/utils/profile-extract";

describe("extractProfileDeltaHeuristics", () => {
  it("nişan etkinlik türünü çıkarır", () => {
    const delta = extractProfileDeltaHeuristics("Nişanım var.", "2026-07-17");
    assert.equal(delta.eventType, "nişan");
  });

  it("15 Ağustos tarihini ISO'ya çevirir", () => {
    const delta = extractProfileDeltaHeuristics("15 Ağustos.", "2026-07-17");
    assert.equal(delta.eventDate, "2026-08-15");
  });

  it("telefon numarasını çıkarır", () => {
    const delta = extractProfileDeltaHeuristics(
      "Telefonum 05551234567",
      "2026-07-17"
    );
    assert.equal(delta.phone, "05551234567");
    assert.equal(delta.phoneVerified, true);
  });

  it("drone hizmetini ekler", () => {
    const delta = extractProfileDeltaHeuristics(
      "Drone de istiyorum.",
      "2026-07-17"
    );
    assert.deepEqual(delta.requestedServices, ["drone"]);
  });

  it("göreceli tarihi kesin kabul etmez", () => {
    assert.equal(parseTurkishDateMention("Yarın", "2026-07-17"), null);
  });
});

describe("mergeRequestedServices", () => {
  it("mevcut listeye yeni hizmet ekler", () => {
    assert.deepEqual(mergeRequestedServices(["video"], ["drone", "video"]), [
      "video",
      "drone",
    ]);
  });
});
