/**
 * Conversation Strategist — cevap yazmaz; LLM öncesi tek hamle kararını verir.
 * Pipeline: Memory → Sales Brain → Strategist → LLM → Critic → Rewrite → Send
 */

import type { SalesBrainSnapshot } from "@/features/ai/services/sales-brain.service";

export const CONVERSATION_MOVES = [
  "build_trust",
  "empathy_only",
  "ask_one_question",
  "no_question",
  "withhold_price",
  "give_price",
  "show_example",
  "resolve_objection",
  "soft_close",
  "ask_deposit",
  "wait",
] as const;

export type ConversationMove = (typeof CONVERSATION_MOVES)[number];

export type ConversationStrategy = {
  move: ConversationMove;
  /** Türkçe tek cümle emir — LLM buna uyar. */
  directive: string;
  allowPrice: boolean;
  allowQuestion: boolean;
  maxLines: number;
  rationale: string;
};

const MOVE_DIRECTIVES: Record<ConversationMove, Omit<ConversationStrategy, "move" | "rationale">> = {
  build_trust: {
    directive: "Şu an fiyat verme. Güven oluştur; kısa ve samimi ol.",
    allowPrice: false,
    allowQuestion: true,
    maxLines: 3,
  },
  empathy_only: {
    directive: "Şu an sadece empati kur. Fiyat/paket önerme, soru sorma.",
    allowPrice: false,
    allowQuestion: false,
    maxLines: 2,
  },
  ask_one_question: {
    directive: "Şu an tek net soru sor. Bilgi dump yapma.",
    allowPrice: false,
    allowQuestion: true,
    maxLines: 3,
  },
  no_question: {
    directive: "Şu an soru sorma. Kısa net cevap ver, kapanışı yumuşak bırak.",
    allowPrice: false,
    allowQuestion: false,
    maxLines: 3,
  },
  withhold_price: {
    directive: "Şu an fiyat verme. Önce ihtiyaç/tarih netleştir veya değer kur.",
    allowPrice: false,
    allowQuestion: true,
    maxLines: 3,
  },
  give_price: {
    directive: "Şu an fiyat ver (katalog rakamları). Kısa tut, tek paket odağı.",
    allowPrice: true,
    allowQuestion: true,
    maxLines: 4,
  },
  show_example: {
    directive: "Şu an örnek/referans göster. Fiyat listesi yapıştırma.",
    allowPrice: false,
    allowQuestion: true,
    maxLines: 3,
  },
  resolve_objection: {
    directive: "Şu an itirazı çöz. Savunmacı olma; kısa, güven ver.",
    allowPrice: false,
    allowQuestion: true,
    maxLines: 3,
  },
  soft_close: {
    directive: "Şu an yumuşak kapanış yap. Baskı yok; net sonraki adım.",
    allowPrice: false,
    allowQuestion: true,
    maxLines: 3,
  },
  ask_deposit: {
    directive: "Şu an kapora/tarih kilidine yönlendir. Kısa ve net.",
    allowPrice: true,
    allowQuestion: true,
    maxLines: 3,
  },
  wait: {
    directive: "Şu an baskı yapma. Kısa onayla; alan bırak (wait).",
    allowPrice: false,
    allowQuestion: false,
    maxLines: 2,
  },
};

function asksPrice(message: string): boolean {
  const n = message.toLocaleLowerCase("tr-TR");
  return /fiyat|kaç\s*para|ne\s*kadar|ücret|kaç\s*tl|fiyati|fiyatı/.test(n);
}

function looksUpset(message: string): boolean {
  const n = message.toLocaleLowerCase("tr-TR");
  return /sinir|kızdım|kötü|berbat|saçma|yeter|bıktım|rahatsız/.test(n);
}

function asksExample(message: string): boolean {
  const n = message.toLocaleLowerCase("tr-TR");
  return /örnek|referans|video\s*var\s*mı|işleriniz|portföy|instagram/.test(n);
}

/**
 * Sales Brain + müşteri mesajından tek stratejik hamle.
 * Deterministik — ekstra LLM yok (gecikme/kural yığını üretmez).
 */
