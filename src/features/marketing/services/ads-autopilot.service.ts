/**
 * Meta Ads Autopilot — deterministik kurallar + Meta yazma + audit.
 * Kill-switch: META_ADS_AUTOPILOT_ENABLED=true VE business_settings.meta_ads_autopilot_ui_enabled !== false
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  buildAdsHierarchy,
  type HierarchyAdSet,
} from "@/features/marketing/services/ads-hierarchy.service";
import { resolveMarketingDateRange } from "@/features/marketing/services/marketing-metrics.service";
import {
  budgetActionPayload,
  insertAdActionLog,
  setMetaAdSetDailyBudget,
  setMetaEntityStatus,
} from "@/features/marketing/services/meta/meta-ads-write.service";
import {
  getOrCreateBusinessSettings,
  updateBusinessSettingsJson,
} from "@/features/settings/repositories/business-settings.repository";
import type { Json } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function isAutopilotEnvEnabled(): boolean {
  const flag = process.env.META_ADS_AUTOPILOT_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "on";
}

function minSpendTry(): number {
  const n = Number(process.env.META_ADS_AUTOPILOT_MIN_SPEND_TRY?.trim() || "300");
  return Number.isFinite(n) && n > 0 ? n : 300;
}

function budgetDeltaPct(): number {
  const n = Number(
    process.env.META_ADS_AUTOPILOT_MAX_BUDGET_DELTA_PCT?.trim() || "20"
  );
  return Number.isFinite(n) && n > 0 && n <= 50 ? n : 20;
}

export async function getAutopilotUiEnabled(
  supabase: TypedSupabaseClient
): Promise<boolean> {
  const row = await getOrCreateBusinessSettings(supabase);
  const blob = asRecord(row.settings);
  // Varsayılan: UI açık (env kapısı asıl kill-switch)
  if (blob.meta_ads_autopilot_ui_enabled === false) return false;
  return true;
}

export async function setAutopilotUiEnabled(
  supabase: TypedSupabaseClient,
  enabled: boolean
): Promise<void> {
  const row = await getOrCreateBusinessSettings(supabase);
  const blob = asRecord(row.settings);
  await updateBusinessSettingsJson(supabase, row.id, {
    ...blob,
    meta_ads_autopilot_ui_enabled: enabled,
  } as Json);
}

export async function isAutopilotFullyArmed(
  supabase: TypedSupabaseClient
): Promise<boolean> {
  if (!isAutopilotEnvEnabled()) return false;
  return getAutopilotUiEnabled(supabase);
}

export type AutopilotRunSummary = {
  armed: boolean;
  dryRun: boolean;
  considered: number;
  applied: number;
  skipped: number;
  actions: Array<{
    metaAdSetId: string;
    name: string;
    action: string;
    reason: string;
    success: boolean;
  }>;
};

/**
 * Son 7 gün metriklerine göre ad set kararları.
 * dryRun=true → Meta'ya yazmaz, sadece log.
 */
