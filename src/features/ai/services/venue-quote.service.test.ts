import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculatePackageQuote,
  detectConversationFacts,
  buildVenueQuotePromptBlock,
  BASIC_CINEMA_PACKAGE_TRY,
  PREMIUM_ALBUM_PACKAGE_TRY,
  ELITE_PREMIUM_PACKAGE_TRY,
} from "./venue-quote.service";

describe("venue-quote.service (Basic 11k / Premium 14k / Elite 21k)", () => {
  it("düğün + albüm → Premium Albümlü 14.000 (kapora+plato dahil)", () => {
    const facts = detectConversationFacts(
      "Düğün için Başka Plato, albümlü paket istiyoruz."
    );
    const quote = calculatePackageQuote(facts);
    assert.equal(facts.prefersPremiumAlbum, true);
    assert.equal(quote.recommended, "premium_album");
    assert.equal(quote.premiumAlbumPrice, PREMIUM_ALBUM_PACKAGE_TRY);
    assert.equal(quote.basicPrice, BASIC_CINEMA_PACKAGE_TRY);
    assert.match(quote.kaporaNote, /14\.000.*kapora.*plato/i);
  });

  it("gelin alma → Elite Premium 21.000", () => {
    const facts = detectConversationFacts(
      "Düğün Başka Plato, gelin alma ve albüm istiyoruz."
    );
    const quote = calculatePackageQuote(facts);
    assert.equal(facts.prefersElite, true);
    assert.equal(quote.recommended, "elite_premium");
    assert.equal(quote.elitePrice, ELITE_PREMIUM_PACKAGE_TRY);
  });

  it("albüm istemeyince Basic ağırlık", () => {
    const facts = detectConversationFacts(
      "Düğün plato, albüm istemiyorum sadece foto ve klip."
    );
    assert.equal(facts.refusedAlbum, true);
    const quote = calculatePackageQuote(facts);
    assert.equal(quote.recommended, "basic_cinema");
  });

  it("ilk turda rakam yasak — keşif sorusu ister", () => {
    const block = buildVenueQuotePromptBlock(
      "",
      "selam dış çekim ne kadar"
    );
    assert.match(block, /KEŞİF TURU|RAKAM YAZMA/i);
    assert.match(block, /TEK soru|EN FAZLA 1 soru/i);
    assert.doesNotMatch(block, /ZORUNLU FİYAT CÜMLESİ|FİYAT CÜMLESİ \(keşif sonrası\)/);
  });

  it("keşif sonrası detay+ekstra önce, fiyat sonda; drone proaktif değil", () => {
    const block = buildVenueQuotePromptBlock(
      "Müşteri: düğün Başka Plato\nAsistan: Tabii, albüm de düşünüyor musunuz?",
      "Fiyat nedir? Albümsüz istiyoruz."
    );
    assert.match(block, /DETAYLI ANLATIM|FİYAT EN SON/i);
    assert.match(block, /Omuz|Kuaför|Kuafor/i);
    assert.match(block, /11\.000|11.000/);
    assert.match(block, /Proaktif önerme|istemeden önerme/i);
    const detailAt = block.search(/PAKET DETAYI|Basic Cinema içeriği/i);
    const priceAt = block.search(/FİYAT \/ KAPORA|YALNIZ MESAJIN EN SONUNDA/i);
    assert.ok(detailAt >= 0 && priceAt > detailAt);
  });

  it("kararsızlıkta dış çekim drone kapanış sinyali", () => {
    const facts = detectConversationFacts(
      "Düğün Başka Plato. Pahalı geldi bakarız belki başka yere gideriz."
    );
    assert.equal(facts.hesitating, true);
    assert.equal(facts.outdoorShootContext, true);
  });

  it("'kız istemene alaka' şikâyetini etkinlik sanmaz", () => {
    const facts = detectConversationFacts(
      "kız istemene alaka birde ne diceğimi nerden çaırktın kı sen"
    );
    assert.equal(facts.eventType, "unknown");
  });

  it("olumlu kız isteme niyetini yakalar", () => {
    const facts = detectConversationFacts(
      "Kız isteme için çekim istiyoruz, evde olacak."
    );
    assert.equal(facts.eventType, "kız_isteme");
  });

  it("tarif sorusunu fiyat niyeti sayar", () => {
    const facts = detectConversationFacts("belki tarif soracaktım");
    assert.equal(facts.mentionedPhotoOrClip, true);
    assert.equal(facts.eventType, "unknown");
  });

  it("yalnız dış çekimde Basic önerir, düğün/gelin varsaymaz", () => {
    const facts = detectConversationFacts(
      "Merhaba dış çekim fiyatı nedir, plato düşünüyoruz"
    );
    assert.equal(facts.outdoorOnlyInquiry, true);
    assert.equal(facts.eventType, "unknown");
    const quote = calculatePackageQuote(facts);
    assert.equal(quote.recommended, "basic_cinema");
    const discovery = buildVenueQuotePromptBlock(
      "",
      "Merhaba dış çekim fiyatı nedir, plato düşünüyoruz"
    );
    assert.match(discovery, /RAKAM YAZMA|KEŞİF/i);
    assert.match(discovery, /gelin|GELİN|varsay/i);

    const priced = buildVenueQuotePromptBlock(
      "Müşteri: dış çekim ne kadar\nAsistan: Tabii, foto+klip mi albüm de mi?",
      "Sadece foto ve klip, bahçede"
    );
    assert.match(priced, /Basic|11\.000|11.000/);
    assert.match(priced, /gelin alma dayatma YASAK|GELİN ALMA VARSAYMA|varsaymak/i);
  });
});
