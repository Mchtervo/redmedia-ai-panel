import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;

export type CreateExperimentInput = {
  title: string;
  experimentType:
    | "creative"
    | "audience"
    | "ad_copy"
    | "cta"
    | "placement";
  hypothesis: string;
  changedVariable: string;
  controlAdId?: string | null;
  testAdId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  budgetAmount?: number | null;
  primarySuccessMetric?:
    | "deposit"
    | "reservation"
    | "revenue"
    | "qualified_customer"
    | "message";
  minimumDataThreshold?: number;
  createdBy: string | null;
};

/** Tek değişken kuralı — birden fazla değişken stringinde virgül varsa reddet. */
export function assertSingleVariable(changedVariable: string): string | null {
  const parts = changedVariable
    .split(/[,+/&]| ve | and /i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    return "Aynı testte yalnızca bir ana değişken değiştirilebilir.";
  }
  return null;
}

export async function createExperiment(
  supabase: TypedSupabaseClient,
  input: CreateExperimentInput
) {
  const err = assertSingleVariable(input.changedVariable);
  if (err) throw new Error(err);

  const { data, error } = await supabase
    .from("marketing_experiments")
    .insert({
      title: input.title,
      experiment_type: input.experimentType,
      hypothesis: input.hypothesis,
      changed_variable: input.changedVariable.trim(),
      control_ad_id: input.controlAdId ?? null,
      test_ad_id: input.testAdId ?? null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      budget_amount: input.budgetAmount ?? null,
      primary_success_metric: input.primarySuccessMetric ?? "deposit",
      minimum_data_threshold: input.minimumDataThreshold ?? 10,
      status: "draft",
      confidence_level: null,
      rationale: null,
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function listExperiments(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("marketing_experiments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}
