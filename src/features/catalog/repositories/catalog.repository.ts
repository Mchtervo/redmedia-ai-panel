import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;

export async function listActiveServiceCategories(
  supabase: TypedSupabaseClient
) {
  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listActiveServices(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listServicesByIds(
  supabase: TypedSupabaseClient,
  ids: string[]
) {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function listActiveCampaigns(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("service_campaigns")
    .select("*")
    .eq("active", true)
    .order("priority", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listAllServicesAdmin(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateServicePrice(
  supabase: TypedSupabaseClient,
  id: string,
  basePrice: number
) {
  const { data, error } = await supabase
    .from("services")
    .update({ base_price: basePrice })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listCampaignsAdmin(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("service_campaigns")
    .select("*")
    .order("priority", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateCampaignActive(
  supabase: TypedSupabaseClient,
  id: string,
  active: boolean
) {
  const { data, error } = await supabase
    .from("service_campaigns")
    .update({ active })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
