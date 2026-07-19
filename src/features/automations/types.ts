import { z } from "zod";
import type { Database } from "@/types/database";

export type AutomationRuleRow =
  Database["public"]["Tables"]["automation_rules"]["Row"];
export type AutomationRunRow =
  Database["public"]["Tables"]["automation_runs"]["Row"];

export type AutomationTrigger = AutomationRuleRow["trigger_type"];

export const AUTOMATION_TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  inbound_message: "Yeni müşteri mesajı",
  reservation_created: "Rezervasyon oluşturuldu",
  deposit_verified: "Kapora onaylandı",
};

export const AUTOMATION_RUN_STATUS_LABELS: Record<
  AutomationRunRow["status"],
  string
> = {
  completed: "Tamamlandı",
  skipped: "Koşul sağlanmadı",
  failed: "Hata",
};

/**
 * Koşul: olay bağlamındaki bir alan üzerinde basit karşılaştırma.
 * Örn. { field: "message", op: "contains", value: "iptal" }
 */
export const automationConditionSchema = z.object({
  field: z.string().min(1),
  op: z.enum(["contains", "not_contains", "equals", "gt", "lt"]),
  value: z.union([z.string(), z.number()]),
});
export type AutomationCondition = z.infer<typeof automationConditionSchema>;

/**
 * Aksiyonlar bilinçli olarak sınırlı tutulur (docs/META, 04-ai-behavior):
 * otomasyon dış sisteme yazamaz, bütçe/durum değiştiremez.
 */
export const automationActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("panel_notification"),
    params: z.object({
      title: z.string().min(1).max(200),
      body: z.string().max(500).optional(),
    }),
  }),
  z.object({
    type: z.literal("approval_request"),
    params: z.object({
      title: z.string().min(1).max(200),
    }),
  }),
]);
export type AutomationAction = z.infer<typeof automationActionSchema>;

export const automationConditionsSchema = z.array(automationConditionSchema);
export const automationActionsSchema = z
  .array(automationActionSchema)
  .min(1, "En az bir aksiyon gerekli.");

export const AUTOMATION_ACTION_LABELS: Record<
  AutomationAction["type"],
  string
> = {
  panel_notification: "Panel bildirimi gönder",
  approval_request: "Onay talebi oluştur",
};

/** Olay bağlamı: koşullar bu alanlar üzerinde değerlendirilir. */
export type AutomationEventContext = {
  /** inbound_message: müşteri mesajı metni */
  message?: string;
  /** reservation_created / deposit_verified */
  reservationId?: string;
  totalPrice?: number;
  eventType?: string;
  conversationId?: string;
  contactId?: string;
};
