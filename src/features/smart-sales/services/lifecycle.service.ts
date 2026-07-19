import type { LifecycleStage } from "@/features/smart-sales/types";
import { LIFECYCLE_STAGE_LABELS, LIFECYCLE_TONE_HINTS } from "@/features/smart-sales/types";

export type LifecycleSignals = {
  hasEventDate?: boolean;
  hasPhone?: boolean;
  hasRequestedServices?: boolean;
  priceDiscussed?: boolean;
  negotiating?: boolean;
  reservationStatus?: string | null;
  depositStatus?: string | null;
  daysSinceLastMessage?: number | null;
  cancelled?: boolean;
};

/**
 * Sinyallerden yaşam döngüsü aşaması üretir (tahmin; admin override edilebilir).
 */
export function inferLifecycleStage(signals: LifecycleSignals): LifecycleStage {
  if (signals.cancelled) return "cancelled";

  const status = signals.reservationStatus ?? "";
  const deposit = signals.depositStatus ?? "";

  if (status === "completed" || status === "delivered") return "completed";
  if (status === "shoot_completed") return "shoot_completed";
  if (status === "delivery" || status === "editing") return "delivery";
  if (status === "confirmed") return "reservation_confirmed";
  if (status === "payment_review" || deposit === "under_review" || deposit === "receipt_uploaded") {
    return "awaiting_receipt";
  }
  if (status === "deposit_pending" || deposit === "requested") {
    return "awaiting_deposit";
  }
  if (status === "draft" || status === "inquiry") {
    if (signals.negotiating) return "negotiating";
    if (signals.priceDiscussed) return "price_given";
    return "awaiting_reservation";
  }

  if (
    (signals.daysSinceLastMessage ?? 0) >= 30 &&
    !["confirmed", "shoot_completed", "completed"].includes(status)
  ) {
    return "passive";
  }

  if (signals.negotiating) return "negotiating";
  if (signals.priceDiscussed) return "price_given";
  if (
    signals.hasEventDate ||
    signals.hasPhone ||
    signals.hasRequestedServices
  ) {
    return "gathering_info";
  }

  return "new_customer";
}

export function lifecyclePromptBlock(stage: LifecycleStage): string {
  return [
    `Yaşam döngüsü: ${LIFECYCLE_STAGE_LABELS[stage]} (${stage})`,
    `Ton ipucu: ${LIFECYCLE_TONE_HINTS[stage]}`,
  ].join("\n");
}
