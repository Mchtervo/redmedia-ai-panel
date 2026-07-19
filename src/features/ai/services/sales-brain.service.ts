/**
 * Satış Beyni — state machine + memory + persona/emotion + reflection.
 * Soft “500 kural” yerine: analiz → tek hedef → kısa cevap → reflect → gerekirse rewrite.
 */

import { z } from "zod";
import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";
import {
  detectConversationFacts,
  type ConversationFacts,
} from "@/features/ai/services/venue-quote.service";
import type { CrmMemorySnapshot } from "@/features/customer-intelligence/types";

export const SALES_FUNNEL_STATES = [
  "greeting",
  "need_discovery",
  "trust",
  "value",
  "price",
  "objection",
  "closing",
  "deposit",
  "follow_up",
] as const;

export type SalesFunnelState = (typeof SALES_FUNNEL_STATES)[number];

export const SALES_PERSONAS = [
  "price",
  "quality",
  "trust",
  "undecided",
  "ready",
  "romantic",
  "logical",
] as const;
export type SalesPersona = (typeof SALES_PERSONAS)[number];

export const SALES_EMOTIONS = [
  "calm",
  "anxious",
  "excited",
  "skeptical",
  "hurried",
  "warm",
] as const;
export type SalesEmotion = (typeof SALES_EMOTIONS)[number];

export const REPLY_STYLES = ["empathy", "logical", "story"] as const;
export type ReplyStyle = (typeof REPLY_STYLES)[number];

export const MAIN_BLOCKERS = [
  "trust",
  "price",
  "indecision",
  "info",
  "timing",
  "none",
] as const;
export type MainBlocker = (typeof MAIN_BLOCKERS)[number];

/** Canlı lead skorları (0–100) — AI buna göre konuşur. */
export type LeadScores = {
  trust: number;
  purchaseIntent: number;
  priceSensitivity: number;
  urgency: number;
};

/** İlk 5–6 mesajda kilitlenen müşteri tipi. */
export const CUSTOMER_TYPES = [
  "price_focused",
  "quality_focused",
  "undecided",
  "info_gatherer",
  "spouse_decider",
  "competitor_comparer",
] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

/** Bu mesajın tek amacı. */
export const CONVERSATION_OBJECTIVES = [
  "build_trust",
  "learn_date",
  "discover_need",
  "deliver_value",
  "give_price",
  "resolve_objection",
  "approach_deposit",
  "suggest_call",
  "soft_close",
  "wait_follow_up",
] as const;
export type ConversationObjective = (typeof CONVERSATION_OBJECTIVES)[number];

/** Cevap sonrası sonraki en iyi aksiyon. */
export const NEXT_BEST_ACTIONS = [
  "continue",
  "ask_question",
  "give_price",
  "show_reference",
  "ask_deposit",
  "wait",
] as const;
export type NextBestAction = (typeof NEXT_BEST_ACTIONS)[number];

export type SalesMemory = {
  album: boolean | null;
  clip: boolean | null;
  photo: boolean | null;
  budgetTry: number | null;
  dateHint: string | null;
  decisionMaker: string | null;
  venueHint: string | null;
  packageLean: "basic" | "premium_album" | "elite" | null;
  rejectedTopics: string[];
  usedClosings: string[];
};

export type SalesBrainSnapshot = {
  state: SalesFunnelState;
  persona: SalesPersona;
  emotion: SalesEmotion;
  /** @deprecated scores.purchaseIntent ile senkron */
  decisionPct: number;
  /** @deprecated scores.trust ile senkron */
  trust: number;
  /** @deprecated scores.purchaseIntent ile yakın */
  interest: number;
  scores: LeadScores;
  customerType: CustomerType;
  /** Tip güveni 0–100; 5–6 mesajda kilitlenir */
  customerTypeConfidence: number;
  customerTypeLocked: boolean;
  objective: ConversationObjective;
  nextBestAction: NextBestAction;
  mainBlocker: MainBlocker;
  singleGoal: string;
  memory: SalesMemory;
  style: ReplyStyle;
  turn: number;
};

export type SalesBrainReflectResult = {
  pass: boolean;
  issues: string[];
  rewritten: boolean;
};

export type AnalyzeSalesBrainInput = {
  customerMessage: string;
  historyText: string;
  previous: SalesBrainSnapshot | null;
  crmProfile?: CrmMemorySnapshot | null;
  sessionKey?: string;
};

const memorySchema = z.object({
  album: z.boolean().nullable(),
  clip: z.boolean().nullable(),
  photo: z.boolean().nullable(),
  budgetTry: z.number().nullable(),
  dateHint: z.string().nullable(),
  decisionMaker: z.string().nullable(),
  venueHint: z.string().nullable(),
  packageLean: z
    .enum(["basic", "premium_album", "elite"])
    .nullable(),
  rejectedTopics: z.array(z.string()),
  usedClosings: z.array(z.string()),
});

const leadScoresSchema = z.object({
  trust: z.number().min(0).max(100),
  purchaseIntent: z.number().min(0).max(100),
  priceSensitivity: z.number().min(0).max(100),
  urgency: z.number().min(0).max(100),
});

