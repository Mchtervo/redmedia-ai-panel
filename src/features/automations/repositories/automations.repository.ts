import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type {
  AutomationRuleRow,
  AutomationRunRow,
  AutomationTrigger,
} from "@/features/automations/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export async function listEnabledRulesForTrigger(
  supabase: TypedSupabaseClient,
  trigger: AutomationTrigger
): Promise<AutomationRuleRow[]> {
  const { data, error } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("trigger_type", trigger)
    .eq("is_enabled", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listAutomationRules(
  supabase: TypedSupabaseClient,
  limit = 50
): Promise<AutomationRuleRow[]> {
  const { data, error } = await supabase
    .from("automation_rules")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export type InsertAutomationRuleParams = {
  name: string;
  description?: string | null;
  triggerType: AutomationTrigger;
  conditions: Json;
  actions: Json;
  createdBy?: string | null;
};

export async function insertAutomationRule(
  supabase: TypedSupabaseClient,
  params: InsertAutomationRuleParams
): Promise<AutomationRuleRow> {
  const { data, error } = await supabase
    .from("automation_rules")
    .insert({
      name: params.name.trim(),
      description: params.description?.trim() || null,
      trigger_type: params.triggerType,
      conditions: params.conditions,
      actions: params.actions,
      created_by: params.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function setAutomationRuleEnabled(
  supabase: TypedSupabaseClient,
  ruleId: string,
  isEnabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from("automation_rules")
    .update({ is_enabled: isEnabled })
    .eq("id", ruleId);
  if (error) throw error;
}

export async function deleteAutomationRule(
  supabase: TypedSupabaseClient,
  ruleId: string
): Promise<void> {
  const { error } = await supabase
    .from("automation_rules")
    .delete()
    .eq("id", ruleId);
  if (error) throw error;
}

export type InsertAutomationRunParams = {
  ruleId: string;
  triggerType: AutomationTrigger;
  status: AutomationRunRow["status"];
  detail?: string | null;
  context?: Json;
};

export async function insertAutomationRun(
  supabase: TypedSupabaseClient,
  params: InsertAutomationRunParams
): Promise<void> {
  const { error } = await supabase.from("automation_runs").insert({
    rule_id: params.ruleId,
    trigger_type: params.triggerType,
    status: params.status,
    detail: params.detail ?? null,
    context: params.context ?? {},
  });
  if (error) throw error;
}

export async function markRuleExecuted(
  supabase: TypedSupabaseClient,
  rule: AutomationRuleRow
): Promise<void> {
  const { error } = await supabase
    .from("automation_rules")
    .update({
      run_count: rule.run_count + 1,
      last_run_at: new Date().toISOString(),
    })
    .eq("id", rule.id);
  if (error) throw error;
}

export async function listRecentAutomationRuns(
  supabase: TypedSupabaseClient,
  limit = 30
): Promise<AutomationRunRow[]> {
  const { data, error } = await supabase
    .from("automation_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
