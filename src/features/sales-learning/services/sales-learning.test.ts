import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeKey } from "@/features/sales-learning/repositories/sales-learning.repository";
import {
  buildSalesLearningPromptBlock,
  detectRelevantPatternTypes,
} from "@/features/sales-learning/services/sales-context.service";
import { shouldMarkBestConversation } from "@/features/sales-learning/services/sales-learning-ingest.service";
import { getWeekStart } from "@/features/sales-learning/services/weekly-report.service";
import type {
  AiMistakeRow,
  CompanyPersonalityTraitRow,
  SalesLearningContext,
  SalesPatternRow,
} from "@/features/sales-learning/types";
import type { ConversationExtraction } from "@/features/learning/validators/extraction-schema";

describe("normalizeKey", () => {
  it("noktalama ve boşluk farklarını birleştirir", () => {
    assert.equal(
      normalizeKey("Hayırlı olsun! Tarihiniz belli mi?"),
      normalizeKey("hayırlı olsun tarihiniz belli mi")
    );
  });

  it("Türkçe büyük İ harfini doğru küçültür", () => {
    assert.equal(normalizeKey("İNDİRİM"), "indirim");
  });
});

describe("detectRelevantPatternTypes", () => {
  it("fiyat sorusunda fiyat anlatımı kalıplarını önceliklendirir", () => {
    const types = detectRelevantPatternTypes("Gelin alma klibi kaç para?");
    assert.ok(types.includes("price_explanation"));
  });

  it("rezervasyon niyetinde kapanış kalıplarını önceliklendirir", () => {
    const types = detectRelevantPatternTypes("Tarihi ayırtmak istiyoruz");
    assert.ok(types.includes("closing"));
  });

  it("selamlaşmada açılış kalıplarını önceliklendirir", () => {
    const types = detectRelevantPatternTypes("Merhaba, bilgi alabilir miyim?");
    assert.ok(types.includes("opening"));
  });
});