const snapshotSchema = z
  .object({
    state: z.enum(SALES_FUNNEL_STATES),
    persona: z.enum(SALES_PERSONAS),
    emotion: z.enum(SALES_EMOTIONS),
    decisionPct: z.number().min(0).max(100),
    trust: z.number().min(0).max(100),
    interest: z.number().min(0).max(100),
    scores: leadScoresSchema.optional(),
    customerType: z.enum(CUSTOMER_TYPES).optional(),
    customerTypeConfidence: z.number().min(0).max(100).optional(),
    customerTypeLocked: z.boolean().optional(),
    objective: z.enum(CONVERSATION_OBJECTIVES).optional(),
    nextBestAction: z.enum(NEXT_BEST_ACTIONS).optional(),
    mainBlocker: z.enum(MAIN_BLOCKERS),
    singleGoal: z.string(),
    memory: memorySchema,
    style: z.enum(REPLY_STYLES),
    turn: z.number().int().min(0),
  })
  .passthrough();

export function emptySalesMemory(): SalesMemory {
  return {
    album: null,
    clip: null,
    photo: null,
    budgetTry: null,
    dateHint: null,
    decisionMaker: null,
    venueHint: null,
    packageLean: null,
    rejectedTopics: [],
    usedClosings: [],
  };
}

export function defaultLeadScores(): LeadScores {
  return {
    trust: 40,
    purchaseIntent: 20,
    priceSensitivity: 40,
    urgency: 25,
  };
}

function normalizeSnapshot(
  partial: z.infer<typeof snapshotSchema> | SalesBrainSnapshot
): SalesBrainSnapshot {
  const scores: LeadScores =
    "scores" in partial && partial.scores
      ? partial.scores
      : {
          trust: partial.trust,
          purchaseIntent: partial.decisionPct,
          priceSensitivity: 40,
          urgency: 25,
        };
  return {
    state: partial.state,
    persona: partial.persona,
    emotion: partial.emotion,
    decisionPct: scores.purchaseIntent,
    trust: scores.trust,
    interest: Math.max(partial.interest, scores.purchaseIntent),
    scores,
    customerType:
      "customerType" in partial && partial.customerType
        ? partial.customerType
        : "undecided",
    customerTypeConfidence:
      "customerTypeConfidence" in partial &&
      partial.customerTypeConfidence != null
        ? partial.customerTypeConfidence
        : 20,
    customerTypeLocked:
      "customerTypeLocked" in partial && partial.customerTypeLocked != null
        ? partial.customerTypeLocked
        : false,
    objective:
      "objective" in partial && partial.objective
        ? partial.objective
        : "discover_need",
    nextBestAction:
      "nextBestAction" in partial && partial.nextBestAction
        ? partial.nextBestAction
        : "ask_question",
    mainBlocker: partial.mainBlocker,
    singleGoal: partial.singleGoal,
    memory: partial.memory,
    style: partial.style,
    turn: partial.turn,
  };
}

export function createInitialSalesBrain(
  sessionKey = "lab",
  turn = 0
): SalesBrainSnapshot {
  const scores = defaultLeadScores();
  return {
    state: "greeting",
    persona: "undecided",
    emotion: "calm",
    decisionPct: scores.purchaseIntent,
    trust: scores.trust,
    interest: 45,
    scores,
    customerType: "undecided",
    customerTypeConfidence: 15,
    customerTypeLocked: false,
    objective: "discover_need",
    nextBestAction: "ask_question",
    mainBlocker: "info",
    singleGoal: "Samimi karşılama + tek keşif sorusu",
    memory: emptySalesMemory(),
    style: pickReplyStyle(sessionKey, turn),
    turn,
  };
}

export function parseSalesBrainSnapshot(
  raw: unknown
): SalesBrainSnapshot | null {
  const parsed = snapshotSchema.safeParse(raw);
  return parsed.success ? normalizeSnapshot(parsed.data) : null;
}

export function salesBrainToJson(
  snapshot: SalesBrainSnapshot
): Record<string, unknown> {
  return { ...snapshot };
}

export function pickReplyStyle(sessionKey: string, turn: number): ReplyStyle {
  let h = 0;
  const key = `${sessionKey}:${turn}`;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return REPLY_STYLES[h % REPLY_STYLES.length]!;
}

/** CRM’den bilinen tercihleri memory’ye bas. */
export function seedMemoryFromCrm(
  memory: SalesMemory,
  crm: CrmMemorySnapshot | null | undefined
): SalesMemory {
  if (!crm) return memory;
  const next = { ...memory, rejectedTopics: [...memory.rejectedTopics] };

  const rejected = crm.rejectedServices.map((s) =>
    s.toLocaleLowerCase("tr-TR")
  );
  if (rejected.some((s) => /albüm|album/.test(s))) {
    next.album = false;
    if (!next.rejectedTopics.includes("album")) {
      next.rejectedTopics.push("album");
    }
  }
  const requested = crm.requestedServices.map((s) =>
    s.toLocaleLowerCase("tr-TR")
  );
  if (requested.some((s) => /albüm|album/.test(s))) next.album = true;
  if (requested.some((s) => /klip|video|sinematik/.test(s))) next.clip = true;
  if (requested.some((s) => /foto/.test(s))) next.photo = true;

  const budgetRaw = crm.budgetRange ?? crm.budget;
  if (budgetRaw) {
    const n = Number(String(budgetRaw).replace(/[^\d]/g, ""));
    if (Number.isFinite(n) && n > 0) next.budgetTry = n;
  }
  if (crm.eventDate) next.dateHint = crm.eventDate;
  if (crm.venue) next.venueHint = crm.venue;

  if (crm.preferredPackages.some((p) => /elite/i.test(p))) {
    next.packageLean = "elite";
  } else if (crm.preferredPackages.some((p) => /premium|albüm|album/i.test(p))) {
    next.packageLean = "premium_album";
  } else if (crm.preferredPackages.some((p) => /basic/i.test(p))) {
    next.packageLean = "basic";
  }

  if (crm.priceSensitivity === "high" || /pahalı|bütçe/i.test(crm.objections ?? "")) {
    // persona seed handled elsewhere
  }

  return next;
}

