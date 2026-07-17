import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAssistantUserPrompt } from "@/features/ai/prompts/simple-assistant";
import { requiresHumanApproval } from "@/features/ai/services/simple-assistant.service";

describe("requiresHumanApproval", () => {
  it("normal soruda false döner", () => {
    assert.equal(requiresHumanApproval("Düğün videonuz var mı?"), false);
  });

  it("indirim talebinde true döner", () => {
    assert.equal(requiresHumanApproval("İndirim yapabilir misiniz?"), true);
  });

  it("iptal talebinde true döner", () => {
    assert.equal(
      requiresHumanApproval("Rezervasyonu iptal etmek istiyorum"),
      true
    );
  });
});

describe("buildAssistantUserPrompt", () => {
  it("profil, konuşma özeti ve gelen mesajı içerir", () => {
    const prompt = buildAssistantUserPrompt({
      customerMessage: "Merhaba, fiyat alabilir miyim?",
      contact: {
        fullName: "Mücahit Erova",
        username: "_mchtervo",
        phone: null,
        status: "lead",
      },
      recentMessages: [
        { senderType: "customer", content: "Merhabalar" },
        {
          senderType: "ai",
          content: "Hayırlı olsun! Düğün mü nişan mı planlıyorsunuz?",
        },
      ],
    });

    assert.match(prompt, /Mücahit Erova/);
    assert.match(prompt, /@_mchtervo/);
    assert.match(prompt, /Telefon: yok/);
    assert.match(prompt, /Şehir: Ankara/);
    assert.match(prompt, /Müşteri: Merhabalar/);
    assert.match(prompt, /Asistan: Hayırlı olsun/);
    assert.match(prompt, /Merhaba, fiyat alabilir miyim\?/);
  });
});
