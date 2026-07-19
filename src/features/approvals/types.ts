/**
 * Approval Engine (docs/43 §12) — ortak tipler ve Türkçe etiketler.
 * İnsan onayı gereken AI aksiyonları tek kuyrukta yönetilir.
 */

import type { Database } from "@/types/database";

export type AiApprovalRow = Database["public"]["Tables"]["ai_approvals"]["Row"];

export type ApprovalActionType = AiApprovalRow["action_type"];
export type ApprovalStatus = AiApprovalRow["status"];

export const APPROVAL_ACTION_LABELS: Record<ApprovalActionType, string> = {
  assistant_reply: "Müşteri talebi (şikayet/indirim/iptal/özel fiyat)",
  knowledge_publish: "Bilgi yayını",
  playbook_activate: "Playbook aktifleştirme",
  budget_change: "Bütçe değişikliği önerisi",
  other: "Diğer",
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: "Bekliyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  expired: "Süresi doldu",
};
