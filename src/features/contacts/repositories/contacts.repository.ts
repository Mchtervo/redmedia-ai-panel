import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { buildOrIlikeFilter } from "@/lib/supabase/query-helpers";
import type { Contact, ContactStatus } from "@/features/contacts/types";

type TypedSupabaseClient = SupabaseClient<Database>;

const CONTACT_SELECT_WITH_LAST_MESSAGE = "*, conversations(last_message_at)";
const CONTACT_SEARCH_COLUMNS = ["full_name", "username", "phone"] as const;

export type ContactRowWithConversations = Contact & {
  conversations: { last_message_at: string | null }[] | null;
};

export type ListContactsRepositoryParams = {
  search?: string;
  status?: ContactStatus;
  page: number;
  pageSize: number;
};

export type ListContactsRepositoryResult = {
  rows: ContactRowWithConversations[];
  count: number;
};

/**
 * `contacts` tablosunu arama/durum filtresi ve sayfalama ile listeler.
 * "Son mesaj tarihi" için ilişkili `conversations.last_message_at`
 * PostgREST embed'i ile tek sorguda alınır; en güncel değere indirgeme
 * servis katmanında yapılır (bkz. `contacts.service.ts`).
 */
export async function listContacts(
  supabase: TypedSupabaseClient,
  { search, status, page, pageSize }: ListContactsRepositoryParams
): Promise<ListContactsRepositoryResult> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("contacts")
    .select(CONTACT_SELECT_WITH_LAST_MESSAGE, { count: "exact" });

  if (status) {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.or(buildOrIlikeFilter(CONTACT_SEARCH_COLUMNS, search));
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  return { rows: data ?? [], count: count ?? 0 };
}

export async function getContactById(
  supabase: TypedSupabaseClient,
  id: string
): Promise<ContactRowWithConversations | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select(CONTACT_SELECT_WITH_LAST_MESSAGE)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export type FindOrCreateContactParams = {
  instagramUserId: string;
  username?: string | null;
  fullName?: string | null;
};

/**
 * `contacts`'ı `instagram_user_id` ile bul; yoksa oluştur. Gelen webhook'lar
 * (ve development seed script'i) için tekrarlı contact satırı üretmeyen
 * tek giriş noktasıdır (bkz. docs/CHATPLACE.md — bul-veya-oluştur deseni).
 */
export async function findOrCreateContactByInstagramUserId(
  supabase: TypedSupabaseClient,
  { instagramUserId, username, fullName }: FindOrCreateContactParams
): Promise<Contact> {
  const { data: existing, error: findError } = await supabase
    .from("contacts")
    .select("*")
    .eq("instagram_user_id", instagramUserId)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from("contacts")
    .insert({
      instagram_user_id: instagramUserId,
      username: username ?? null,
      full_name: fullName ?? null,
    })
    .select("*")
    .single();

  if (createError) {
    throw createError;
  }

  return created;
}
