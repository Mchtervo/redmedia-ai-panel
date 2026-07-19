import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { SourceType, AttributionStatus } from "@/features/marketing/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type CustomerAttributionRow = Database["public"]["Tables"]["customer_attributions"]["Row"];

export async function getAttributionByContactId(
  supabase: TypedSupabaseClient,
  contactId: string
): Promise<CustomerAttributionRow | null> {
  const { data, error } = await supabase
    .from("customer_attributions")
    .select("*")
    .eq("contact_id", contactId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listAttributions(
  supabase: TypedSupabaseClient,
  limit = 100
) {
  const { data, error } = await supabase
    .from("customer_attributions")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export type ManualAttributionInput = {
  contactId: string;
  sourceType: SourceType;
  attributionStatus?: AttributionStatus;
  notes?: string;
  actorId: string | null;
  reason?: string;
};

/**
 * Manuel kaynak ataması. probable'ı exact yapmaz.
 * AI çağrısı yok; audit log yazar.
 */
export async function setManualAttribution(
  supabase: TypedSupabaseClient,
  input: ManualAttributionInput
): Promise<CustomerAttributionRow> {
  const existing = await getAttributionByContactId(supabase, input.contactId);
  const after = {
    contact_id: input.contactId,
    source_type: input.sourceType,
    attribution_status: (input.attributionStatus ?? "manual") as AttributionStatus,
    attribution_method: "manual_staff",
    attribution_confidence: 100,
    notes: input.notes ?? null,
    updated_by: input.actorId,
    last_touch_at: new Date().toISOString(),
    first_touch_at: existing?.first_touch_at ?? new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("customer_attributions")
    .upsert(after, { onConflict: "contact_id" })
    .select("*")
    .single();

  if (error) throw error;

  await supabase.from("attribution_audit_logs").insert({
    contact_id: input.contactId,
    attribution_id: data.id,
    actor_id: input.actorId,
    before_data: (existing ?? null) as unknown as Json,
    after_data: data as unknown as Json,
    reason: input.reason ?? "Manuel kaynak güncellemesi",
  });

  return data;
}

export async function getAttributionSummary(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("customer_attributions")
    .select("attribution_status, source_type");
  if (error) throw error;

  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const row of data ?? []) {
    byStatus[row.attribution_status] =
      (byStatus[row.attribution_status] ?? 0) + 1;
    bySource[row.source_type] = (bySource[row.source_type] ?? 0) + 1;
  }
  return { byStatus, bySource, total: data?.length ?? 0 };
}
