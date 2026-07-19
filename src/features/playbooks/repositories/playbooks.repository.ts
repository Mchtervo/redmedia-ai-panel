import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { normalizeKey } from "@/features/sales-learning/repositories/sales-learning.repository";
import type {
  AiPlaybookRow,
  PlaybookCategory,
  PlaybookStatus,
} from "@/features/playbooks/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type InsertPlaybookDraftParams = {
  category: PlaybookCategory;
  title: string;
  triggerContext: string;
  steps: string[];
  decisionRules: string[];
  expectedOutcome: string | null;
  confidence: number;
  sourceConversationIds: string[];
  sourceNote: string | null;
};

/**
 * Playbook taslağı ekler. Aynı başlık (normalize anahtar) zaten varsa yeni
 * kayıt açmaz, mevcut kaydı döner (duplicate önleme — docs/27 Versioning).
 */
export async function insertPlaybookDraftIfNew(
  supabase: TypedSupabaseClient,
  params: InsertPlaybookDraftParams
): Promise<{ playbook: AiPlaybookRow; created: boolean }> {
  const titleKey = normalizeKey(params.title);

  const { data: existing, error: findError } = await supabase
    .from("ai_playbooks")
    .select("*")
    .eq("category", params.category)
    .eq("title_key", titleKey)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) {
    return { playbook: existing, created: false };
  }

  const { data, error } = await supabase
    .from("ai_playbooks")
    .insert({
      category: params.category,
      title: params.title.trim(),
      title_key: titleKey,
      trigger_context: params.triggerContext.trim(),
      steps: params.steps,
      decision_rules: params.decisionRules,
      expected_outcome: params.expectedOutcome,
      confidence: Math.max(0, Math.min(100, params.confidence)),
      source_conversation_ids: params.sourceConversationIds.slice(0, 50),
      source_note: params.sourceNote,
      created_by: "ai",
      status: "draft",
    })
    .select("*")
    .single();

  if (error) throw error;
  return { playbook: data, created: true };
}

/** Aktif playbook'lar — asistan bağlamına eklenir. */
export async function listActivePlaybooks(
  supabase: TypedSupabaseClient,
  limit = 5
): Promise<AiPlaybookRow[]> {
  const { data, error } = await supabase
    .from("ai_playbooks")
    .select("*")
    .eq("status", "active")
    .order("confidence", { ascending: false })
    .order("usage_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Panel listesi: tüm durumlar, en yeni önce. */
export async function listPlaybooks(
  supabase: TypedSupabaseClient,
  limit = 30
): Promise<AiPlaybookRow[]> {
  const { data, error } = await supabase
    .from("ai_playbooks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Durum değişikliği (insan onayı: draft/review → active, active → archived). */
export async function updatePlaybookStatus(
  supabase: TypedSupabaseClient,
  playbookId: string,
  status: PlaybookStatus
): Promise<void> {
  const { error } = await supabase
    .from("ai_playbooks")
    .update({ status })
    .eq("id", playbookId);
  if (error) throw error;
}
