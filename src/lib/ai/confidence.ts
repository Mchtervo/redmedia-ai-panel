/**
 * Confidence Engine eşikleri (docs/01_PROJECT_VISION.md Human Approval).
 * Her AI aksiyonu güven puanına göre bir yürütme moduna eşlenir:
 *   90+  → otomatik
 *   70+  → öner (etkinse uygula)
 *   50+  → insan onayı iste
 *   <50  → asla uygulama
 */

export type ConfidenceAction =
  | "automatic"
  | "recommend"
  | "require_approval"
  | "never_execute";

export function resolveConfidenceAction(confidence: number): ConfidenceAction {
  if (confidence >= 90) return "automatic";
  if (confidence >= 70) return "recommend";
  if (confidence >= 50) return "require_approval";
  return "never_execute";
}

export const CONFIDENCE_ACTION_LABELS: Record<ConfidenceAction, string> = {
  automatic: "Otomatik",
  recommend: "Öneri",
  require_approval: "Onay gerekli",
  never_execute: "Uygulanmaz",
};
