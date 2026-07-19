import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;

export type KnowledgeCandidateStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "archived"
  | "test_mode";

export async function listKnowledgeCandidates(
  supabase: TypedSupabaseClient,
  status?: KnowledgeCandidateStatus
) {
  let q = supabase
    .from("knowledge_candidates")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function insertKnowledgeCandidate(
  supabase: TypedSupabaseClient,
  input: {
    title: string;
    category: string;
    proposedRule: string;
    evidenceSummary?: string | null;
    sourceConversationIds?: string[];
    confidenceScore?: number;
    evidenceCount?: number;
    sourceCount?: number;
    expectedImpact?: string | null;
    metadata?: Json;
  }
) {
  const { data, error } = await supabase
    .from("knowledge_candidates")
    .insert({
      title: input.title,
      category: input.category,
      proposed_rule: input.proposedRule,
      evidence_summary: input.evidenceSummary ?? null,
      source_conversation_ids: input.sourceConversationIds ?? [],
      confidence_score: input.confidenceScore ?? 0.5,
      evidence_count: input.evidenceCount ?? 1,
      source_count: input.sourceCount ?? 1,
      expected_impact: input.expectedImpact ?? null,
      status: "pending_review",
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function reviewKnowledgeCandidate(
  supabase: TypedSupabaseClient,
  input: {
    id: string;
    action: "approve" | "reject" | "archive" | "test_mode" | "edit_approve";
    reviewedBy: string | null;
    title?: string;
    proposedRule?: string;
    reviewNotes?: string | null;
  }
) {
  const statusMap = {
    approve: "approved",
    reject: "rejected",
    archive: "archived",
    test_mode: "test_mode",
    edit_approve: "approved",
  } as const;

  const patch: Database["public"]["Tables"]["knowledge_candidates"]["Update"] = {
    status: statusMap[input.action],
    reviewed_by: input.reviewedBy,
    reviewed_at: new Date().toISOString(),
    review_notes: input.reviewNotes ?? null,
    last_validated_at: new Date().toISOString(),
  };
  if (input.title) patch.title = input.title;
  if (input.proposedRule) patch.proposed_rule = input.proposedRule;
  if (input.action === "approve" || input.action === "edit_approve") {
    patch.active = true;
    patch.valid_from = new Date().toISOString();
  }
  if (input.action === "reject" || input.action === "archive") {
    patch.active = false;
  }

  const { data: candidate, error } = await supabase
    .from("knowledge_candidates")
    .update(patch)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) throw error;

  if (input.action === "approve" || input.action === "edit_approve") {
    // Approved business knowledge + sales learning
    const { data: doc, error: docError } = await supabase
      .from("knowledge_documents")
      .insert({
        title: candidate.title,
        content: candidate.proposed_rule,
        category: candidate.category,
        review_status: "approved",
        is_active: true,
        reviewed_by: input.reviewedBy,
        reviewed_at: new Date().toISOString(),
        source_type: "manual",
      })
      .select("id")
      .single();
    if (!docError && doc) {
      await supabase
        .from("knowledge_candidates")
        .update({ knowledge_document_id: doc.id })
        .eq("id", candidate.id);
    }

    await supabase.from("sales_learnings").insert({
      title: candidate.title,
      learning_type: candidate.category,
      content: candidate.proposed_rule,
      confidence_score: candidate.confidence_score,
      evidence_count: candidate.evidence_count,
      source_count: candidate.source_count,
      knowledge_candidate_id: candidate.id,
      active: true,
    });
  }

  return candidate;
}

export async function listActiveSalesLearnings(
  supabase: TypedSupabaseClient,
  limit = 8
) {
  const { data, error } = await supabase
    .from("sales_learnings")
    .select("*")
    .eq("active", true)
    .order("last_observed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function insertAdminAiCorrection(
  supabase: TypedSupabaseClient,
  input: {
    conversationId?: string | null;
    contactId?: string | null;
    aiMessageId?: string | null;
    staffMessageId?: string | null;
    aiText: string;
    staffText: string;
    reason?: string | null;
    customerType?: string | null;
    actorId?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("admin_ai_corrections")
    .insert({
      conversation_id: input.conversationId ?? null,
      contact_id: input.contactId ?? null,
      ai_message_id: input.aiMessageId ?? null,
      staff_message_id: input.staffMessageId ?? null,
      ai_text: input.aiText,
      staff_text: input.staffText,
      reason: input.reason ?? null,
      customer_type: input.customerType ?? null,
      actor_id: input.actorId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Aynı düzeltme kalıbı 3+ kez tekrarlanırsa öğrenme adayı üret
  const { count } = await supabase
    .from("admin_ai_corrections")
    .select("id", { count: "exact", head: true })
    .ilike("staff_text", `%${input.staffText.slice(0, 40)}%`);

  if ((count ?? 0) >= 3) {
    await insertKnowledgeCandidate(supabase, {
      title: "Admin düzeltme kalıbı",
      category: "admin_correction",
      proposedRule: `AI şu tarz cevapları vermesin / şu şekilde düzeltilsin: ${input.staffText.slice(0, 500)}`,
      evidenceSummary: `Benzer admin düzeltmesi ${count} kez gözlemlendi.`,
      confidenceScore: Math.min(0.9, 0.4 + (count ?? 0) * 0.1),
      evidenceCount: count ?? 3,
      sourceCount: count ?? 3,
      expectedImpact: "Admin müdahale oranını düşürebilir",
      sourceConversationIds: input.conversationId
        ? [input.conversationId]
        : [],
    });
  }

  return data;
}

export async function recordConversationOutcome(
  supabase: TypedSupabaseClient,
  input: {
    conversationId: string;
    contactId?: string | null;
    outcome: Database["public"]["Tables"]["conversation_outcomes"]["Row"]["outcome"];
    notes?: string | null;
    metadata?: Json;
  }
) {
  const { data, error } = await supabase
    .from("conversation_outcomes")
    .upsert(
      {
        conversation_id: input.conversationId,
        contact_id: input.contactId ?? null,
        outcome: input.outcome,
        notes: input.notes ?? null,
        metadata: input.metadata ?? {},
        recorded_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id,outcome" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function buildAiBrainDashboard(
  supabase: TypedSupabaseClient
) {
  const [
    pending,
    corrections,
    learnings,
    outcomes,
  ] = await Promise.all([
    listKnowledgeCandidates(supabase, "pending_review"),
    supabase
      .from("admin_ai_corrections")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    listActiveSalesLearnings(supabase, 15),
    supabase.from("conversation_outcomes").select("outcome"),
  ]);

  const outcomeRows = outcomes.data ?? [];
  const outcomeCounts: Record<string, number> = {};
  for (const row of outcomeRows) {
    outcomeCounts[row.outcome] = (outcomeCounts[row.outcome] ?? 0) + 1;
  }

  const total = outcomeRows.length || 1;
  const sales = outcomeCounts.sale ?? 0;

  return {
    pendingCandidates: pending,
    recentCorrections: corrections.data ?? [],
    salesLearnings: learnings,
    report: {
      totalOutcomes: outcomeRows.length,
      sales,
      conversionRate: Math.round((sales / total) * 1000) / 10,
      depositRequested: outcomeCounts.deposit_requested ?? 0,
      depositSent: outcomeCounts.deposit_sent ?? 0,
      abandoned: outcomeCounts.customer_abandoned ?? 0,
      adminTookOver: outcomeCounts.admin_took_over ?? 0,
      adminCorrected: outcomeCounts.admin_corrected_ai ?? 0,
      pendingLearningCount: pending.length,
    },
  };
}
