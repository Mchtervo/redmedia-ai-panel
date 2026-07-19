import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;

export async function startSyncLog(
  supabase: TypedSupabaseClient,
  syncType: Database["public"]["Tables"]["marketing_sync_logs"]["Insert"]["sync_type"],
  apiEndpointKind: string
): Promise<string> {
  const { data, error } = await supabase
    .from("marketing_sync_logs")
    .insert({
      sync_type: syncType,
      api_endpoint_kind: apiEndpointKind,
      started_at: new Date().toISOString(),
      status: "started",
      records_fetched: 0,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function finishSyncLog(
  supabase: TypedSupabaseClient,
  logId: string,
  result: {
    status: "success" | "partial" | "failed" | "skipped";
    records: number;
    error?: string | null;
    metadata?: Json;
  }
): Promise<void> {
  await supabase
    .from("marketing_sync_logs")
    .update({
      finished_at: new Date().toISOString(),
      status: result.status,
      records_fetched: result.records,
      error_message: result.error ?? null,
      metadata: result.metadata ?? {},
    })
    .eq("id", logId);
}