export function decideConversationStrategy(params: {
  brain: SalesBrainSnapshot;
  customerMessage: string;
}): ConversationStrategy {
  const { brain, customerMessage } = params;
  const msg = customerMessage.trim();
  const priceAsk = asksPrice(msg);
  const upset = looksUpset(msg);
  const exampleAsk = asksExample(msg);

  let move: ConversationMove = "ask_one_question";
  let rationale = "Varsayılan: tek soru ile ilerleme.";

  if (upset) {
    move = "empathy_only";
    rationale = "Müşteri gerilimli — önce empati.";
  } else if (brain.nextBestAction === "wait" || brain.objective === "wait_follow_up") {
    move = "wait";
    rationale = "Sales Brain wait / follow-up aşamasında.";
  } else if (brain.nextBestAction === "ask_deposit" || brain.objective === "approach_deposit") {
    move = "ask_deposit";
    rationale = "Kapora/yakın kapanış hedefi.";
  } else if (brain.nextBestAction === "give_price" || brain.objective === "give_price") {
    move = "give_price";
    rationale = "NBA/objective fiyat vermeyi istiyor.";
  } else if (
    priceAsk &&
    (brain.scores.trust < 45 || brain.objective === "build_trust")
  ) {
    move = "withhold_price";
    rationale = "Fiyat soruldu ama güven düşük — önce güven.";
  } else if (priceAsk && brain.scores.priceSensitivity >= 70 && brain.turn < 3) {
    move = "withhold_price";
    rationale = "Erken fiyat avcısı — kısa değer, tam dump yok.";
  } else if (priceAsk) {
    move = "give_price";
    rationale = "Doğrudan fiyat sorusu — katalog ile cevap.";
  } else if (exampleAsk || brain.nextBestAction === "show_reference") {
    move = "show_example";
    rationale = "Örnek/referans talebi veya NBA.";
  } else if (brain.objective === "resolve_objection") {
    move = "resolve_objection";
    rationale = "İtiraz çözme hedefi.";
  } else if (brain.objective === "build_trust" || brain.scores.trust < 40) {
    move = "build_trust";
    rationale = "Güven düşük / build_trust objective.";
  } else if (
    brain.objective === "soft_close" ||
    (brain.scores.purchaseIntent >= 75 &&
      brain.nextBestAction !== "ask_question")
  ) {
    move = "soft_close";
    rationale = "Yüksek niyet / soft_close — yumuşak kapanış.";
  } else if (brain.nextBestAction === "ask_question") {
    move = "ask_one_question";
    rationale = "NBA: soru sor.";
  } else if (brain.customerType === "info_gatherer" && brain.turn >= 4) {
    move = "no_question";
    rationale = "Bilgi toplayıcı — soru yorgunluğu riski.";
  } else {
    move = "ask_one_question";
    rationale = `Objective=${brain.objective}, NBA=${brain.nextBestAction}.`;
  }

  // Tekrarlayan fiyat sorusunda withhold'u kır
  if (move === "withhold_price" && priceAsk && brain.turn >= 3) {
    move = "give_price";
    rationale = "Fiyat tekrar soruldu — net katalog fiyatı ver.";
  }

  const base = MOVE_DIRECTIVES[move];
  return {
    move,
    ...base,
    rationale,
  };
}

export function composeStrategistPromptBlock(
  strategy: ConversationStrategy
): string {
  return [
    "## CONVERSATION STRATEGIST (zorunlu hamle — cevap yazma, buna UY)",
    `Hamle: ${strategy.move}`,
    `Emir: ${strategy.directive}`,
    `Fiyat verilebilir: ${strategy.allowPrice ? "evet" : "HAYIR"}`,
    `Soru sorulabilir: ${strategy.allowQuestion ? "en fazla 1" : "HAYIR — soru yok"}`,
    `Maks satır: ~${strategy.maxLines}`,
    `Gerekçe: ${strategy.rationale}`,
    "Bu hamleye aykırı davranma. Kafana göre paket dump / erken kapanış yapma.",
  ].join("\n");
}

export function strategyToJson(
  strategy: ConversationStrategy
): Record<string, unknown> {
  return { ...strategy };
}
