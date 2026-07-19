"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/server/supabase/admin";
import {
  setAiFeatureFlags,
  setDailyAdBudgetTry,
} from "@/features/settings/services/ai-feature-flags.service";
import {
  AI_FLAG_KEYS,
  DEFAULT_AI_FEATURE_FLAGS,
  type AiFeatureFlags,
} from "@/features/settings/types";

export type SettingsActionResult =
  | { success: true }
  | { success: false; error: string };

const flagsSchema = z.object({
  AI_MASTER: z.boolean(),
  AI_DM_ASSISTANT: z.boolean(),
  AI_LEARNING: z.boolean(),
  AI_BRAIN: z.boolean(),
  AI_FOLLOW_UP: z.boolean(),
  AI_RESERVATION: z.boolean(),
  AI_MARKETING: z.boolean(),
  AI_CEO: z.boolean(),
});

export async function updateAiFeatureFlagsAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const raw: Partial<AiFeatureFlags> = {};
    for (const key of AI_FLAG_KEYS) {
      // Checkbox: yoksa false
      raw[key] = formData.get(key) === "on" || formData.get(key) === "true";
    }
    // Master kapalıysa diğerleri de kapalı kaydedilir (UI netliği)
    if (raw.AI_MASTER === false) {
      for (const key of AI_FLAG_KEYS) {
        if (key !== "AI_MASTER") raw[key] = false;
      }
    }

    const parsed = flagsSchema.safeParse({
      ...DEFAULT_AI_FEATURE_FLAGS,
      ...raw,
    });
    if (!parsed.success) {
      return { success: false, error: "Geçersiz anahtar değerleri." };
    }

    const supabase = createAdminClient();
    await setAiFeatureFlags(supabase, parsed.data as AiFeatureFlags);
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Kayıt başarısız.",
    };
  }
}

export async function updateDailyAdBudgetAction(
  formData: FormData
): Promise<SettingsActionResult> {
  try {
    const raw = String(formData.get("daily_ad_budget_try") ?? "").trim();
    const amount = raw === "" ? null : Number(raw);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      return { success: false, error: "Geçerli bir bütçe girin." };
    }
    const supabase = createAdminClient();
    await setDailyAdBudgetTry(supabase, amount);
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/marketing");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Kayıt başarısız.",
    };
  }
}
