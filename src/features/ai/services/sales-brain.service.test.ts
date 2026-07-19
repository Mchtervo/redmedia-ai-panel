import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeAndUpdateSalesBrain,
  chooseConversationObjective,
  chooseNextBestAction,
  createInitialSalesBrain,
  inferCustomerType,
  reflectReply,
  updateLeadScores,
  updateMemoryFromCustomerMessage,
  defaultLeadScores,
} from "./sales-brain.service";
import { detectConversationFacts } from "./venue-quote.service";

function brainAfterAlbumReject(msg: string) {
  return analyzeAndUpdateSalesBrain({
    customerMessage: msg,
    historyText: "Müşteri: merhaba\nAsistan: Tabii, nasıl bir çekim?",
    previous: createInitialSalesBrain("test", 1),
    sessionKey: "test",
  });
}

describe("sales-brain", () => {
  it("greeting → need_discovery geçişi", () => {
    const brain = analyzeAndUpdateSalesBrain({
      customerMessage: "dış çekim bakıyoruz",
      historyText: "Müşteri: selam\nAsistan: Merhaba, nasıl yardımcı olayım?",
      previous: createInitialSalesBrain("t", 0),
      sessionKey: "t",
    });
    assert.ok(
      brain.state === "need_discovery" ||
        brain.state === "value" ||
        brain.state === "greeting"
    );
    assert.ok(brain.turn >= 1);
    assert.ok(brain.scores.trust >= 0);
    assert.ok(brain.objective);
    assert.ok(brain.nextBestAction);
  });

  it("albüm istemiyorum memory'ye işler", () => {
    const facts = detectConversationFacts("Albüm istemiyorum sadece foto ve klip");
    const mem = updateMemoryFromCustomerMessage(
      createInitialSalesBrain().memory,
      "Albüm istemiyorum sadece foto ve klip",
      facts
    );
    assert.equal(mem.album, false);
    assert.ok(mem.rejectedTopics.includes("album"));
  });

  it("albüm reddinden sonra albüm önerisi reflection fail", () => {
    const brain = brainAfterAlbumReject("Albüm istemiyorum");
    assert.equal(brain.memory.album, false);
    const check = reflectReply(
      "Anlıyorum. Albüm düşünür müsünüz yoksa foto+klip mi?",
      brain,
      "Albüm istemiyorum"
    );
    assert.equal(check.pass, false);
    assert.ok(check.issues.some((i) => /albüm|album/i.test(i)));
  });

  it("yasak kapanış scriptini yakalar", () => {
    const brain = createInitialSalesBrain();
    const check = reflectReply(
      "Rica ederim. Eşinizle bugün mü konuşursunuz hafta sonu mu?",
      brain,
      "tamam teşekkürler"
    );
    assert.equal(check.pass, false);
  });

  it("cognitive load yakalar", () => {
    const brain = createInitialSalesBrain();
    const check = reflectReply(
      "22 retouch, albüm, foto 3 gün, klip 7 gün, drone ve yedek ekipman var.",
      brain,
      "detay?"
    );
    assert.equal(check.pass, false);
  });

  it("fiyat itirazı objection state", () => {
    const brain = analyzeAndUpdateSalesBrain({
      customerMessage: "15.000 olur mu?",
      historyText:
        "Müşteri: fiyat\nAsistan: Premium Albümlü 14.000, kapora dahil.",
      previous: {
        ...createInitialSalesBrain("x", 2),
        state: "price",
      },
      sessionKey: "x",
    });
    assert.equal(brain.state, "objection");
    assert.equal(brain.mainBlocker, "price");
    assert.ok(brain.scores.priceSensitivity >= 50);
    assert.equal(brain.objective, "resolve_objection");
  });

  it("lead skorları fiyat hassasiyetini yükseltir", () => {
    const scores = updateLeadScores(
      defaultLeadScores(),
      "Pahalı geldi, 10.000 olur mu?",
      "objection",
      "price",
      createInitialSalesBrain().memory
    );
    assert.ok(scores.priceSensitivity > 40);
  });

  it("eşiyle konuşacak tipini yakalar", () => {
    const { type } = inferCustomerType(
      "Eşimle konuşup döneceğiz",
      { ...createInitialSalesBrain().memory, decisionMaker: "eşi" },
      "undecided",
      defaultLeadScores()
    );
    assert.equal(type, "spouse_decider");
  });

  it("rakip kıyas tipini yakalar", () => {
    const { type } = inferCustomerType(
      "Başka firmayla kıyaslıyoruz daha ucuz diyorlar",
      createInitialSalesBrain().memory,
      "undecided",
      defaultLeadScores()
    );
    assert.equal(type, "competitor_comparer");
  });

  it("5+ turda müşteri tipini kilitler", () => {
    let brain = createInitialSalesBrain("lock", 0);
    const msgs = [
      "Merhaba fiyat nedir?",
      "Bütçemiz sıkı biraz pahalı",
      "10.000 olur mu?",
      "Başka yer daha ucuz",
      "İndirim var mı?",
      "Hâlâ düşünüyoruz",
    ];
    for (const msg of msgs) {
      brain = analyzeAndUpdateSalesBrain({
        customerMessage: msg,
        historyText: "Müşteri: x\nAsistan: y",
        previous: brain,
        sessionKey: "lock",
      });
    }
    assert.equal(brain.customerTypeLocked, true);
    assert.ok(
      brain.customerType === "price_focused" ||
        brain.customerType === "competitor_comparer"
    );
  });

  it("objective + NBA tutarlı seçilir", () => {
    const objective = chooseConversationObjective({
      state: "trust",
      customerType: "competitor_comparer",
      scores: {
        trust: 30,
        purchaseIntent: 40,
        priceSensitivity: 40,
        urgency: 30,
      },
      memory: createInitialSalesBrain().memory,
      mainBlocker: "trust",
      customerMessage: "referans var mı?",
    });
    assert.equal(objective, "build_trust");
    const nba = chooseNextBestAction({
      objective,
      scores: {
        trust: 30,
        purchaseIntent: 40,
        priceSensitivity: 40,
        urgency: 30,
      },
      customerType: "competitor_comparer",
      state: "trust",
      memory: createInitialSalesBrain().memory,
    });
    assert.equal(nba, "show_reference");
  });

  it("NBA fiyat değilken rakam reflection fail", () => {
    const brain = {
      ...createInitialSalesBrain(),
      state: "need_discovery" as const,
      objective: "discover_need" as const,
      nextBestAction: "ask_question" as const,
    };
    const check = reflectReply(
      "Basic Cinema 11.000 TL oluyor.",
      brain,
      "dış çekim bakıyoruz"
    );
    assert.equal(check.pass, false);
  });
});
