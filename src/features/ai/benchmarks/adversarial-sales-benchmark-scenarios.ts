import type {
  AdversarialCustomerVariant,
  AdversarialScenarioSeed,
} from "./adversarial-sales-benchmark.types";

const SEEDS: AdversarialScenarioSeed[] = [
  {
    id: "adv-price-whiplash",
    name: "Fiyat → düğün hikâyesi → kaybol → geri gel",
    category: "price_chaos",
    maxTurns: 8,
    openingHint: "selam fiyat nedir",
    customerBrief:
      "Önce fiyat sor, sonra düğününü anlat, bir tur cevap verme gibi kaybol, sonra geri gelip aynı fiyatı tekrar sor. Yazım hatası yap.",
  },
  {
    id: "adv-mind-change",
    name: "Fikir değiştiren karşılaştırıcı",
    category: "competitor",
    maxTurns: 8,
    openingHint: "baskası 9 bine yapiyomus siz kac",
    customerBrief:
      "Rakip fiyatı söyle, sonra kaliteye kay, sonra yine fiyata dön. Çelişkili konuş. Bazen emoji spam.",
  },
  {
    id: "adv-angry-misread",
    name: "Sinirli yanlış anlayan",
    category: "emotion",
    maxTurns: 7,
    openingHint: "album istemiyorum sadece video",
    customerBrief:
      "Albüm istemediğini söyle. Asistan albüm derse sinirlen. Aynı soruyu tekrar sor. Bazen alakasız 'hava çok sıcak ya' yaz.",
  },
  {
    id: "adv-spouse-loop",
    name: "Eşine soracağım döngüsü",
    category: "spouse",
    maxTurns: 7,
    openingHint: "bi bakayim esime sorcam",
    customerBrief:
      "Sürekli eşe danışacağını söyle, sonra yine fiyat sor, sonra yine 'eşime sorcam'. Kararsız ve dağınık ol.",
  },
  {
    id: "adv-info-hoarder",
    name: "Her şeyi birden soran",
    category: "info",
    maxTurns: 7,
    openingHint: "plato drone album paket hepsi kac",
    customerBrief:
      "Bir mesajda çok şey sor, sonra sadece birine cevap verip diğerlerini tekrar sor. Yazım hatalı ve kısa mesajlar.",
  },
  {
    id: "adv-ghost-return",
    name: "Kaybolup kapora soran",
    category: "close",
    maxTurns: 8,
    openingHint: "merhaba uygun musunuz eylul icin",
    customerBrief:
      "Tarih sor, sonra 1 tur 'ok' de, sonra uzun sessizlik hissi verip 'kapora ne kadar' diye dön. Bazen yanlış anla.",
  },
];

const CUSTOMER_PERSONAS: Omit<AdversarialCustomerVariant, "variantIndex">[] = [
  {
    seedLabel: "aceleci-yazim-hatali",
    personaPrompt:
      "Acelecisın, kısa yazıyorsun, yazım hatası bol (kac, nedir, yapiyonuz). Emoji bazen fazla.",
  },
  {
    seedLabel: "kararsiz-yumusak",
    personaPrompt:
      "Nazik ama kararsızsın. Fikir değiştiriyorsun. 'bilmiyorum ya' diyorsun. Az emoji.",
  },
  {
    seedLabel: "supheli-sert",
    personaPrompt:
      "Şüphecisin, biraz sertsin. 'gercekten mi', 'abartmayın' dersin. Bazen sinirlenirsin.",
  },
  {
    seedLabel: "detayci-daginik",
    personaPrompt:
      "Detay sorarsın ama konudan konuya atlarsın. Aynı soruyu farklı kelimelerle tekrarlarısın.",
  },
  {
    seedLabel: "emoji-kaotik",
    personaPrompt:
      "Gereksiz emoji kullanırsın 😅🙏🔥. Çelişkili konuşursun. Bir anda konu değiştirirsin.",
  },
];

export function listAdversarialScenarioSeeds(ids?: string[]): AdversarialScenarioSeed[] {
  if (!ids?.length) return [...SEEDS];
  const set = new Set(ids);
  return SEEDS.filter((s) => set.has(s.id));
}

export function buildCustomerVariants(
  count: number
): AdversarialCustomerVariant[] {
  const n = Math.max(1, Math.min(5, Math.floor(count)));
  return CUSTOMER_PERSONAS.slice(0, n).map((p, i) => ({
    variantIndex: i,
    seedLabel: p.seedLabel,
    personaPrompt: p.personaPrompt,
  }));
}
