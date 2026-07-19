import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getLabPersona,
  LAB_PERSONA_IDS,
  listLabPersonas,
  pickPersonaOpener,
} from "./lab-stress-customer.service";

describe("lab personas", () => {
  it("13 persona tanımlı ve hepsi açılışa sahip", () => {
    const all = listLabPersonas();
    assert.equal(all.length, LAB_PERSONA_IDS.length);
    for (const id of LAB_PERSONA_IDS) {
      const p = getLabPersona(id);
      assert.equal(p.id, id);
      assert.ok(p.opener.length > 5);
      assert.ok(p.fallbacks.length >= 3);
      assert.match(p.label, /.+/);
    }
  });

  it("kolay → zor zorluk etiketleri var", () => {
    const diffs = new Set(listLabPersonas().map((p) => p.difficulty));
    assert.ok(diffs.has("kolay"));
    assert.ok(diffs.has("orta"));
    assert.ok(diffs.has("zor"));
  });

  it("persona opener sabit", () => {
    assert.match(pickPersonaOpener("zor_pazarlik"), /dış çekim|ne kadar/i);
  });
});
