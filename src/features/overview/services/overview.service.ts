import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getTodayIsoInIstanbul } from "@/features/ai/prompts/simple-assistant";
import {
  addDaysIso,
  istanbulDayStart,
} from "@/features/ceo-intelligence/utils/time";
import { estimateCostUsd } from "@/lib/ai/model-router";
import {
  CONFIGURED_ROUTE_ROWS,
  labelAiTask,
} from "@/features/overview/services/ai-usage-labels";

type TypedSupabaseClient = SupabaseClient<Database>;

export type DailyPoint = { date: string; value: number };
export type DailyRevenuePoint = { date: string; revenue: number; count: number };

export type ModelUsageRow = {
  model: string;
  runs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  lastRunAt: string | null;
  tasks: Array<{ taskType: string; label: string; runs: number }>;
};

export type AiTaskUsageRow = {
  taskType: string;
  label: string;
  runs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  lastRunAt: string | null;
  models: string[];
};

export type AiRecentRun = {
  id: string;
  taskType: string;
  taskLabel: string;
  model: string;
  status: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number | null;
  createdAt: string;
};

export type ConfiguredRouteRow = {
  tier: string;
  envKey: string;
  model: string;
  jobs: string;
};

export type ActivityEvent = {
  id: string;
  title: string;
  body: string | null;
  eventType: string;
  actorType: "system" | "ai" | "staff" | "customer";
  contactId: string;
  occurredAt: string;
};

export type AutomationHealth = {
  totalRules: number;
  enabledRules: number;
  runsLast7Days: number;
  completed: number;
  skipped: number;
  failed: number;
};

export type FunnelCounts = {
  newProfiles: number;
  reservationsCreated: number;
  depositsVerified: number;
  completed: number;
};

export type AiUsageSummary = {
  runsLast7Days: number;
  failedLast7Days: number;
  needsApprovalLast7Days: number;
  totalCostUsd: number;
  lastRunAt: string | null;
  models: ModelUsageRow[];
  tasks: AiTaskUsageRow[];
  recentRuns: AiRecentRun[];
  configuredRoutes: ConfiguredRouteRow[];
};

export type OverviewData = {
  rangeStart: string;
  rangeEnd: string;
  revenueTrend: DailyRevenuePoint[];
  newLeadsTrend: DailyPoint[];
  reservationTrend: DailyPoint[];
  funnel: FunnelCounts;
  automationHealth: AutomationHealth;
  aiUsage: AiUsageSummary;
  recentActivity: ActivityEvent[];
};

const TREND_DAYS = 30;

function buildDayBuckets(endIso: string, days: number): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    result.push(addDaysIso(endIso, -i));
  }
  return result;
}

