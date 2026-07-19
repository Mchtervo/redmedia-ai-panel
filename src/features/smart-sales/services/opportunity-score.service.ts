/**
 * Opportunity Score 0–100 — tahmini satış fırsatı puanı.
 */
export type OpportunityInputs = {
  totalMessages: number;
  hasPhone: boolean;
  hasEventDate: boolean;
  hasServices: boolean;
  bookingProbability: number | null;
  negotiationTendency: string | null;
  priceSensitivity: string | null;
  decisionSpeed: string | null;
  daysUntilEvent: number | null;
  replyGapHours: number | null;
  priorReservation: boolean;
  priorCancellation: boolean;
  lifecycleStage?: string | null;
};

export function computeOpportunityScore(input: OpportunityInputs): number {
  let score = 15;

  score += Math.min(20, input.totalMessages * 2);
  if (input.hasPhone) score += 12;
  if (input.hasEventDate) score += 12;
  if (input.hasServices) score += 8;
  if (input.bookingProbability != null) {
    score += Math.round(input.bookingProbability * 0.25);
  }

  if (input.decisionSpeed === "hızlı" || input.decisionSpeed === "hizli") {
    score += 8;
  }
  if (input.decisionSpeed === "kararsız" || input.decisionSpeed === "kararsiz") {
    score -= 5;
  }

  if (/yüksek|yuksek/i.test(input.negotiationTendency ?? "")) score -= 6;
  if (/yüksek|yuksek|hassas/i.test(input.priceSensitivity ?? "")) score -= 5;
  if (/düşük|dusuk/i.test(input.priceSensitivity ?? "")) score += 4;

  if (input.daysUntilEvent != null) {
    if (input.daysUntilEvent <= 14) score += 10;
    else if (input.daysUntilEvent <= 45) score += 6;
    else if (input.daysUntilEvent > 180) score -= 4;
  }

  if (input.replyGapHours != null) {
    if (input.replyGapHours <= 6) score += 8;
    else if (input.replyGapHours <= 24) score += 4;
    else if (input.replyGapHours > 72) score -= 6;
  }

  if (input.priorReservation) score += 5;
  if (input.priorCancellation) score -= 8;

  const stage = input.lifecycleStage ?? "";
  if (stage === "awaiting_deposit" || stage === "awaiting_receipt") score += 10;
  if (stage === "reservation_confirmed") score += 15;
  if (stage === "passive" || stage === "cancelled") score -= 20;
  if (stage === "negotiating") score += 3;

  return Math.max(0, Math.min(100, Math.round(score)));
}
