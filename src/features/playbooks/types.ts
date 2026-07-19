/**
 * Playbook Engine (docs/27_PLAYBOOK_ENGINE.md) — ortak tipler.
 * Kanıtlanmış süreçler versiyonlu AI rehberlerine dönüştürülür;
 * aktifleştirme insan onayı gerektirir (draft → review → active → archived).
 */

import type { Database } from "@/types/database";

export type AiPlaybookRow = Database["public"]["Tables"]["ai_playbooks"]["Row"];

export type PlaybookCategory = AiPlaybookRow["category"];
export type PlaybookStatus = AiPlaybookRow["status"];

export const PLAYBOOK_CATEGORY_LABELS: Record<PlaybookCategory, string> = {
  sales: "Satış",
  marketing: "Pazarlama",
  support: "Destek",
  reservation: "Rezervasyon",
};

export const PLAYBOOK_STATUS_LABELS: Record<PlaybookStatus, string> = {
  draft: "Taslak",
  review: "İncelemede",
  active: "Aktif",
  archived: "Arşivlendi",
};

/** JSONB steps/decision_rules alanlarını güvenli string dizisine çevirir. */
export function jsonToStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
