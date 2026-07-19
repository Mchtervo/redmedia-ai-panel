import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDaysToIsoDate,
  buildAssistantUserPrompt,
  formatTurkishLongDate,
} from "@/features/ai/prompts/simple-assistant";
import { requiresHumanApproval } from "@/features/ai/services/simple-assistant.service";

describe("requiresHumanApproval", () => {
  it("normal soruda false döner", () => {
    assert.equal(requiresHumanApproval("Düğün videonuz var mı?"), false);
  });

  it("paket indirim pazarlığında false döner (bot fiyatı tutar)", () => {
    assert.equal(requiresHumanApproval("İndirim yapabilir misiniz?"), false);
    assert.equal(requiresHumanApproval("10.000 özel fiyat olur mu?"), false);
  });

  it("iptal talebinde true döner", () => {
    assert.equal(
      requiresHumanApproval("Rezervasyonu iptal etmek istiyorum"),
      true
    );
  });
});

describe("formatTurkishLongDate", () => {
  it("ISO tarihi Türkçe uzun formata çevirir", () => {
    assert.equal(formatTurkishLongDate("2026-07-18"), "18 Temmuz 2026");
  });
});

describe("addDaysToIsoDate", () => {
  it("ertesi günü hesaplar", () => {
    assert.equal(addDaysToIsoDate("2026-07-17", 1), "2026-07-18");
  });
});

describe("buildAssistantUserPrompt", () => {
  it("CRM profili, konuşma özeti, bugün ve gelen mesajı içerir", () => {
    const prompt = buildAssistantUserPrompt({
      customerMessage: "Yarın",
      crmProfile: {
        fullName: "Mücahit Erova",
        username: "_mchtervo",
        phone: null,
        phoneVerified: false,
        status: "interested",
        leadScore: 30,
        bookingProbability: 20,
        eventType: "nişan",
        eventDate: null,
        venue: null,
        city: "Ankara",
        budget: null,
        requestedServices: ["drone"],
        objections: null,
        lastSummary: "İlk temas; etkinlik türü nişan.",
        lastAiResponse: null,
        tags: [],
        totalMessages: 2,
        totalConversations: 1,
        memorySummary: "İlk temas; etkinlik türü nişan.",
        negotiationTendency: null,
        priceSensitivity: null,
        rejectedServices: [],
        preferredPackages: [],
        budgetRange: null,
        decisionSpeed: null,
        priorQuoteReceived: false,
        priorReservation: false,
        priorCancellation: false,
        interestedCampaigns: [],
        mentionedDates: [],
        preferredStyle: null,
        communicationTone: null,
        usesEmoji: null,
        formality: null,
        frequentQuestions: [],
        customerType: null,
        customerTypeConfidence: null,
        aiNotes: null,
        lifecycleStage: "gathering_info",
        opportunityScore: 30,
        adminNotes: null,
      },
      recentMessages: [
        { senderType: "customer", content: "Merhabalar" },
        {
          senderType: "ai",
          content: "Hayırlı olsun! Tarihi paylaşır mısınız?",
        },
      ],
      todayIsoDate: "2026-07-17",
      conversationSummary: "İlk temas; etkinlik türü bekleniyor.",
      reservationDraftBlock: "Taslak: nişan · müsaitlik kontrol edildi",
      approvedKnowledge: [
        {
          category: "telefon_alma",
          title: "Telefon",
          content: "Fiyat öncesi telefon iste.",
        },
      ],
    });

    assert.match(prompt, /Mücahit Erova/);
    assert.match(prompt, /@_mchtervo/);
    assert.match(prompt, /17 Temmuz 2026/);
    assert.match(prompt, /18 Temmuz 2026/);
    assert.match(prompt, /tam tarih iste/);
    assert.match(prompt, /CRM profili/);
    assert.match(prompt, /nişan/);
    assert.match(prompt, /drone/);
    assert.match(prompt, /Rezervasyon taslağı/);
    assert.match(prompt, /nişan · müsaitlik/);
    assert.match(prompt, /Onaylı işletme bilgisi/);
    assert.match(prompt, /Fiyat öncesi telefon iste/);
    assert.match(prompt, /Katalog yedek özet|şirket beyni/i);
    assert.match(prompt, /\nYarın$/m);
  });

  it("katalog bloğunu prompta ekler", () => {
    const prompt = buildAssistantUserPrompt({
      customerMessage: "Paketler neler?",
      crmProfile: null,
      recentMessages: [],
      todayIsoDate: "2026-07-18",
      catalogBlock: "- Fotoğraf çekimi: ₺10.000",
    });
    assert.match(prompt, /Fotoğraf çekimi: ₺10\.000/);
  });
});
