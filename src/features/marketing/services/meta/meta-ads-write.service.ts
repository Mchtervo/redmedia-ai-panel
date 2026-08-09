/**
 * Meta Ads Graph yazma — pause/activate + sınırlı daily_budget.
 * Token loglanmaz; her çağrı ad_action_logs'a yazılmalı (çağıran sorumlu).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import {
  graphPostJson,
  MetaGraphError,
} from "@/features/marketing/services/meta/graph-client";
import { resolveMetaAccessToken } from "@/features/marketing/services/meta/token.service";

type TypedSupabaseClient = SupabaseClient<Database>;

export type AdWriteAction =
  | "pause"
  | "activate"
  | "budget_increase"
  | "budget_decrease";

function maxBudgetDeltaPct(): number {
  const n = Number(
    process.env.META_ADS_AUTOPILOT_MAX_BUDGET_DELTA_PCT?.trim() || "20"
  );
  if (!Number.isFinite(n) || n <= 0 || n > 50) return 20;
  return n;
}

/** TRY major → Meta minor units (cents). */
export function tryToMetaCents(amountTry: number): number {
  return Math.max(100, Math.round(amountTry * 100));
}

export function metaCentsToTry(cents: number): number {
  return cents / 100;
}

export async function setMetaEntityStatus(params: {
  supabase: TypedSupabaseClient;
  metaEntityId: string;
  status: "ACTIVE" | "PAUSED";
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const resolved = await resolveMetaAccessToken(params.supabase);
  if (!resolved) {
    return { ok: false, code: "no_token", message: "Meta OAuth token yok." };
  }
  try {
    await graphPostJson<{ success?: boolean }>({
      accessToken: resolved.accessToken,
      path: params.metaEntityId,
      body: { status: params.status },
    });
    return { ok: true };
  } catch (e) {
    const msg =
      e instanceof MetaGraphError ? e.message : "Meta status güncellenemedi.";
    const code = e instanceof MetaGraphError ? e.code : "graph_error";
    return { ok: false, code, message: msg };
  }
}

/**
 * Ad set daily_budget güncelle — mevcut değere göre max ±delta%.
 * currentBudgetTry: paneldeki major TRY.
 */
export async function setMetaAdSetDailyBudget(params: {
  supabase: TypedSupabaseClient;
  metaAdSetId: string;
  currentBudgetTry: number;
  targetBudgetTry: number;
}): Promise<
  | { ok: true; appliedTry: number }
  | { ok: false; code: string; message: string }
> {
  const resolved = await resolveMetaAccessToken(params.supabase);
  if (!resolved) {
    return { ok: false, code: "no_token", message: "Meta OAuth token yok." };
  }

  const maxPct = maxBudgetDeltaPct();
  const current = Math.max(0, params.currentBudgetTry);
  if (current <= 0) {
    return {
      ok: false,
      code: "no_budget",
      message: "Mevcut günlük bütçe yok.",
    };
  }
  const maxUp = current * (1 + maxPct / 100);
  const maxDown = current * (1 - maxPct / 100);
  const clamped = Math.min(maxUp, Math.max(maxDown, params.targetBudgetTry));
  const cents = tryToMetaCents(clamped);

  try {
    await graphPostJson<{ success?: boolean }>({
      accessToken: resolved.accessToken,
      path: params.metaAdSetId,
      body: { daily_budget: String(cents) },
    });
    return { ok: true, appliedTry: metaCentsToTry(cents) };
  } catch (e) {
    const msg =
      e instanceof MetaGraphError ? e.message : "Meta bütçe güncellenemedi.";
    const code = e instanceof MetaGraphError ? e.code : "graph_error";
    return { ok: false, code, message: msg };
  }
}

export async function insertAdActionLog(
  supabase: TypedSupabaseClient,
  row: Database["public"]["Tables"]["ad_action_logs"]["Insert"]
): Promise<void> {
  const { error } = await supabase.from("ad_action_logs").insert(row);
  if (error) {
    console.error("[ad-action-log]", error.message);
  }
}

export function budgetActionPayload(
  beforeTry: number,
  afterTry: number
): { before: Json; after: Json } {
  return {
    before: { daily_budget_try: beforeTry },
    after: { daily_budget_try: afterTry },
  };
}