export async function runAdsAutopilot(
  supabase: TypedSupabaseClient,
  opts?: { dryRun?: boolean; maxActions?: number }
): Promise<AutopilotRunSummary> {
  const armed = await isAutopilotFullyArmed(supabase);
  const dryRun = opts?.dryRun ?? !armed;
  const maxActions = opts?.maxActions ?? 8;
  const range = resolveMarketingDateRange("last_7");
  const hierarchy = await buildAdsHierarchy(supabase, range);

  const actions: AutopilotRunSummary["actions"] = [];
  let applied = 0;
  let skipped = 0;
  let considered = 0;

  const flatSets: HierarchyAdSet[] = [];
  for (const c of hierarchy.campaigns) {
    for (const s of c.adSets) flatSets.push(s);
  }

  // Önce kötü (pause), sonra iyi (scale)
  const ordered = [...flatSets].sort((a, b) => {
    const rank = (s: HierarchyAdSet) =>
      s.metrics.score === "bad" ? 0 : s.metrics.score === "good" ? 1 : 2;
    return rank(a) - rank(b) || b.metrics.spend - a.metrics.spend;
  });

  for (const set of ordered) {
    if (actions.length >= maxActions) break;
    if (set.metrics.spend < minSpendTry()) {
      skipped += 1;
      continue;
    }
    if (set.status === "archived" || set.status === "deleted") {
      skipped += 1;
      continue;
    }

    considered += 1;
    const decision = decideForAdSet(set);
    if (!decision) {
      skipped += 1;
      continue;
    }

    let success = false;
    let errorCode: string | null = null;
    let afterValue: Json | null = null;

    if (dryRun) {
      success = true;
      afterValue = { planned: decision.action };
    } else if (decision.action === "pause") {
      const res = await setMetaEntityStatus({
        supabase,
        metaEntityId: set.metaAdSetId,
        status: "PAUSED",
      });
      success = res.ok;
      errorCode = res.ok ? null : res.code;
      afterValue = { status: "PAUSED" };
      if (res.ok) {
        await supabase
          .from("ad_sets")
          .update({ status: "paused" })
          .eq("id", set.id);
      }
    } else if (
      decision.action === "budget_increase" &&
      set.dailyBudget != null &&
      set.dailyBudget > 0
    ) {
      const pct = budgetDeltaPct();
      const target = set.dailyBudget * (1 + pct / 100);
      const res = await setMetaAdSetDailyBudget({
        supabase,
        metaAdSetId: set.metaAdSetId,
        currentBudgetTry: set.dailyBudget,
        targetBudgetTry: target,
      });
      success = res.ok;
      errorCode = res.ok ? null : res.code;
      if (res.ok) {
        afterValue = { daily_budget_try: res.appliedTry };
        await supabase
          .from("ad_sets")
          .update({ daily_budget: res.appliedTry })
          .eq("id", set.id);
      }
    } else {
      skipped += 1;
      continue;
    }

    const payload =
      decision.action === "budget_increase" && set.dailyBudget != null
        ? budgetActionPayload(
            set.dailyBudget,
            set.dailyBudget * (1 + budgetDeltaPct() / 100)
          )
        : {
            before: { status: set.status },
            after: afterValue,
          };

    await insertAdActionLog(supabase, {
      entity_type: "ad_set",
      entity_id: set.id,
      meta_entity_id: set.metaAdSetId,
      action: dryRun ? "dry_run" : decision.action,
      before_value: payload.before,
      after_value: payload.after,
      reason: decision.reason,
      score: set.metrics.score,
      dry_run: dryRun,
      success,
      error_code: errorCode,
    });

    actions.push({
      metaAdSetId: set.metaAdSetId,
      name: set.name,
      action: dryRun ? `dry_run:${decision.action}` : decision.action,
      reason: decision.reason,
      success,
    });
    if (success && !dryRun) applied += 1;
  }

  return {
    armed,
    dryRun,
    considered,
    applied,
    skipped,
    actions,
  };
}

function decideForAdSet(
  set: HierarchyAdSet
): { action: "pause" | "budget_increase"; reason: string } | null {
  const m = set.metrics;
  if (m.score === "bad" && set.status === "active") {
    return {
      action: "pause",
      reason: `Kötü performans: harcama ${m.spend.toFixed(0)} TL, mesaj ${m.messages}, mesaj maliyeti yüksek veya mesaj yok.`,
    };
  }
  if (
    m.score === "good" &&
    set.status === "active" &&
    set.dailyBudget != null &&
    set.dailyBudget > 0 &&
    m.messages >= 2
  ) {
    return {
      action: "budget_increase",
      reason: `İyi performans: mesaj maliyeti uygun (CTR ${m.ctr?.toFixed(2) ?? "—"}). Bütçe +%${budgetDeltaPct()}.`,
    };
  }
  return null;
}

export async function listRecentAdActionLogs(
  supabase: TypedSupabaseClient,
  limit = 20
) {
  const { data, error } = await supabase
    .from("ad_action_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
