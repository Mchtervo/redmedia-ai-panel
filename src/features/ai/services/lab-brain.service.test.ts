import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterSpuriousCritiqueItems,
  runDeterministicLabChecks,
} from "@/features/ai/services/lab-brain.service";

describe("runDeterministicLabChecks", () => {
  it("sepet tutarı ifadesini yakalar", () => {
    const checks = runDeterministicLabChecks(
      "fiyat?",
      "",
      "Sepet tutarı 15.000 TL"
    );
    const sepet = checks.find((c) => c.rule.includes("Sepet"));
    assert.equal(sepet?.pass, false);
  });

  it("kapora eksikliğini fiyat cevabında yakalar", () => {
    const checks = runDeterministicLabChecks(
      "ne kadar?",
      "",
      "Paket 11.000 TL oluyor."
    );
    const kapora = checks.find((c) => c.rule.includes("kapora"));
    assert.equal(kapora?.pass, false);
  });

  it("eski 12.000 paket fiyatını yakalar", () => {
    const checks = runDeterministicLabChecks(
      "Fiyat nedir?",
      "Düğün Başka Plato düşünüyoruz.",
      "Paket 12.000 TL oluyor."
    );
    const bad = checks.find((c) => c.rule.includes("14.000"));
    assert.equal(bad?.pass, false);
  });

  it("Premium Albümlü 14.000 geçerli fiyattır", () => {
    const checks = runDeterministicLabChecks(
      "Albümlü paket ne kadar?",
      "Müşteri: düğün\nAsistan: Tabii, albüm önemli mi sizin için?",
      "Premium Albümlü 14.000 TL; kapora ve plato giriş dahil."
    );
    const bad = checks.find((c) => c.rule.includes("eski") || c.rule.includes("12.000"));
    assert.equal(bad, undefined);
    const kapora = checks.find((c) => c.rule.includes("kapora"));
    assert.equal(kapora?.pass, true);
  });

  it("eşinizle bugün/hafta sonu scriptini yakalar", () => {
    const checks = runDeterministicLabChecks(
      "tamam teşekkürler.",
      "Müşteri: fiyat\nAsistan: Basic 11.000",
      "Rica ederim. Eşinizle bugün mü konuşursunuz hafta sonu mu?"
    );
    const bad = checks.find((c) => c.rule.includes("kapanış scripti"));
    assert.equal(bad?.pass, false);
  });

  it("bilgi dump / cognitive load yakalar", () => {
    const checks = runDeterministicLabChecks(
      "paket detayı?",
      "Müşteri: merhaba\nAsistan: Tabii, nasıl bir çekim?",
      "22 retouch, albüm seçenekleri, foto 3 gün, klip 7 gün, drone ve yedek ekipman var; omuz da ekleyebiliriz."
    );
    const bad = checks.find((c) => c.rule.includes("Cognitive load"));
    assert.equal(bad?.pass, false);
  });

  it("erken drone hediye spoilerni yakalar", () => {
    const checks = runDeterministicLabChecks(
      "Fiyat nedir?",
      "Düğün plato",
      "Elite 21.000 TL, drone hediye."
    );
    const bad = checks.find((c) => c.rule.includes("Drone hediye erken"));
    assert.equal(bad?.pass, false);
  });

  it("dış çekimde düğün varsayımını yakalar", () => {
    const checks = runDeterministicLabChecks(
      "Dış çekim fiyatı nedir?",
      "Müşteri: Dış çekim bakıyoruz",
      "Düğünüz hayırlı olsun, gelin alma da Elite pakette."
    );
    const bad = checks.find((c) => c.rule.includes("düğün/gelin"));
    assert.equal(bad?.pass, false);
  });

  it("genel fiyat sorusunda dış çekim varsayımını yakalar", () => {
    const checks = runDeterministicLabChecks(
      "merhaba paketlerinizi ve fiyatları öğrenebilir miyim",
      "",
      "Dış çekim için Basic Cinema 11.000 TL, plato dahil; kapora 1.000 TL."
    );
    const bad = checks.find((c) => c.rule.includes("dış çekim varsayma"));
    assert.equal(bad?.pass, false);
  });

  it("plato şart demeyi yakalar", () => {
    const checks = runDeterministicLabChecks(
      "Bahçede çekim olur mu plato şart mı?",
      "",
      "Plato şart, yoksa çekim yapamıyoruz."
    );
    const bad = checks.find((c) => c.rule.includes("Plato şart değil"));
    assert.equal(bad?.pass, false);
  });

  it("ilk turda fiyat rakamı vermeyi yakalar", () => {
    const checks = runDeterministicLabChecks(
      "selam dış çekim ne kadar",
      "",
      "Selam, dış çekim için Basic Cinema paketimiz 11.000 TL; kapora 1.000 TL."
    );
    const bad = checks.find((c) => c.rule.includes("samimiyet"));
    assert.equal(bad?.pass, false);
  });

  it("detay varken fiyatı öne almayı yakalar", () => {
    const checks = runDeterministicLabChecks(
      "foto ve klip istiyoruz bahçede",
      "Müşteri: dış çekim\nAsistan: Tabii, albüm de düşünüyor musunuz?",
      "Basic 11.000 TL. Poz sınırı yok, tüm kareler teslim, sinematik klip var."
    );
    const bad = checks.find((c) => c.rule.includes("Fiyat en sonda"));
    assert.equal(bad?.pass, false);
  });

  it("istemeden drone önermeyi yakalar", () => {
    const checks = runDeterministicLabChecks(
      "foto ve klip istiyoruz",
      "Müşteri: dış çekim\nAsistan: Tabii, nasıl bir paket düşünüyorsunuz?",
      "Poz sınırı yok, tüm kareler teslim. İsterseniz drone de ekleyebilirim 4.000 TL. Paket 11.000 TL."
    );
    const bad = checks.find((c) => c.rule.includes("Drone istemeden"));
    assert.equal(bad?.pass, false);
  });

  it("üst üste soruyu yakalar", () => {
    const checks = runDeterministicLabChecks(
      "dış çekim bakıyoruz",
      "",
      "Bahçe mi plato mu? Tarihiniz net mi? Albüm önemli mi?"
    );
    const bad = checks.find((c) => c.rule.includes("Üst üste soru"));
    assert.equal(bad?.pass, false);
  });

  it("bakarız sonrası zayıf kapanışı yakalar", () => {
    const checks = runDeterministicLabChecks(
      "tamam teşekkürler bakarız",
      "Müşteri: fiyat\nAsistan: Basic 11.000",
      "Rica ederim, iyi günler."
    );
    const bad = checks.find((c) => c.rule.includes("Zayıf kapanış"));
    assert.equal(bad?.pass, false);
  });

  it("orta sohbette tekrar merhabayı yakalar", () => {
    const checks = runDeterministicLabChecks(
      "Bu platolarda fiyatlar nasıl oluyor?",
      "Müşteri: merhaba\nAsistan: Basic 11.000 Elite 21.000",
      "Merhabalar! Anlaşmalı platolarımızda giriş ücreti yok."
    );
    const bad = checks.find((c) => c.rule.includes("tekrar merhaba"));
    assert.equal(bad?.pass, false);
  });

  it("özel fiyatı ekibe iletmeyi yakalar", () => {
    const checks = runDeterministicLabChecks(
      "10.000 yapar mısınız?",
      "",
      "Basic 11.000 TL; 10.000 için özel fiyat talebinizi ekibe ileteyim."
    );
    const bad = checks.find((c) => c.rule.includes("ekibe"));
    assert.equal(bad?.pass, false);
  });

  it("temiz cevapta LLM hata satırlarını filtreler", () => {
    const checks = runDeterministicLabChecks(
      "fiyat nedir?",
      "Müşteri: merhaba\nAsistan: Tabii, nasıl bir çekim düşünüyorsunuz?",
      "Elbette, erken rezervasyona özel Basic 11.000 TL, Elite 21.000 TL; kapora 1.000 TL."
    );
    assert.ok(checks.every((c) => c.pass));
    const filtered = filterSpuriousCritiqueItems(
      [
        "HATA: sepet tutarı deme — kapora bilgisi gereksiz tekrar",
        "HATA: Kapora ile ilgili bilgi verilmemiş",
        "DOĞRU: Fiyat net",
      ],
      checks
    );
    assert.deepEqual(filtered, ["DOĞRU: Fiyat net"]);
  });
});
