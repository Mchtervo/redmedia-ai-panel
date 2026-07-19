/**
 * Sales Benchmark — otomatik satış danışmanı değerlendirme tipleri.
 */

import type {
  ConversationObjective,
  CustomerType,
  LeadScores,
  NextBestAction,
  SalesBrainSnapshot,
  SalesFunnelState,
} from "@/features/ai/services/sales-brain.service";

export const BENCHMARK_PROMPT_VERSION = "sales_brain_v1.1";

export type BenchmarkDifficulty = "easy" | "medium" | "hard" | "stress";

export type ExpectedBehavior =
  | "directly_answers_price_request"
  | "explains_relevant_value_briefly"
  | "does_not_attack_competitor"
  | "uses_natural_soft_close"
  | "acknowledges_budget"
  | "handles_spouse_split"
  | "builds_trust"
  | "respects_rejection"
  | "asks_at_most_one_question"
  | "short_dm_reply"
  | "offers_deposit_path"
  | "stays_professional_under_abuse"
  | "does_not_repeat_known_facts";

export type ForbiddenBehavior =
  | "repeats_same_question"
  | "hides_price_after_second_request"
  | "fake_scarcity"
  | "long_information_dump"
  | "attacks_competitor"
  | "reoffers_rejected_service"
  | "invents_price_or_claim"
  | "abusive_reply"
  | "wrong_memory"
  | "hard_commitment_without_approval"
  | "repeats_spouse_script"
  | "early_price_against_nba";

export type HardFailReason =
  | "invented_price_service_or_availability"
  | "reoffered_rejected_service"
  | "repeated_same_question"
  | "attacked_competitor"
  | "fake_discount_or_scarcity"
  | "abusive_response"
  | "hid_price_after_second_ask"
  | "cognitive_dump"
  | "wrong_memory"
  | "hard_promise_needs_human"
  | "reflection_failed_no_rewrite"
  | "generation_failed";

export type ScenarioTurn = {
  /** Sabit müşteri mesajı */
  customer?: string;
  /**
   * Koşullu mesaj — önceki asistan cevabı / brain’e göre.
   * Dönüş: gönderilecek müşteri metni.
   */
  when?: (ctx: {
    lastReply: string;
    brain: SalesBrainSnapshot | null;
    turnIndex: number;
  }) => string;
};

export type ExpectedMemory = {
  album?: boolean | null;
  clip?: boolean | null;
  photo?: boolean | null;
  budgetTry?: number | null;
  dateHintIncludes?: string;
  venueHintIncludes?: string;
  rejectedTopicsIncludes?: string[];
  packageLean?: "basic" | "premium_album" | "elite" | null;
};

export type ExpectedScoreRanges = {
  trust?: [number, number];
  purchaseIntent?: [number, number];
  priceSensitivity?: [number, number];
  urgency?: [number, number];
};

export type SalesBenchmarkScenario = {
  id: string;
  name: string;
  difficulty: BenchmarkDifficulty;
  targetCustomerType: CustomerType | "any";
  category: string;
  turns: ScenarioTurn[];
  expectedBehaviors: ExpectedBehavior[];
  forbiddenBehaviors: ForbiddenBehavior[];
  expectedMemory?: ExpectedMemory;
  expectedFinalStage?: SalesFunnelState | SalesFunnelState[];
  expectedScoreRanges?: ExpectedScoreRanges;
  /** İkinci fiyat talebinden sonra fiyat verilmeli */
  requirePriceAfterSecondAsk?: boolean;
  isMasterStress?: boolean;
};

export type BenchmarkTurnLog = {
  turnIndex: number;
  customerMessage: string;
  originalReply: string;
  finalReply: string;
  model: string;
  aiRunId: string;
  brain: SalesBrainSnapshot | null;
  reflection: {
    pass: boolean | null;
    issues: string[];
    rewritten: boolean;
    findings: string[];
    detectedRepetition: boolean;
    detectedMemoryConflict: boolean;
    detectedUnsupportedClaim: boolean;
    detectedOverlength: boolean;
    detectedWrongObjective: boolean;
  };
  funnelState: SalesFunnelState | null;
  scores: LeadScores | null;
  customerType: CustomerType | null;
  customerTypeConfidence: number | null;
  objective: ConversationObjective | null;
  nextBestAction: NextBestAction | null;
  memorySnapshot: SalesBrainSnapshot["memory"] | null;
};

export type ScoreBreakdown = {
  questionUnderstanding: number; // /10
  memoryUsage: number; // /15
  customerTypeDetection: number; // /10
  empathyTone: number; // /10
  valuePresentation: number; // /10
  objectionHandling: number; // /15
  brevityNaturalness: number; // /10
  singlePurpose: number; // /5
  nextBestAction: number; // /10
  ethicalClosing: number; // /5
};

export type ScenarioEvaluation = {
  scenarioId: string;
  totalScore: number;
  pass: boolean;
  hardFails: HardFailReason[];
  breakdown: ScoreBreakdown;
  deterministicScore: number;
  softScore: number;
  notes: string[];
  behaviorHits: string[];
  behaviorMisses: string[];
};

export type ScenarioRunResult = {
  scenario: SalesBenchmarkScenario;
  turns: BenchmarkTurnLog[];
  evaluation: ScenarioEvaluation;
  durationMs: number;
};

export type BenchmarkRunSummary = {
  benchmarkVersion: string;
  gitCommit: string | null;
  promptVersion: string;
  model: string | null;
  date: string;
  averageScore: number;
  passRate: number;
  hardFailCount: number;
  scenarioCount: number;
  passedCount: number;
  failedCount: number;
  repetitionPenalty: number;
  repeatedPhrases: { phrase: string; count: number }[];
  byDifficulty: Record<
    BenchmarkDifficulty,
    { avg: number; passRate: number; count: number }
  >;
  byCategory: Record<string, { avg: number; passRate: number; count: number }>;
  hardFailList: { scenarioId: string; reasons: HardFailReason[] }[];
  worstReplies: {
    scenarioId: string;
    reply: string;
    reason: string;
    score: number;
  }[];
  bestReplies: {
    scenarioId: string;
    reply: string;
    reason: string;
    score: number;
  }[];
  regression: {
    comparedTo: string | null;
    failed: boolean;
    reasons: string[];
  };
  scenarioResults: ScenarioRunResult[];
};

export type BenchmarkRunOptions = {
  scenarioIds?: string[];
  difficulties?: BenchmarkDifficulty[];
  /** LLM soft scoring (max %40). Kapalıysa heuristic soft. */
  useLlmJudge?: boolean;
  saveResult?: boolean;
  gitCommit?: string | null;
};
