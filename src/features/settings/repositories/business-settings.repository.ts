import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;

export type BusinessSettingsRow =
  Database["public"]["Tables"]["business_settings"]["Row"];

/**
 * Tek satırlık işletme ayarı. Yoksa oluşturur (Redmedia varsayılanı).
 */
export async function getOrCreateBusinessSettings(
  supabase: TypedSupabaseClient
): Promise<BusinessSettingsRow> {
  const { data: existing, error: readError } = await supabase
    .from("business_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from("business_settings")
    .insert({
      business_name: "Redmedia",
      timezone: "Europe/Istanbul",
      default_currency: "TRY",
      settings: {},
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return created;
}

export async function updateBusinessSettingsJson(
  supabase: TypedSupabaseClient,
  settingsId: string,
  settings: Json
): Promise<BusinessSettingsRow> {
  const { data, error } = await supabase
    .from("business_settings")
    .update({
      settings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", settingsId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
