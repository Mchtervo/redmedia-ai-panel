import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;

export type UpsertConversationSummaryFromLearningParams = {
  conversationId: string;
  summary?: string | null;
  customerNeeds?: string | null;
  objections?: string | null;
  budget?: string | null;
  nextAction?: string | null;
  leadScore?: number | null;
  saleProbability?: number | null;
  customerIntent?: string | null;
  leadTemperature?: "cold" | "warm" | "hot" | null;
  lossReason?: string | null;
  saleOutcome?: "won" | "lost" | "open" | "unknown" | null;
};

export async function upsertConversationSummaryFromLearning(
  supabase: TypedSupabaseClient,
  params: UpsertConversationSummaryFromLearningParams
): Promise<void> {
  const { error } = await supabase.from("conversation_summaries").upsert(
    {
      conversation_id: params.conversationId,
      summary: params.summary ?? null,
      customer_needs: params.customerNeeds ?? null,
      objections: params.objections ?? null,
      budget: params.budget ?? null,
      next_action: params.nextAction ?? null,
      lead_score: params.leadScore ?? null,
      sale_probability: params.saleProbability ?? null,
      customer_intent: params.customerIntent ?? null,
      lead_temperature: params.leadTemperature ?? null,
      loss_reason: params.lossReason ?? null,
      sale_outcome: params.saleOutcome ?? null,
    },
    { onConflict: "conversation_id" }
  );

  if (error) {
    throw error;
  }
}

export async function getConversationSummary(
  supabase: TypedSupabaseClient,
  conversationId: string
) {
  const { data, error } = await supabase
    .from("conversation_summaries")
    .select("*")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
