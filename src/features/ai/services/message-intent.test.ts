import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasExplicitPriceIntent,
  isGreetingOnly,
  isInformalChitchat,
  isNearDuplicateReply,
} from "./message-intent";

describe("message-intent", () => {
  it("selamlama fiyat niyeti değil", () => {
    for (const m of ["Merhaba", "Merhabalar", "Selam", "selam!"]) {
      assert.equal(isGreetingOnly(m), true, m);
      assert.equal(hasExplicitPriceIntent(m), false, m);
    }
  });

  it("informal chitchat", () => {
    assert.equal(isInformalChitchat("Ne diyorsun aga"), true);
    assert.equal(hasExplicitPriceIntent("Ne diyorsun aga"), false);
  });

  it("açık fiyat niyeti", () => {
    assert.equal(hasExplicitPriceIntent("Fiyat nedir?"), true);
    assert.equal(hasExplicitPriceIntent("Dış çekim fiyatı kaç?"), true);
    assert.equal(isGreetingOnly("Fiyat nedir?"), false);
  });

  it("tarihli selamlama selamlama-only değil", () => {
    assert.equal(isGreetingOnly("Merhaba, 15 Ağustos düğünümüz var"), false);
  });

  it("duplicate reply yakalar", () => {
    const a =
      "Dış çekim fotoğraf, sinematik klip, büyük albüm seti %20 ile 12.000 TL";
    assert.equal(isNearDuplicateReply(a, a), true);
    assert.equal(isNearDuplicateReply(a, "Selam, nasıl yardımcı olayım?"), false);
  });
});
