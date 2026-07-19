"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import {
  deleteAutomationRule,
  insertAutomationRule,
  setAutomationRuleEnabled,
} from "@/features/automations/repositories/automations.repository";
import type { Json } from "@/types/database";

export type AutomationActionResult =
  | { success: true }
  | { success: false; error: string };

async function requireCurrentUserId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    throw new Error("Oturum bulunamadı.");
  }
  return data.user.id;
}

const createRuleSchema = z.object({
  name: z.string().min(2, "Kural adı en az 2 karakter olmalı.").max(120),
  triggerType: z.enum([
    "inbound_message",
    "reservation_created",
    "deposit_verified",
  ]),
  // Basit koşul: mesaj/alan içinde kelime arama (boş = koşulsuz çalışır)
  keyword: z.string().max(80).optional(),
  actionType: z.enum(["panel_notification", "approval_request"]),
  actionTitle: z.string().min(2, "Aksiyon başlığı gerekli.").max(200),
  actionBody: z.string().max(500).optional(),
});

export async function createAutomationRuleAction(
  input: unknown
): Promise<AutomationActionResult> {
  const parsed = createRuleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Geçersiz girdi.",
    };
  }

  try {
    const userId = await requireCurrentUserId();
    const admin = createAdminClient();
    const { name, triggerType, keyword, actionType, actionTitle, actionBody } =
      parsed.data;

    const conditions: Json =
      keyword && keyword.trim().length > 0
        ? [
            {
              field: triggerType === "inbound_message" ? "message" : "eventType",
              op: "contains",
              value: keyword.trim(),
            },
          ]
        : [];

    const actions: Json =
      actionType === "panel_notification"
        ? [
            {
              type: "panel_notification",
              params: {
                title: actionTitle.trim(),
                ...(actionBody?.trim() ? { body: actionBody.trim() } : {}),
              },
            },
          ]
        : [
            {
              type: "approval_request",
              params: { title: actionTitle.trim() },
            },
          ];

    await insertAutomationRule(admin, {
      name,
      triggerType,
      conditions,
      actions,
      createdBy: userId,
    });

    revalidatePath("/dashboard/automations");
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kural oluşturulamadı.";
    return { success: false, error: message };
  }
}

const toggleSchema = z.object({
  ruleId: z.string().uuid(),
  isEnabled: z.boolean(),
});

export async function toggleAutomationRuleAction(
  input: unknown
): Promise<AutomationActionResult> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Geçersiz girdi." };
  }
  try {
    await requireCurrentUserId();
    const admin = createAdminClient();
    await setAutomationRuleEnabled(
      admin,
      parsed.data.ruleId,
      parsed.data.isEnabled
    );
    revalidatePath("/dashboard/automations");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "İşlem başarısız.";
    return { success: false, error: message };
  }
}

const deleteSchema = z.object({ ruleId: z.string().uuid() });

export async function deleteAutomationRuleAction(
  input: unknown
): Promise<AutomationActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Geçersiz girdi." };
  }
  try {
    await requireCurrentUserId();
    const admin = createAdminClient();
    await deleteAutomationRule(admin, parsed.data.ruleId);
    revalidatePath("/dashboard/automations");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "İşlem başarısız.";
    return { success: false, error: message };
  }
}
