import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { AiRun } from "@/features/conversations/types";
import { estimateCostUsd } from "@/lib/ai/model-router";

type TypedSupabaseClient = SupabaseClient<Database>;

export type InsertAiRunParams = {
  taskType: string;
  conversationId: string | null;
  contactId: string | null;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  result?: Json | null;
  status: AiRun["status"];
  requiresHumanApproval?: boolean;
};

export async function insertAiRun(
  supabase: TypedSupabaseClient,
  params: InsertAiRunParams
): Promise<AiRun> {
  const { data, error } = await supabase
    .from("ai_runs")
    .insert({
      task_type: params.taskType,
      conversation_id: params.conversationId,
      contact_id: params.contactId,
      model: params.model,
      input_tokens: params.inputTokens ?? null,
      output_tokens: params.outputTokens ?? null,
      // Maliyet tek noktada hesaplanır (docs/41 Cost Estimation).
      estimated_cost: estimateCostUsd(
        params.model,
        params.inputTokens,
        params.outputTokens
      ),
      result: params.result ?? null,
      status: params.status,
      requires_human_approval: params.requiresHumanApproval ?? false,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
