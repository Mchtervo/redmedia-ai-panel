import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;

export async function listPlateaus(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("plateaus")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listActivePlateaus(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("plateaus")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertPlateau(
  supabase: TypedSupabaseClient,
  input: {
    id?: string;
    name: string;
    description?: string | null;
    address?: string | null;
    city?: string;
    district?: string | null;
    active?: boolean;
    internalNotes?: string | null;
  }
) {
  if (input.id) {
    const { data, error } = await supabase
      .from("plateaus")
      .update({
        name: input.name,
        description: input.description ?? null,
        address: input.address ?? null,
        city: input.city ?? "Ankara",
        district: input.district ?? null,
        active: input.active ?? true,
        internal_notes: input.internalNotes ?? null,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("plateaus")
    .insert({
      name: input.name,
      description: input.description ?? null,
      address: input.address ?? null,
      city: input.city ?? "Ankara",
      district: input.district ?? null,
      active: input.active ?? true,
      internal_notes: input.internalNotes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
