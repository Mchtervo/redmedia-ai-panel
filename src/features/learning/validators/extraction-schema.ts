import { z } from "zod";
import { KNOWLEDGE_CATEGORIES } from "@/features/learning/types";

export const knowledgeProposalSchema = z.object({
  category: z.enum(KNOWLEDGE_CATEGORIES),
  title: z.string().min(3).max(200),
  content: z.string().min(10).max(2000),
  faqQuestion: z.string().max(500).nullable().optional(),
  suggestedAnswer: z.string().max(1000).nullable().optional(),
  exampleGoodReply: z.string().max(1000).nullable().optional(),
  exampleBadReply: z.string().max(1000).nullable().optional(),
  isPricingSensitive: z.coerce.boolean().default(false),
  isCampaignClaim: z.coerce.boolean().default(false),
  /** Personel cevabı çelişkili/yanlış görünüyorsa true — öneri yine pending kalır. */
  staffAnswerUnreliable: z.coerce.boolean().default(false),
});

export const SALES_PATTERN_TYPES = [
  "opening",
  "price_explanation",
  "trust_building",
  "objection_response",
  "closing",
  "failure",
  "leave_reason",
] as const;

export type SalesPatternType = (typeof SALES_PATTERN_TYPES)[number];

export const PERSONALITY_TRAIT_TYPES = [
  "tone",
  "pricing_style",
  "phone_timing",
  "service_offering",
  "vocabulary",
  "trust_style",
] as const;

export type PersonalityTraitType = (typeof PERSONALITY_TRAIT_TYPES)[number];

export const AI_MISTAKE_TYPES = [
  "premature_detail_question",
  "premature_phone_request",
  "wrong_information",
  "missed_buying_signal",
  "repeated_question",
  "tone_mismatch",
  "other",
] as const;

export type AiMistakeType = (typeof AI_MISTAKE_TYPES)[number];

/** Konuşmadan çıkarılan tek satış kalıbı (Learning Engine). */
export const salesPatternProposalSchema = z.object({
  patternType: enumOrDefault(SALES_PATTERN_TYPES, "trust_building"),
  patternText: z.string().min(5).max(600),
  contextNote: nullableText(300).optional(),
});

/** Personel/işletme davranışından çıkarılan şirket kişiliği gözlemi. */
export const personalityObservationSchema = z.object({
  traitType: enumOrDefault(PERSONALITY_TRAIT_TYPES, "tone"),
  traitText: z.string().min(5).max(400),
});

/** AI'nin bu konuşmada yaptığı hata (Self Improvement). */
export const aiMistakeProposalSchema = z.object({
  mistakeType: enumOrDefault(AI_MISTAKE_TYPES, "other"),
  triggerContext: z.string().min(5).max(400),
  wrongReply: nullableText(600).optional(),
  correctApproach: z.string().min(5).max(600),
});

/** Conversation Scoring — 0-100 puanlar + eksikler. */
const score01to100 = z.coerce.number().transform((n) =>
  Math.max(0, Math.min(100, Math.round(n)))
);

/** Model bazen string yerine boolean/number/array döner — metin alanına yumuşat. */
function nullableText(max: number) {
  return z.preprocess((value) => {
    if (value == null) return null;
    if (typeof value === "string") return value;
    if (typeof value === "boolean") return value ? "evet" : null;
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) {
      const joined = value
        .map((item) => (item == null ? "" : String(item)))
        .filter(Boolean)
        .join(", ");
      return joined || null;
    }
    return value;
  }, z.string().max(max).nullable());
}

/** Bilinmeyen trait/mistake tipi → güvenli varsayılan (batch kırılmasın). */
function enumOrDefault<T extends string>(allowed: readonly T[], fallback: T) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return fallback;
    const normalized = value.toLocaleLowerCase("tr-TR").trim();
    return (allowed as readonly string[]).includes(normalized)
      ? normalized
      : fallback;
  }, z.enum(allowed as unknown as [T, ...T[]]));
}

export const conversationScoresSchema = z.object({
  salesQuality: score01to100,
  empathy: score01to100,
  speed: score01to100,
  persuasion: score01to100,
  closing: score01to100,
  gaps: nullableText(600),
});

export const conversationExtractionSchema = z.object({
  customerIntent: nullableText(500),
  eventType: nullableText(120),
  eventDateText: nullableText(120),
  venueType: nullableText(120),
  requestedServices: nullableText(500),
  budgetOrPriceQuestion: nullableText(500),
  objections: nullableText(1000),
  phoneCollected: z.coerce.boolean(),
  saleOutcome: z
    .union([z.string(), z.number(), z.boolean()])
    .transform((v) => String(v).toLowerCase().trim())
    .pipe(z.enum(["won", "lost", "open", "unknown"])),
  advancingReply: nullableText(1000),
  losingReply: nullableText(1000),
  frequentQuestion: nullableText(500),
  recommendedAnswer: nullableText(1000),
  leadScore: score01to100,
  saleProbability: score01to100,
  leadTemperature: z
    .union([z.string(), z.number(), z.boolean()])
    .transform((v) => String(v).toLowerCase().trim())
    .pipe(z.enum(["cold", "warm", "hot"])),
  lossReason: nullableText(500),
  nextAction: nullableText(500),
  summary: nullableText(1500),
  customerNeeds: nullableText(1000),
  knowledgeProposals: z.array(knowledgeProposalSchema).max(8).default([]),
  // --- AI Sales Learning Engine alanları ---
  firstCustomerQuestion: nullableText(500).default(null),
  firstReplyGiven: nullableText(600).default(null),
  dropOffPoint: nullableText(500).default(null),
  reservationCreated: z.coerce.boolean().default(false),
  depositReceived: z.coerce.boolean().default(false),
  scores: conversationScoresSchema.nullable().default(null),
  salesPatterns: z.array(salesPatternProposalSchema).max(10).default([]),
  personalityObservations: z
    .array(personalityObservationSchema)
    .max(6)
    .default([]),
  aiMistakes: z.array(aiMistakeProposalSchema).max(6).default([]),
});

export type ConversationExtraction = z.infer<typeof conversationExtractionSchema>;
export type KnowledgeProposal = z.infer<typeof knowledgeProposalSchema>;
export type SalesPatternProposal = z.infer<typeof salesPatternProposalSchema>;
export type PersonalityObservation = z.infer<typeof personalityObservationSchema>;
export type AiMistakeProposal = z.infer<typeof aiMistakeProposalSchema>;
export type ConversationScores = z.infer<typeof conversationScoresSchema>;

export const knowledgeReviewActionSchema = z.object({
  knowledgeId: z.string().uuid(),
  action: z.enum(["approve", "reject", "edit"]),
  title: z.string().min(3).max(200).optional(),
  content: z.string().min(10).max(4000).optional(),
  category: z.enum(KNOWLEDGE_CATEGORIES).optional(),
  reviewNotes: z.string().max(1000).optional(),
});

export type KnowledgeReviewActionInput = z.infer<
  typeof knowledgeReviewActionSchema
>;