function makePattern(
  overrides: Partial<SalesPatternRow> & {
    pattern_type: SalesPatternRow["pattern_type"];
    pattern_text: string;
  }
): SalesPatternRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    pattern_key: normalizeKey(overrides.pattern_text),
    context_note: null,
    won_count: 3,
    lost_count: 1,
    seen_count: 4,
    success_rate: 75,
    confidence: 60,
    status: "active",
    superseded_by: null,
    source_conversation_ids: [],
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("buildSalesLearningPromptBlock", () => {
  it("boş hafızada null döner", () => {
    const context: SalesLearningContext = {
      patterns: [],
      personality: [],
      activeMistakes: [],
      bestConversations: [],
    };
    assert.equal(buildSalesLearningPromptBlock(context, "Merhaba"), null);
  });

  it("kalıpları, hataları ve kişiliği bloklara yazar", () => {
    const trait: CompanyPersonalityTraitRow = {
      id: crypto.randomUUID(),
      trait_type: "pricing_style",
      trait_text: "Fiyat öncesi tarih ve mekan netleştirilir",
      trait_key: "x",
      evidence_count: 5,
      confidence: 80,
      status: "active",
      source_conversation_ids: [],
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const mistake: AiMistakeRow = {
      id: crypto.randomUUID(),
      mistake_type: "premature_detail_question",
      trigger_context: "Müşteri fiyat sordu",
      wrong_reply: "Nerede olacak?",
      correct_approach: "Önce bilgi ver, sonra detay iste",
      mistake_key: "y",
      occurrence_count: 2,
      is_resolved: false,
      resolved_note: null,
      source_conversation_id: null,
      source_ai_run_id: null,
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const context: SalesLearningContext = {
      patterns: [
        makePattern({
          pattern_type: "price_explanation",
          pattern_text: "Paketler çiftin isteğine göre oluşturulur denir",
        }),
        makePattern({
          pattern_type: "leave_reason",
          pattern_text: "Uzun süre cevapsız bırakılan müşteri ayrılıyor",
        }),
      ],
      personality: [trait],
      activeMistakes: [mistake],
      bestConversations: [
        {
          analysisId: crypto.randomUUID(),
          conversationId: crypto.randomUUID(),
          summary: null,
          customerIntent: "Düğün klibi",
          firstCustomerQuestion: "Düğün klibi kaç para?",
          firstReplyGiven: null,
          advancingReply: "Hayırlı olsun! Paketleri size göre oluşturuyoruz.",
          scoreSalesQuality: 92,
          saleOutcome: "won",
          reservationCreated: true,
          depositReceived: true,
          analyzedAt: new Date().toISOString(),
        },
      ],
    };

    const block = buildSalesLearningPromptBlock(context, "Fiyat ne kadar?");
    assert.ok(block);
    assert.match(block!, /Redmedia iletişim kimliği/);
    assert.match(block!, /Başarılı satış kalıpları/);
    assert.match(block!, /başarı %75/);
    assert.match(block!, /Kaybettiren yaklaşımlar/);
    assert.match(block!, /ASLA TEKRARLAMA/);
    assert.match(block!, /Önce bilgi ver, sonra detay iste/);
    assert.match(block!, /En başarılı satış konuşmalarından örnekler/);
  });
});

function makeExtraction(
  overrides: Partial<ConversationExtraction>
): ConversationExtraction {
  return {
    customerIntent: null,
    eventType: null,
    eventDateText: null,
    venueType: null,
    requestedServices: null,
    budgetOrPriceQuestion: null,
    objections: null,
    phoneCollected: false,
    saleOutcome: "unknown",
    advancingReply: null,
    losingReply: null,
    frequentQuestion: null,
    recommendedAnswer: null,
    leadScore: 50,
    saleProbability: 50,
    leadTemperature: "warm",
    lossReason: null,
    nextAction: null,
    summary: null,
    customerNeeds: null,
    knowledgeProposals: [],
    firstCustomerQuestion: null,
    firstReplyGiven: null,
    dropOffPoint: null,
    reservationCreated: false,
    depositReceived: false,
    scores: null,
    salesPatterns: [],
    personalityObservations: [],
    aiMistakes: [],
    ...overrides,
  };
}

describe("shouldMarkBestConversation", () => {
  it("kazanılan ve yüksek puanlı konuşmayı kütüphaneye alır", () => {
    const extraction = makeExtraction({
      saleOutcome: "won",
      scores: {
        salesQuality: 90,
        empathy: 85,
        speed: 80,
        persuasion: 88,
        closing: 92,
        gaps: null,
      },
    });
    assert.equal(shouldMarkBestConversation(extraction), true);
  });

  it("kaybedilen konuşmayı puanı yüksek olsa da almaz", () => {
    const extraction = makeExtraction({
      saleOutcome: "lost",
      scores: {
        salesQuality: 95,
        empathy: 90,
        speed: 90,
        persuasion: 90,
        closing: 90,
        gaps: null,
      },
    });
    assert.equal(shouldMarkBestConversation(extraction), false);
  });

  it("düşük puanlı kazanılan konuşmayı almaz", () => {
    const extraction = makeExtraction({
      saleOutcome: "won",
      scores: {
        salesQuality: 60,
        empathy: 70,
        speed: 60,
        persuasion: 55,
        closing: 65,
        gaps: "Kapanış zayıf",
      },
    });
    assert.equal(shouldMarkBestConversation(extraction), false);
  });
});

describe("getWeekStart", () => {
  it("Cumartesi için aynı haftanın Pazartesi'sini döner", () => {
    assert.equal(getWeekStart("2026-07-18"), "2026-07-13");
  });

  it("Pazartesi kendisini döner", () => {
    assert.equal(getWeekStart("2026-07-13"), "2026-07-13");
  });

  it("Pazar için önceki Pazartesi'yi döner", () => {
    assert.equal(getWeekStart("2026-07-19"), "2026-07-13");
  });
});
