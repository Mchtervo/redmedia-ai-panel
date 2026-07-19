import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maskPii, maskPiiDeep } from "@/features/learning/utils/pii-mask";
import { conversationExtractionSchema } from "@/features/learning/validators/extraction-schema";
import { importConversationsPayloadSchema } from "@/features/learning/validators/import-conversations";

describe("maskPii", () => {
  it("telefon ve e-postayı maskeler", () => {
    const masked = maskPii("Ara: 0532 111 22 33 veya test@example.com");
    assert.match(masked, /\[telefon-gizli\]/);
    assert.match(masked, /\[e-posta-gizli\]/);
    assert.equal(masked.includes("0532"), false);
    assert.equal(masked.includes("test@"), false);
  });

  it("iç içe nesnelerde maskeler", () => {
    const result = maskPiiDeep({
      note: "05551234567",
      nested: { mail: "a@b.com" },
    });
    assert.equal(result.note, "[telefon-gizli]");
    assert.equal(result.nested.mail, "[e-posta-gizli]");
  });
});

describe("conversationExtractionSchema", () => {
  it("geçerli extraction kabul eder", () => {
    const parsed = conversationExtractionSchema.safeParse({
      customerIntent: "Düğün videosu",
      eventType: "düğün",
      eventDateText: "18 Temmuz 2026",
      venueType: "salon",
      requestedServices: "sinematik klip",
      budgetOrPriceQuestion: "Fiyat nedir?",
      objections: "Pahalı geldi",
      phoneCollected: false,
      saleOutcome: "open",
      advancingReply: "Tarihi netleştirelim",
      losingReply: null,
      frequentQuestion: "Kaç kameraman geliyor?",
      recommendedAnswer: "Paket içeriğine göre değişir",
      leadScore: 60,
      saleProbability: 45,
      leadTemperature: "warm",
      lossReason: null,
      nextAction: "Telefon iste",
      summary: "Düğün videosu soruyor",
      customerNeeds: "Sinematik klip",
      knowledgeProposals: [
        {
          category: "sik_sorulan_sorular",
          title: "Kamera sayısı",
          content: "Paket içeriğine göre değişir; kesin sayı uydurma.",
          faqQuestion: "Kaç kameraman geliyor?",
          suggestedAnswer: "Paket içeriğine göre değişir",
          isPricingSensitive: false,
          isCampaignClaim: false,
          staffAnswerUnreliable: false,
        },
      ],
    });

    assert.equal(parsed.success, true);
  });

  it("fiyat hassas öneriyi işaretli tutar", () => {
    const parsed = conversationExtractionSchema.safeParse({
      customerIntent: null,
      eventType: null,
      eventDateText: null,
      venueType: null,
      requestedServices: null,
      budgetOrPriceQuestion: "25 bin mi?",
      objections: null,
      phoneCollected: false,
      saleOutcome: "unknown",
      advancingReply: null,
      losingReply: null,
      frequentQuestion: null,
      recommendedAnswer: null,
      leadScore: 10,
      saleProbability: 5,
      leadTemperature: "cold",
      lossReason: null,
      nextAction: null,
      summary: null,
      customerNeeds: null,
      knowledgeProposals: [
        {
          category: "fiyatlandirma_kurallari",
          title: "Eski fiyat iddiası",
          content: "Konuşmada 25.000 TL geçti; doğrulanmadan kullanma.",
          isPricingSensitive: true,
          isCampaignClaim: false,
          staffAnswerUnreliable: false,
        },
      ],
    });

    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.knowledgeProposals[0]?.isPricingSensitive, true);
    }
  });
});

describe("importConversationsPayloadSchema", () => {
  it("geçerli import paketini kabul eder", () => {
    const parsed = importConversationsPayloadSchema.safeParse({
      conversations: [
        {
          externalConversationId: "ig-1",
          channel: "instagram",
          contact: {
            instagramUserId: "u1",
            username: "test",
            fullName: "Test",
          },
          messages: [
            {
              externalMessageId: "m1",
              direction: "inbound",
              content: "Merhaba",
            },
          ],
        },
      ],
    });
    assert.equal(parsed.success, true);
  });
});
