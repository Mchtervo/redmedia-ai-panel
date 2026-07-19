import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import {
  getOrCreateBusinessSettings,
  updateBusinessSettingsJson,
} from "@/features/settings/repositories/business-settings.repository";
import {
  AI_FLAG_KEYS,
  DEFAULT_AI_FEATURE_FLAGS,
  type AiFeatureFlags,
  type AiFlagKey,
} from "@/features/settings/types";
import { isOpenAiConfigured } from "@/lib/ai/openai-client";

type TypedSupabaseClient = SupabaseClient<Database>;

type SettingsBlob = {
  ai_flags?: Partial<Record<AiFlagKey, boolean>>;
  daily_ad_budget_try?: number;
  follow_up_undecided_days?: number;
};

function asRecord(value: Json | null | undefined): SettingsBlob {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as SettingsBlob;
}

export function mergeAiFeatureFlags(
  partial: Partial<Record<AiFlagKey, boolean>> | undefined
): AiFeatureFlags {
  const merged = { ...DEFAULT_AI_FEATURE_FLAGS };
  if (!partial) return merged;
  for (const key of AI_FLAG_KEYS) {
    if (typeof partial[key] === "boolean") {
      merged[key] = partial[key]!;
    }
  }
  return merged;
}

export async function getAiFeatureFlags(
  supabase: TypedSupabaseClient
): Promise<AiFeatureFlags> {
  const row = await getOrCreateBusinessSettings(supabase);
  const blob = asRecord(row.settings);
  return mergeAiFeatureFlags(blob.ai_flags);
}

/**
 * Tek bayrak kontrolü. AI_MASTER kapalıysa her şey false.
 * Env `AI_AUTO_REPLY_ENABLED=false` DM için ek sert kapatma.
 */
export async function isAiFeatureEnabled(
  supabase: TypedSupabaseClient,
  key: AiFlagKey
): Promise<boolean> {
  const flags = await getAiFeatureFlags(supabase);
  if (!flags.AI_MASTER) return false;
  if (key === "AI_MASTER") return flags.AI_MASTER;

  if (key === "AI_DM_ASSISTANT") {
    // Canlı DM: açıkça true olmadıkça kapalı (AI_REPLY_ENABLED / AI_AUTO_REPLY_ENABLED)
    const env = (
      process.env.AI_REPLY_ENABLED ??
      process.env.AI_AUTO_REPLY_ENABLED ??
      ""
    )
      .trim()
      .toLowerCase();
    if (env !== "true" && env !== "1" && env !== "on") return false;
    if (!isOpenAiConfigured()) return false;
  }

  return flags[key];
}

export async function setAiFeatureFlags(
  supabase: TypedSupabaseClient,
  nextFlags: AiFeatureFlags
): Promise<AiFeatureFlags> {
  const row = await getOrCreateBusinessSettings(supabase);
  const blob = asRecord(row.settings);
  const merged = mergeAiFeatureFlags(nextFlags);
  const updated = await updateBusinessSettingsJson(supabase, row.id, {
    ...blob,
    ai_flags: merged,
    ai_flags_meta: {
      updated_at: new Date().toISOString(),
    },
  } as Json);
  return mergeAiFeatureFlags(asRecord(updated.settings).ai_flags);
}

export async function getDailyAdBudgetTry(
  supabase: TypedSupabaseClient
): Promise<number | null> {
  const row = await getOrCreateBusinessSettings(supabase);
  const blob = asRecord(row.settings);
  const value = blob.daily_ad_budget_try;
  return typeof value === "number" && value > 0 ? value : null;
}

export async function setDailyAdBudgetTry(
  supabase: TypedSupabaseClient,
  amount: number | null
): Promise<void> {
  const row = await getOrCreateBusinessSettings(supabase);
  const blob = asRecord(row.settings);
  await updateBusinessSettingsJson(supabase, row.id, {
    ...blob,
    daily_ad_budget_try:
      amount && amount > 0 ? Math.round(amount) : undefined,
  } as Json);
}