function isoDayOf(timestamp: string): string {
  // İstanbul günü: timestamp'ı +03:00'a kaydırıp tarih kısmını al.
  const date = new Date(timestamp);
  const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Ana dashboard genel bakış verisi. Tümü gerçek tablolardan okunur; veri
 * yoksa boş seriler döner ve UI boş durum gösterir. Yazma yapmaz.
 */
export async function buildOverview(
  supabase: TypedSupabaseClient
): Promise<OverviewData> {
  const today = getTodayIsoInIstanbul();
  const rangeStartIso = addDaysIso(today, -(TREND_DAYS - 1));
  const rangeStartTs = istanbulDayStart(rangeStartIso).toISOString();
  const sevenDaysAgoTs = istanbulDayStart(addDaysIso(today, -6)).toISOString();
  const buckets = buildDayBuckets(today, TREND_DAYS);

  const [
    reservationsRes,
    profilesRes,
    aiRunsRes,
    rulesRes,
    automationRunsRes,
    activityRes,
    completedRes,
  ] = await Promise.all([
    supabase
      .from("reservations")
      .select("created_at, total_price, deposit_status, deposit_verified_at, status")
      .gte("created_at", rangeStartTs)
      .limit(2000),
    supabase
      .from("customer_profiles")
      .select("first_seen")
      .gte("first_seen", rangeStartTs)
      .limit(4000),
    supabase
      .from("ai_runs")
      .select(
        "id, model, task_type, status, requires_human_approval, input_tokens, output_tokens, estimated_cost, created_at"
      )
      .gte("created_at", sevenDaysAgoTs)
      .order("created_at", { ascending: false })
      .limit(4000),
    supabase.from("automation_rules").select("id, is_enabled"),
    supabase
      .from("automation_runs")
      .select("status")
      .gte("created_at", sevenDaysAgoTs)
      .limit(2000),
    supabase
      .from("customer_timeline_events")
      .select(
        "id, title, body, event_type, actor_type, contact_id, occurred_at"
      )
      .order("occurred_at", { ascending: false })
      .limit(12),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", rangeStartTs)
      .in("status", ["completed", "shoot_completed"]),
  ]);

  const reservations = reservationsRes.data ?? [];
  const profiles = profilesRes.data ?? [];

  const revenueByDay = new Map<string, { revenue: number; count: number }>();
  const reservationsByDay = new Map<string, number>();
  let depositsVerified = 0;

  for (const r of reservations) {
    const day = isoDayOf(r.created_at);
    reservationsByDay.set(day, (reservationsByDay.get(day) ?? 0) + 1);
    const bucket = revenueByDay.get(day) ?? { revenue: 0, count: 0 };
    bucket.revenue += Number(r.total_price ?? 0);
    bucket.count += 1;
    revenueByDay.set(day, bucket);
    if (r.deposit_status === "verified") depositsVerified += 1;
  }

  const leadsByDay = new Map<string, number>();
  for (const p of profiles) {
    if (!p.first_seen) continue;
    const day = isoDayOf(p.first_seen);
    leadsByDay.set(day, (leadsByDay.get(day) ?? 0) + 1);
  }

  const aiRuns = aiRunsRes.data ?? [];
  const modelMap = new Map<
    string,
    ModelUsageRow & { taskCounts: Map<string, number> }
  >();
  const taskMap = new Map<
    string,
    AiTaskUsageRow & { modelSet: Set<string> }
  >();
  let failedRuns = 0;
  let approvalRuns = 0;
  let totalCostUsd = 0;
  let lastRunAt: string | null = null;

  for (const run of aiRuns) {
    if (run.status === "failed") failedRuns += 1;
    if (run.requires_human_approval) approvalRuns += 1;
    if (!lastRunAt || run.created_at > lastRunAt) {
      lastRunAt = run.created_at;
    }

    const input = run.input_tokens ?? 0;
    const output = run.output_tokens ?? 0;
    const storedCost = Number(run.estimated_cost ?? 0);
    const recomputed = estimateCostUsd(run.model, input, output);
    const cost = storedCost > 0 ? storedCost : (recomputed ?? 0);
    totalCostUsd += cost;

    const modelRow = modelMap.get(run.model) ?? {
      model: run.model,
      runs: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
      lastRunAt: null as string | null,
      tasks: [],
      taskCounts: new Map<string, number>(),
    };
    modelRow.runs += 1;
    modelRow.inputTokens += input;
    modelRow.outputTokens += output;
    modelRow.estimatedCost += cost;
    if (!modelRow.lastRunAt || run.created_at > modelRow.lastRunAt) {
      modelRow.lastRunAt = run.created_at;
    }
    modelRow.taskCounts.set(
      run.task_type,
      (modelRow.taskCounts.get(run.task_type) ?? 0) + 1
    );
    modelMap.set(run.model, modelRow);

    const taskRow = taskMap.get(run.task_type) ?? {
      taskType: run.task_type,
      label: labelAiTask(run.task_type),
      runs: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
      lastRunAt: null as string | null,
      models: [],
      modelSet: new Set<string>(),
    };
    taskRow.runs += 1;
    taskRow.inputTokens += input;
    taskRow.outputTokens += output;
    taskRow.estimatedCost += cost;
    taskRow.modelSet.add(run.model);
    if (!taskRow.lastRunAt || run.created_at > taskRow.lastRunAt) {
      taskRow.lastRunAt = run.created_at;
    }
    taskMap.set(run.task_type, taskRow);
  }

  const models: ModelUsageRow[] = [...modelMap.values()]
    .map(({ taskCounts, ...row }) => ({
      ...row,
      tasks: [...taskCounts.entries()]
        .map(([taskType, runs]) => ({
          taskType,
          label: labelAiTask(taskType),
          runs,
        }))
        .sort((a, b) => b.runs - a.runs),
    }))
    .sort((a, b) => b.runs - a.runs);

  const tasks: AiTaskUsageRow[] = [...taskMap.values()]
    .map(({ modelSet, ...row }) => ({
      ...row,
      models: [...modelSet],
    }))
    .sort((a, b) => b.runs - a.runs);

  const recentRuns: AiRecentRun[] = aiRuns.slice(0, 12).map((run) => {
    const input = run.input_tokens ?? 0;
    const output = run.output_tokens ?? 0;
    const storedCost = Number(run.estimated_cost ?? 0);
    const recomputed = estimateCostUsd(run.model, input, output);
    return {
      id: run.id,
      taskType: run.task_type,
      taskLabel: labelAiTask(run.task_type),
      model: run.model,
      status: run.status,
      inputTokens: input,
      outputTokens: output,
      estimatedCost: storedCost > 0 ? storedCost : recomputed,
      createdAt: run.created_at,
    };
  });

  const configuredRoutes: ConfiguredRouteRow[] = CONFIGURED_ROUTE_ROWS.map(
    (row) => ({
      tier: row.tier,
      envKey: row.envKey,
      model: process.env[row.envKey]?.trim() || "(boş → fallback)",
      jobs: row.jobs,
    })
  );

  const rules = rulesRes.data ?? [];
  const automationRuns = automationRunsRes.data ?? [];

  return {
    rangeStart: rangeStartIso,
    rangeEnd: today,
    revenueTrend: buckets.map((date) => ({
      date,
      revenue: revenueByDay.get(date)?.revenue ?? 0,
      count: revenueByDay.get(date)?.count ?? 0,
    })),
    newLeadsTrend: buckets.map((date) => ({
      date,
      value: leadsByDay.get(date) ?? 0,
    })),
    reservationTrend: buckets.map((date) => ({
      date,
      value: reservationsByDay.get(date) ?? 0,
    })),
    funnel: {
      newProfiles: profiles.length,
      reservationsCreated: reservations.length,
      depositsVerified,
      completed: completedRes.count ?? 0,
    },
    automationHealth: {
      totalRules: rules.length,
      enabledRules: rules.filter((r) => r.is_enabled).length,
      runsLast7Days: automationRuns.length,
      completed: automationRuns.filter((r) => r.status === "completed").length,
      skipped: automationRuns.filter((r) => r.status === "skipped").length,
      failed: automationRuns.filter((r) => r.status === "failed").length,
    },
    aiUsage: {
      runsLast7Days: aiRuns.length,
      failedLast7Days: failedRuns,
      needsApprovalLast7Days: approvalRuns,
      totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
      lastRunAt,
      models,
      tasks,
      recentRuns,
      configuredRoutes,
    },
    recentActivity: (activityRes.data ?? []).map((event) => ({
      id: event.id,
      title: event.title,
      body: event.body,
      eventType: event.event_type,
      actorType: event.actor_type,
      contactId: event.contact_id,
      occurredAt: event.occurred_at,
    })),
  };
}