function extractBudgetTry(text: string): number | null {
  const m = text.match(/(\d{1,3}(?:\.\d{3})+|\d{4,6})\s*(?:tl|₺)?/i);
  if (!m) return null;
  const n = Number(m[1]!.replace(/\./g, ""));
  return Number.isFinite(n) && n >= 5000 && n <= 100000 ? n : null;
}

function extractDateHint(text: string): string | null {
  const t = text.trim();
  const relative = t.match(
    /^(yarın|yarin|bugün|bugun|öbür\s*gün|obur\s*gun|haftaya|gelecek\s*hafta)([\s!.?,]*)?$/i
  );
  if (relative?.[1]) return relative[1].trim();
  const m = t.match(
    /(\d{1,2}\s*(?:ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)(?:\s*\d{4})?|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)/i
  );
  return m?.[1]?.trim() ?? null;
}

/** Müşteri mesajından memory güncelle (deterministik). */
export function updateMemoryFromCustomerMessage(
  memory: SalesMemory,
  customerMessage: string,
  facts: ConversationFacts
): SalesMemory {
  const t = customerMessage.toLocaleLowerCase("tr-TR");
  const next: SalesMemory = {
    ...memory,
    rejectedTopics: [...memory.rejectedTopics],
    usedClosings: [...memory.usedClosings],
  };

  if (
    facts.refusedAlbum ||
    /albüm\s*istem|album\s*istem|albümsüz|albumsuz|albüm\s*şart\s*değil|album\s*sart\s*degil|albüm\s*gerek\s*yok/.test(
      t
    )
  ) {
    next.album = false;
    if (!next.rejectedTopics.includes("album")) {
      next.rejectedTopics.push("album");
    }
  } else if (facts.prefersPremiumAlbum || facts.prefersElite) {
    next.album = true;
  } else if (/albüm|album/.test(t) && !/istemiyorum|istemem|gerek yok/.test(t)) {
    next.album = true;
  }

  if (/klip|video|sinematik/.test(t)) next.clip = true;
  if (/foto/.test(t)) next.photo = true;

  const budget = extractBudgetTry(customerMessage);
  if (budget != null) next.budgetTry = budget;

  const dateHint = extractDateHint(customerMessage);
  if (dateHint) next.dateHint = dateHint;

  if (/eşim|esim|nişanlım|nisanlim|ailem/.test(t)) {
    next.decisionMaker = /eşim|esim/.test(t) ? "eşi" : next.decisionMaker;
  }

  if (facts.partnerPlatoName) next.venueHint = facts.partnerPlatoName;
  else if (facts.venueKind === "outdoor_green") next.venueHint = "bahçe/yeşillik";
  else if (facts.venueKind === "home") next.venueHint = "ev";
  else if (facts.venueKind === "other_plato") next.venueHint = "plato";

  if (facts.prefersElite) next.packageLean = "elite";
  else if (facts.prefersPremiumAlbum) next.packageLean = "premium_album";
  else if (facts.prefersBasic || facts.refusedAlbum || facts.outdoorOnlyInquiry) {
    next.packageLean = "basic";
  }

  return next;
}

function inferPersona(
  customerMessage: string,
  previous: SalesPersona,
  memory: SalesMemory
): SalesPersona {
  const t = customerMessage.toLocaleLowerCase("tr-TR");
  if (/pahalı|pahali|bütçe|butce|indirim|olur\s*mu|10\.?000|15\.?000/.test(t)) {
    return "price";
  }
  if (/güven|guven|referans|kaç\s*yıl|kac\s*yil|instagram|örnek|ornek/.test(t)) {
    return "trust";
  }
  if (/kalite|premium|elite|en\s*iyi|profesyonel/.test(t)) return "quality";
  if (/acele|hemen|bugün\s*kilit|bugun\s*kilit|rezerve/.test(t)) return "ready";
  if (/romantik|duygu|anı|ani|yıllar\s*sonra|yillar\s*sonra/.test(t)) {
    return "romantic";
  }
  if (/kaç\s*dk|kac\s*dk|teslim|süreç|surec|sözleşme|sozlesme/.test(t)) {
    return "logical";
  }
  if (/bakarız|bakariz|düşün|kararsız|kararsiz|emin\s*değil/.test(t)) {
    return "undecided";
  }
  if (memory.budgetTry != null && memory.budgetTry < 14000) return "price";
  return previous;
}

function inferEmotion(
  customerMessage: string,
  previous: SalesEmotion
): SalesEmotion {
  const t = customerMessage.toLocaleLowerCase("tr-TR");
  if (/pahalı|kork|endiş|endis|risk|emin\s*değil/.test(t)) return "anxious";
  if (/harika|çok\s*güzel|cok\s*guzel|süper|super|heyecan|aşk|ask/.test(t)) {
    return "excited";
  }
  if (/iddia|inanm|şüphe|suphe|gerçekten|gercekten\s*mi/.test(t)) {
    return "skeptical";
  }
  if (/acele|hemen|bugün|bugun|acil/.test(t)) return "hurried";
  if (/teşekkür|tesekkur|sağol|sagol|rica/.test(t)) return "warm";
  return previous === "hurried" ? "calm" : previous;
}

