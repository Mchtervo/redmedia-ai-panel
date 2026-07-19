/**
 * Adversarial Sales Benchmark — LLM müşteri × çoklu koşu × full-conversation judge.
 */

import type { LeadScores, SalesBrainSnapshot } from "@/features/ai/services/sales-brain.service";

export const ADVERSARIAL_PROMPT_VERSION = "adversarial_sales_v1";

export type AdversarialLossTag =
  | "price"
  | "trust"
  | "too_long"
  | "misunderstood"
  | "oversell"
  | "repetition"
  | "wrong_memory"
  | "none";

export type AdversarialScenarioSeed = {
  id: string;
  name: string;
  /** Müşteri LLM'e verilen senaryo özeti (sabit tur metni değil). */
  customerBrief: string;
  /** Konuşmayı başlatan ilk ipucu (müşteri LLM bunu bozabilir). */
  openingHint: string;
  maxTurns: number;
  category: string;
};

export type AdversarialCustomerVariant = {
  variantIndex: number;
  /** Müşteri kişiliği — her koşuda farklı. */
  personaPrompt: string;
  seedLabel: string;
};

export type AdversarialTurnLog = {
  turnIndex: number;
  customerMessage: string;
  assistantReply: string;
  brain: SalesBrainSnapshot | null;
  trust: number | null;
  purchaseIntent: number | null;
  criticRewritten: boolean | null;
};

export type AdversarialConversationJudge = {
  trustTrajectory: string;
  purchaseIntentTrajectory: string;
  whereCustomerWasLost: string | null;
  firstMistakeTurnIndex: number | null;
  replyThatHurtConversion: string | null;
  betterAlternativeReply: string | null;
  lossTags: AdversarialLossTag[];
  finalTrustDelta: number | null;
  finalPurchaseIntentDelta: number | null;
  overallScore: number;
  notes: string[];
};

export type AdversarialVariantRun = {
  scenarioId: string;
  variantIndex: number;
  seedLabel: string;
  turns: AdversarialTurnLog[];
  judge: AdversarialConversationJudge;
  initialScores: LeadScores | null;
  finalScores: LeadScores | null;
  durationMs: number;
  error: string | null;
};

export type AdversarialScenarioAggregate = {
  scenarioId: string;
  name: string;
  variantCount: number;
  avgOverallScore: number;
  avgTrustDelta: number | null;
  avgPurchaseIntentDelta: number | null;
  lossTagCounts: Partial<Record<AdversarialLossTag, number>>;
  firstMistakeTurnAvg: number | null;
  variants: AdversarialVariantRun[];
};

export type AdversarialRunSummary = {
  id: string;
  createdAt: string;
  promptVersion: string;
  customersPerScenario: number;
  scenarioCount: number;
  variantRunCount: number;
  avgOverallScore: number;
  aggregates: AdversarialScenarioAggregate[];
  durationMs: number;
  notes: string[];
};

export type AdversarialRunOptions = {
  scenarioIds?: string[];
  customersPerScenario?: number;
  maxTurnsOverride?: number;
  saveResult?: boolean;
};
