import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type {
  AiApprovalRow,
  ApprovalActionType,
  ApprovalStatus,
} from "@/features/approvals/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type CreateApprovalParams = {
  actionType: ApprovalActionType;
  title: string;
  payload?: Json;
  confidence?: number | null;
  conversationId?: string | null;
  contactId?: string | null;
  aiRunId?: string | null;
};

/** Onay talebi oluşturur (AI nihai kararı vermez; karar insana kalır). */
export async function createApprovalRequest(
  supabase: TypedSupabaseClient,
  params: CreateApprovalParams
): Promise<AiApprovalRow> {
  const { data, error } = await supabase
    .from("ai_approvals")
    .insert({
      action_type: params.actionType,
      title: params.title.trim().slice(0, 300),
      payload: params.payload ?? {},
      confidence: params.confidence ?? null,
      conversation_id: params.conversationId ?? null,
      contact_id: params.contactId ?? null,
      ai_run_id: params.aiRunId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Bekleyen onaylar (en yeni önce). */
export async function listApprovals(
  supabase: TypedSupabaseClient,
  options?: { status?: ApprovalStatus; limit?: number }
): Promise<AiApprovalRow[]> {
  let query = supabase
    .from("ai_approvals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function countPendingApprovals(
  supabase: TypedSupabaseClient
): Promise<number> {
  const { count, error } = await supabase
    .from("ai_approvals")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export type DecideApprovalParams = {
  approvalId: string;
  decision: "approved" | "rejected";
  decidedBy: string;
  note?: string | null;
};

/** Onay kararını kaydeder (docs/43 §12: karar veren + zaman + not loglanır). */
export async function decideApproval(
  supabase: TypedSupabaseClient,
  params: DecideApprovalParams
): Promise<void> {
  const { error } = await supabase
    .from("ai_approvals")
    .update({
      status: params.decision,
      decided_by: params.decidedBy,
      decided_at: new Date().toISOString(),
      decision_note: params.note?.trim() || null,
    })
    .eq("id", params.approvalId)
    .eq("status", "pending");
  if (error) throw error;
}