function inferBlocker(
  customerMessage: string,
  memory: SalesMemory,
  persona: SalesPersona
): MainBlocker {
  const t = customerMessage.toLocaleLowerCase("tr-TR");
  if (/pahalı|indirim|bütçe|butce|olur\s*mu/.test(t) || persona === "price") {
    return "price";
  }
  if (/güven|referans|sahte|iddia|kaç\s*yıl/.test(t)) return "trust";
  if (/bakarız|düşün|kararsız|eşimle/.test(t)) return "indecision";
  if (/ne\s*kadar|fiyat|paket|tarif|neler\s*var/.test(t)) return "info";
  if (/tarih|müsait|musait|ekim|eylül/.test(t) || memory.dateHint) {
    return memory.dateHint ? "none" : "timing";
  }
  return "none";
}

export function transitionSalesState(
  previous: SalesFunnelState,
  customerMessage: string,
  memory: SalesMemory,
  facts: ConversationFacts,
  historyText: string
): SalesFunnelState {
  const t = customerMessage.toLocaleLowerCase("tr-TR");
  const hasAi = /(^|\n)\s*(asistan|ai)\s*:/i.test(historyText);

  if (/kapora|iban|dekont|ödeme|odeme|havale/.test(t)) return "deposit";
  if (
    /pahalı|indirim|olur\s*mu|10\.?000|15\.?000|bütçe|butce|başka\s*yere/.test(t)
  ) {
    return "objection";
  }
  if (/bakarız|bakariz|teşekkür|tesekkur|sonra\s*yazar|düşünelim/.test(t)) {
    return previous === "price" || previous === "closing" || previous === "value"
      ? "follow_up"
      : "closing";
  }
  if (/tarih\s*kilit|rezerve|kapora\s*yat|kesinleştir|kesinlestir/.test(t)) {
    return "closing";
  }
  if (/ne\s*kadar|fiyat|kaç\s*tl|kac\s*tl|ücret|ucret/.test(t)) {
    return previous === "greeting" || previous === "need_discovery"
      ? "value"
      : "price";
  }
  if (/güven|referans|kaç\s*yıl|instagram|örnek\s*çekim/.test(t)) {
    return "trust";
  }
  if (
    facts.prefersElite ||
    facts.prefersPremiumAlbum ||
    facts.prefersBasic ||
    memory.packageLean
  ) {
    if (previous === "greeting" || previous === "need_discovery") {
      return "value";
    }
  }
  if (!hasAi) return "greeting";
  if (previous === "greeting") return "need_discovery";
  return previous;
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

const CUSTOMER_TYPE_HINT: Record<CustomerType, string> = {
  price_focused: "Fiyat odaklı: kısa, net, az duygu; erken paket dump yok.",
  quality_focused: "Kalite odaklı: değer/kapsam; tek madde, dump yok.",
  undecided: "Kararsız: sabır, tek seçenek, baskı yok.",
  info_gatherer: "Bilgi toplayan: sade cevap; kapora/sıkıştırma YASAK.",
  spouse_decider: "Eşiyle konuşacak: karar şart değil; paylaşılabilir özet.",
  competitor_comparer: "Kıyaslayan: farkı tek cümle; rakip kötüleme YASAK.",
};

const OBJECTIVE_LABEL: Record<ConversationObjective, string> = {
  build_trust: "Güven oluştur",
  learn_date: "Tarihi öğren",
  discover_need: "İhtiyaç keşfet",
  deliver_value: "Değer anlat",
  give_price: "Fiyat ver",
  resolve_objection: "İtirazı çöz",
  approach_deposit: "Kaporaya yaklaştır",
  suggest_call: "Telefon görüşmesine geçir",
  soft_close: "Yumuşak kapanış",
  wait_follow_up: "Bekle / takip planla",
};

const NBA_LABEL: Record<NextBestAction, string> = {
  continue: "Devam et",
  ask_question: "Soru sor",
  give_price: "Fiyat ver",
  show_reference: "Referans göster",
  ask_deposit: "Kapora iste",
  wait: "Bekle",
};

export function updateLeadScores(
  prev: LeadScores,
  customerMessage: string,
  state: SalesFunnelState,
  mainBlocker: MainBlocker,
  memory: SalesMemory
): LeadScores {
  const t = customerMessage.toLocaleLowerCase("tr-TR");
  let { trust, purchaseIntent, priceSensitivity, urgency } = prev;

  if (/ne\s*kadar|fiyat|paket|tarif/.test(t)) {
    purchaseIntent = clampPct(purchaseIntent + 6);
  }
  if (/pahalı|pahali|indirim|bütçe|butce|olur\s*mu|10\.?000|15\.?000/.test(t)) {
    priceSensitivity = clampPct(priceSensitivity + 12);
    purchaseIntent = clampPct(purchaseIntent - 3);
  }
  if (/güven|referans|kaç\s*yıl|instagram|örnek|iddia|şüphe/.test(t)) {
    trust = clampPct(trust - 4);
  }
  if (/harika|güzel|beğend|begend|tamam|olur|anladım/.test(t)) {
    trust = clampPct(trust + 8);
    purchaseIntent = clampPct(purchaseIntent + 8);
  }
  if (/bakarız|teşekkür|sonra\s*yazar|düşünelim/.test(t)) {
    purchaseIntent = clampPct(purchaseIntent - 8);
    urgency = clampPct(urgency - 5);
  }
  if (/acele|hemen|bugün|bugun|acil|yakında|yakinda|haftaya/.test(t)) {
    urgency = clampPct(urgency + 15);
  }
  if (/rezerve|kapora|tarih\s*kilit|kesin/.test(t)) {
    purchaseIntent = clampPct(purchaseIntent + 18);
    urgency = clampPct(urgency + 10);
  }
  if (state === "trust") trust = clampPct(trust + 6);
  if (state === "deposit" || state === "closing") {
    purchaseIntent = clampPct(Math.max(purchaseIntent, 65));
  }
  if (mainBlocker === "price") priceSensitivity = clampPct(priceSensitivity + 5);
  if (memory.dateHint) urgency = clampPct(urgency + 5);
  if (memory.budgetTry != null && memory.budgetTry < 14000) {
    priceSensitivity = clampPct(Math.max(priceSensitivity, 60));
  }

  return {
    trust: clampPct(trust),
    purchaseIntent: clampPct(purchaseIntent),
    priceSensitivity: clampPct(priceSensitivity),
    urgency: clampPct(urgency),
  };
}

/** Sinyal → müşteri tipi (kilitlenene kadar güncellenir). */
export function inferCustomerType(
  customerMessage: string,
  memory: SalesMemory,
  previous: CustomerType,
  scores: LeadScores
): { type: CustomerType; confidenceBoost: number } {
  const t = customerMessage.toLocaleLowerCase("tr-TR");
  if (
    /eşimle|esimle|eşime|esime|nişanlımla|nisanlimla|birlikte\s*konuş|karar\s*ver(e)?ceğiz/.test(
      t
    ) ||
    memory.decisionMaker === "eşi"
  ) {
    return { type: "spouse_decider", confidenceBoost: 35 };
  }
  if (
    /başka\s*(firma|yer)|rakip|kıyas|kiyas|daha\s*ucuz|diğer\s*stüdyo|diger\s*studyo|karşılaştır|karsilastir/.test(
      t
    )
  ) {
    return { type: "competitor_comparer", confidenceBoost: 35 };
  }
  if (
    /sadece\s*(fiyat|bilgi)|araştırıyorum|arastiriyorum|öğrenmek|ogrenmek|bakıyorum|bakiyorum/.test(
      t
    ) &&
    !/rezerve|kapora|tarih/.test(t)
  ) {
    return { type: "info_gatherer", confidenceBoost: 30 };
  }
  if (
    /pahalı|indirim|bütçe|butce|olur\s*mu|10\.?000|15\.?000/.test(t) ||
    scores.priceSensitivity >= 65
  ) {
    return { type: "price_focused", confidenceBoost: 30 };
  }
  if (/kalite|premium|elite|en\s*iyi|profesyonel|retouch|albüm/.test(t)) {
    return { type: "quality_focused", confidenceBoost: 28 };
  }
  if (/bakarız|kararsız|emin\s*değil|düşünelim/.test(t)) {
    return { type: "undecided", confidenceBoost: 25 };
  }
  return { type: previous, confidenceBoost: 5 };
}

export function chooseConversationObjective(params: {
  state: SalesFunnelState;
  customerType: CustomerType;
  scores: LeadScores;
  memory: SalesMemory;
  mainBlocker: MainBlocker;
  customerMessage: string;
}): ConversationObjective {
  const t = params.customerMessage.toLocaleLowerCase("tr-TR");
  if (params.state === "deposit" || /kapora|iban|dekont/.test(t)) {
    return "approach_deposit";
  }
  if (params.state === "objection" || params.mainBlocker === "price") {
    return "resolve_objection";
  }
  if (params.scores.trust < 45 || params.mainBlocker === "trust") {
    return "build_trust";
  }
  if (!params.memory.dateHint && /tarih|ne\s*zaman|müsait|musait/.test(t)) {
    return "learn_date";
  }
  if (
    !params.memory.dateHint &&
    params.scores.purchaseIntent >= 50 &&
    params.state !== "greeting"
  ) {
    return "learn_date";
  }
  if (
    params.state === "price" ||
    (/ne\s*kadar|fiyat|kaç\s*tl/.test(t) && params.scores.trust >= 45)
  ) {
    return "give_price";
  }
  if (params.state === "follow_up" || /bakarız|teşekkür|sonra/.test(t)) {
    return params.customerType === "spouse_decider"
      ? "wait_follow_up"
      : "soft_close";
  }
  if (
    params.scores.purchaseIntent >= 70 &&
    params.scores.urgency >= 55 &&
    params.customerType !== "info_gatherer"
  ) {
    return "approach_deposit";
  }
  if (
    params.customerType === "competitor_comparer" &&
    params.scores.trust < 60
  ) {
    return "build_trust";
  }
  if (params.state === "value" || params.state === "trust") {
    return params.state === "trust" ? "build_trust" : "deliver_value";
  }
  if (params.state === "greeting" || params.state === "need_discovery") {
    return "discover_need";
  }
  if (
    params.scores.purchaseIntent >= 60 &&
    params.customerType === "spouse_decider"
  ) {
    return "suggest_call";
  }
  return "deliver_value";
}

export function chooseNextBestAction(params: {
  objective: ConversationObjective;
  scores: LeadScores;
  customerType: CustomerType;
  state: SalesFunnelState;
  memory: SalesMemory;
}): NextBestAction {
  const { objective, scores, customerType, state, memory } = params;

  if (customerType === "info_gatherer" && scores.purchaseIntent < 40) {
    return objective === "give_price" ? "give_price" : "ask_question";
  }
  if (objective === "wait_follow_up" || customerType === "spouse_decider") {
    if (scores.purchaseIntent < 55) return "wait";
  }
  if (objective === "approach_deposit" || state === "deposit") {
    return "ask_deposit";
  }
  if (objective === "give_price" || state === "price") {
    return "give_price";
  }
  if (objective === "build_trust" || scores.trust < 45) {
    return "show_reference";
  }
  if (objective === "resolve_objection") {
    return scores.priceSensitivity >= 70 ? "ask_question" : "continue";
  }
  if (objective === "learn_date" && !memory.dateHint) {
    return "ask_question";
  }
  if (objective === "discover_need" || objective === "soft_close") {
    return "ask_question";
  }
  if (objective === "suggest_call") return "ask_question";
  return "continue";
}

function goalFromObjective(
  objective: ConversationObjective,
  customerType: CustomerType,
  nba: NextBestAction
): string {
  return `${OBJECTIVE_LABEL[objective]} · NBA: ${NBA_LABEL[nba]} · Tip: ${CUSTOMER_TYPE_HINT[customerType].split(":")[0]}`;
}

function personaFromCustomerType(type: CustomerType): SalesPersona {
  switch (type) {
    case "price_focused":
      return "price";
    case "quality_focused":
      return "quality";
    case "info_gatherer":
      return "logical";
    case "spouse_decider":
      return "undecided";
    case "competitor_comparer":
      return "trust";
    default:
      return "undecided";
  }
}

/**
 * Deterministik analiz + skor + tip + objective + NBA.
 */
export function analyzeAndUpdateSalesBrain(
  input: AnalyzeSalesBrainInput
): SalesBrainSnapshot {
  const sessionKey = input.sessionKey ?? "session";
  const prevRaw =
    input.previous ?? createInitialSalesBrain(sessionKey, 0);
  const prev = normalizeSnapshot(prevRaw);

  const customerOnly = [
    ...input.historyText
      .split("\n")
      .filter((l) => /^(müşteri|customer)\s*:/i.test(l))
      .map((l) => l.replace(/^(müşteri|customer)\s*:/i, "").trim()),
    input.customerMessage,
  ].join("\n");

  const facts = detectConversationFacts(customerOnly);
  let memory = seedMemoryFromCrm(
    { ...prev.memory, rejectedTopics: [...prev.memory.rejectedTopics] },
    input.crmProfile
  );
  memory = updateMemoryFromCustomerMessage(
    memory,
    input.customerMessage,
    facts
  );

  const emotion = inferEmotion(input.customerMessage, prev.emotion);
  const state = transitionSalesState(
    prev.state,
    input.customerMessage,
    memory,
    facts,
    input.historyText
  );

  const turn = prev.turn + 1;
  const style = pickReplyStyle(sessionKey, turn);

  let scores = updateLeadScores(
    prev.scores,
    input.customerMessage,
    state,
    prev.mainBlocker,
    memory
  );

  let customerType = prev.customerType;
  let customerTypeConfidence = prev.customerTypeConfidence;
  let customerTypeLocked = prev.customerTypeLocked;

  if (!customerTypeLocked) {
    const inferred = inferCustomerType(
      input.customerMessage,
      memory,
      customerType,
      scores
    );
    if (inferred.type !== customerType) {
      customerType = inferred.type;
      customerTypeConfidence = clampPct(inferred.confidenceBoost);
    } else {
      customerTypeConfidence = clampPct(
        customerTypeConfidence + inferred.confidenceBoost
      );
    }
    if (turn >= 5 && customerTypeConfidence >= 55) {
      customerTypeLocked = true;
    }
    if (turn >= 6) {
      customerTypeLocked = true;
    }
  }

  const persona =
    customerTypeLocked || customerTypeConfidence >= 40
      ? personaFromCustomerType(customerType)
      : inferPersona(input.customerMessage, prev.persona, memory);

  const mainBlocker = inferBlocker(
    input.customerMessage,
    memory,
    persona
  );

  scores = updateLeadScores(
    scores,
    input.customerMessage,
    state,
    mainBlocker,
    memory
  );

  const objective = chooseConversationObjective({
    state,
    customerType,
    scores,
    memory,
    mainBlocker,
    customerMessage: input.customerMessage,
  });

  const nextBestAction = chooseNextBestAction({
    objective,
    scores,
    customerType,
    state,
    memory,
  });

  // info_gatherer / düşük niyet → erken fiyat baskısını düşür
  let effectiveState = state;
  if (
    customerType === "info_gatherer" &&
    scores.purchaseIntent < 35 &&
    (state === "price" || state === "closing")
  ) {
    effectiveState = "value";
  }

  return {
    state: effectiveState,
    persona,
    emotion,
    decisionPct: scores.purchaseIntent,
    trust: scores.trust,
    interest: clampPct((scores.purchaseIntent + scores.urgency) / 2),
    scores,
    customerType,
    customerTypeConfidence,
    customerTypeLocked,
    objective,
    nextBestAction,
    mainBlocker,
    singleGoal: goalFromObjective(objective, customerType, nextBestAction),
    memory,
    style,
    turn,
  };
}

const STYLE_HINT: Record<ReplyStyle, string> = {
  empathy: "Empati ağırlıklı; kısa duygu cümlesi, öğretme.",
  logical: "Net ve sade; kanıt/süreç tek madde, az duygu.",
  story: "Hafif hikâye/anı çerçevesi; tek cümle, roman değil.",
};

const PERSONA_HINT: Record<SalesPersona, string> = {
  price: "Fiyatçı: kısa, net, az duygu.",
  quality: "Kalite: kapsam/değer; dump yok.",
  trust: "Güven: tek kanıt maddesi.",
  undecided: "Kararsız: sabır + tek seçenek.",
  ready: "Hazır: özet + soft CTA.",
  romantic: "Romantik: duygu; tek cümle.",
  logical: "Mantıkçı: süreç/kanıt.",
};

const EMOTION_HINT: Record<SalesEmotion, string> = {
  calm: "Sakin tempo.",
  anxious: "Endişeyi normalize et; baskı yok.",
  excited: "Heyecanı paylaş; abartma.",
  skeptical: "İddia değil kanıt; sakin.",
  hurried: "Çok kısa; net sonraki adım.",
  warm: "Sıcak ama script tekrarlama.",
};

/** Prompt’a basılacak kısa beyin bloğu. */
export function composeSalesBrainPromptBlock(
  brain: SalesBrainSnapshot
): string {
  const banned = brain.memory.rejectedTopics.length
    ? brain.memory.rejectedTopics.join(", ")
    : "(yok)";
  const closings = brain.memory.usedClosings.slice(-5);
  const priceOk =
    brain.nextBestAction === "give_price" ||
    brain.objective === "give_price" ||
    brain.state === "price" ||
    brain.state === "deposit";

  return [
    "## SATIŞ BEYNİ (zorunlu — senaryo yazarı değil, danışman)",
    `State: ${brain.state}`,
    `Müşteri tipi: ${brain.customerType}${brain.customerTypeLocked ? " (kilitli)" : ""} · güven %${brain.customerTypeConfidence}`,
    `Tip dili: ${CUSTOMER_TYPE_HINT[brain.customerType]}`,
    `Emotion: ${brain.emotion} · Style: ${brain.style}`,
    `SKORLAR → Güven: ${brain.scores.trust} · Satın alma niyeti: ${brain.scores.purchaseIntent} · Fiyat hassasiyeti: ${brain.scores.priceSensitivity} · Aciliyet: ${brain.scores.urgency}`,
    `Bu mesajın AMACI: ${OBJECTIVE_LABEL[brain.objective]} (${brain.objective})`,
    `Next Best Action: ${NBA_LABEL[brain.nextBestAction]} (${brain.nextBestAction})`,
    `Engel: ${brain.mainBlocker}`,
    `TEK HEDEF: ${brain.singleGoal}`,
    `Stil: ${STYLE_HINT[brain.style]} ${PERSONA_HINT[brain.persona]} ${EMOTION_HINT[brain.emotion]}`,
    priceOk
      ? "Fiyat bu turda VERİLEBİLİR (NBA/objective izin veriyor) — yine kısa tut."
      : "⛔ Bu turda FİYAT/RAKAM YAZMA — NBA fiyat değil. Önce amaç + NBA.",
    "Memory JSON (unutma; reddedileni tekrar önerme):",
    JSON.stringify(brain.memory),
    `Yasak konular: ${banned}`,
    closings.length
      ? `Kullanılmış kapanışlar (TEKRARLAMA): ${closings.join(" | ")}`
      : "Kullanılmış kapanış: yok — yine de 'Eşinizle bugün mü / hafta sonu mu?' YASAK.",
    "Kurallar: ~3 satır · 1 soru · tek amaç (= objective) · NBA'ya uy · müşteriyi konuştur.",
  ].join("\n");
}

export type ReflectIssueCheck = {
  pass: boolean;
  issues: string[];
};

/** Hızlı reflection — LLM yok. */
export function reflectReply(
  reply: string,
  brain: SalesBrainSnapshot,
  customerMessage: string
): ReflectIssueCheck {
  const issues: string[] = [];
  const r = reply.toLocaleLowerCase("tr-TR");
  const lineCount = reply
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean).length;
  const len = reply.replace(/\s+/g, " ").trim().length;

  if (len > 280 || lineCount > 5) {
    issues.push("Mesaj fazla uzun (~3 satır hedef).");
  }

  const qMarks = (reply.match(/\?/g) ?? []).length;
  if (qMarks >= 2) {
    issues.push("Birden fazla soru — en fazla 1.");
  }

  if (
    /eşinizle\s+(bugün|bugun|hafta\s*sonu)|bugün\s*mü\s*hafta\s*sonu|bugun\s*mu\s*hafta\s*sonu/i.test(
      reply
    )
  ) {
    issues.push("Yasak kapanış scripti (eşinizle bugün/hafta sonu).");
  }

  for (const topic of brain.memory.rejectedTopics) {
    if (topic === "album" && /albüm|album/i.test(reply) && !/istemiyorsanız|albümsüz|albumsuz/i.test(reply)) {
      if (/albüm\s*(düşün|dusunun|ister|önem|onem)/i.test(reply)) {
        issues.push("Reddedilen albüm tekrar önerilmiş.");
      }
    }
  }

  const factHits = [
    /22\s*(retouch|profesyonel)/i.test(reply),
    /albüm|album/i.test(reply),
    /(3\s*gün|3\s*gun)/i.test(reply),
    /(7\s*gün|7\s*gun)/i.test(reply),
    /drone/i.test(reply),
    /yedek\s*ekipman/i.test(reply),
  ].filter(Boolean).length;
  if (factHits >= 4) {
    issues.push("Cognitive load — fazla bilgi.");
  }

  const priceAllowed =
    brain.nextBestAction === "give_price" ||
    brain.objective === "give_price" ||
    brain.state === "price" ||
    brain.state === "deposit";
  if (
    !priceAllowed &&
    /11\.?000|14\.?000|21\.?000/.test(reply)
  ) {
    issues.push("NBA fiyat değilken rakam verilmiş.");
  }
  if (
    brain.state === "greeting" ||
    brain.state === "need_discovery"
  ) {
    if (/11\.?000|14\.?000|21\.?000/.test(reply)) {
      issues.push("Erken fiyat — keşif/değer state'inde rakam.");
    }
  }

  if (
    brain.nextBestAction === "ask_question" &&
    !/\?/.test(reply) &&
    brain.objective !== "wait_follow_up"
  ) {
    issues.push("NBA 'soru sor' ama cevapta soru yok.");
  }

  if (
    brain.nextBestAction === "wait" &&
    /kapora\s*yat|hemen\s*karar|bugün\s*kilit/i.test(reply)
  ) {
    issues.push("NBA 'bekle' iken baskılı kapanış.");
  }

  // Soft close without CTA when customer soft-closes
  const soft = /bakarız|teşekkür|tesekkur|sonra\s*yazar/.test(
    customerMessage.toLocaleLowerCase("tr-TR")
  );
  if (
    soft &&
    /(rica\s*ederim|iyi\s*günler|görüşürüz)/i.test(reply) &&
    !/\?/.test(reply) &&
    brain.nextBestAction !== "wait"
  ) {
    issues.push("Zayıf kapanış — soft CTA yok.");
  }

  void r;
  return { pass: issues.length === 0, issues };
}

