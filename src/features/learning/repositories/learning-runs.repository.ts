import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type {
  LearningRunRow,
  LearningTriggerSource,
} from "@/features/learning/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export async function createLearningRun(
  supabase: TypedSupabaseClient,
  triggerSource: LearningTriggerSource
): Promise<LearningRunRow> {
  const { data, error } = await supabase
    .from("conversation_learning_runs")
    .insert({
      trigger_source: triggerSource,
      status: "running",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export type FinishLearningRunParams = {
  id: string;
  status: LearningRunRow["status"];
  conversationsScanned: number;
  conversationsAnalyzed: number;
  knowledgeProposed: number;
  errorMessage?: string | null;
  details?: Json | null;
};

export async function listRecentLearningRuns(
  supabase: TypedSupabaseClient,
  limit = 10
): Promise<LearningRunRow[]> {
  const { data, error } = await supabase
    .from("conversation_learning_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function finishLearningRun(
  supabase: TypedSupabaseClient,
  params: FinishLearningRunParams
): Promise<LearningRunRow> {
  const { data, error } = await supabase
    .from("conversation_learning_runs")
    .update({
      status: params.status,
      conversations_scanned: params.conversationsScanned,
      conversations_analyzed: params.conversationsAnalyzed,
      knowledge_proposed: params.knowledgeProposed,
      error_message: params.errorMessage ?? null,
      details: params.details ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