/** Kapanış cümlesini memory’ye kaydet (tekrar engeli). */
export function rememberClosingFromReply(
  brain: SalesBrainSnapshot,
  reply: string
): SalesBrainSnapshot {
  const lastLine =
    reply
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .pop() ?? reply.trim().slice(0, 120);
  if (!lastLine || lastLine.length < 8) return brain;
  const used = [...brain.memory.usedClosings, lastLine.slice(0, 160)];
  return {
    ...brain,
    memory: {
      ...brain.memory,
      usedClosings: used.slice(-8),
    },
  };
}

export async function rewriteReplyWithBrain(params: {
  draft: string;
  issues: string[];
  brain: SalesBrainSnapshot;
  customerMessage: string;
}): Promise<string | null> {
  if (!isOpenAiConfigured()) return null;
  try {
    const { completion } = await createRoutedChatCompletion("dm_reply", {
      temperature: 0.45,
      max_tokens: 280,
      messages: [
        {
          role: "system",
          content:
            "Instagram DM satış danışmanısın. Taslağı düzelt. ~3 satır, 1 soru, tek amaç. Yalnız düzeltılmış cevabı yaz.",
        },
        {
          role: "user",
          content: [
            composeSalesBrainPromptBlock(params.brain),
            "",
            `Müşteri: ${params.customerMessage}`,
            "",
            `Taslak:\n${params.draft}`,
            "",
            `Düzeltilecek sorunlar:\n${params.issues.map((i) => `- ${i}`).join("\n")}`,
          ].join("\n"),
        },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    return text || null;
  } catch {
    return null;
  }
}

/**
 * Reflection + koşullu rewrite.
 */
export async function reflectAndMaybeRewrite(params: {
  reply: string;
  brain: SalesBrainSnapshot;
  customerMessage: string;
  /** Template Engine: rewrite stratejiyi bozar — sadece kontrol/memory. */
  skipRewrite?: boolean;
}): Promise<{ reply: string; reflect: SalesBrainReflectResult; brain: SalesBrainSnapshot }> {
  const check = reflectReply(
    params.reply,
    params.brain,
    params.customerMessage
  );
  if (check.pass || params.skipRewrite) {
    return {
      reply: params.reply,
      reflect: {
        pass: check.pass,
        issues: check.issues,
        rewritten: false,
      },
      brain: rememberClosingFromReply(params.brain, params.reply),
    };
  }

  const rewritten = await rewriteReplyWithBrain({
    draft: params.reply,
    issues: check.issues,
    brain: params.brain,
    customerMessage: params.customerMessage,
  });

  if (!rewritten) {
    return {
      reply: params.reply,
      reflect: { pass: false, issues: check.issues, rewritten: false },
      brain: rememberClosingFromReply(params.brain, params.reply),
    };
  }

  const second = reflectReply(rewritten, params.brain, params.customerMessage);
  const finalReply = second.pass || second.issues.length <= check.issues.length
    ? rewritten
    : params.reply;

  return {
    reply: finalReply,
    reflect: {
      pass: second.pass,
      issues: second.pass ? [] : second.issues,
      rewritten: true,
    },
    brain: rememberClosingFromReply(params.brain, finalReply),
  };
}

/** CRM sync payload from brain memory + skorlar. */
export function memoryUpdateFromSalesBrain(
  brain: SalesBrainSnapshot
): {
  rejectedServices?: string[];
  preferredPackages?: string[];
  budget?: string | null;
  bookingProbability?: number;
  customerType?: string;
  customerTypeConfidence?: number;
  priceSensitivity?: string;
} {
  const rejectedServices: string[] = [];
  if (brain.memory.album === false || brain.memory.rejectedTopics.includes("album")) {
    rejectedServices.push("albüm");
  }
  const preferredPackages: string[] = [];
  if (brain.memory.packageLean === "basic") preferredPackages.push("basic_cinema");
  if (brain.memory.packageLean === "premium_album") {
    preferredPackages.push("premium_album");
  }
  if (brain.memory.packageLean === "elite") preferredPackages.push("elite_premium");

  const priceSensitivity =
    brain.scores.priceSensitivity >= 70
      ? "high"
      : brain.scores.priceSensitivity >= 40
        ? "medium"
        : "low";

  return {
    rejectedServices: rejectedServices.length ? rejectedServices : undefined,
    preferredPackages: preferredPackages.length ? preferredPackages : undefined,
    budget:
      brain.memory.budgetTry != null
        ? String(brain.memory.budgetTry)
        : undefined,
    bookingProbability: brain.scores.purchaseIntent,
    customerType: brain.customerType,
    customerTypeConfidence: brain.customerTypeConfidence,
    priceSensitivity,
  };
}
