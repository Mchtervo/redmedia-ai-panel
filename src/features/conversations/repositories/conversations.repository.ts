import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { buildOrIlikeFilter, escapeIlikePattern } from "@/lib/supabase/query-helpers";
import type {
  AiRun,
  Conversation,
  ConversationStatus,
  ConversationWithRelations,
} from "@/features/conversations/types";

type TypedSupabaseClient = SupabaseClient<Database>;

const CONVERSATION_SELECT_WITH_RELATIONS =
  "*, contact:contacts(id, full_name, username, phone, status), assignee:profiles(id, email, full_name)";

const CONTACT_SEARCH_COLUMNS = ["full_name", "username", "phone"] as const;

export type ListConversationsRepositoryParams = {
  search?: string;
  status?: ConversationStatus;
  page: number;
  pageSize: number;
};

export type ListConversationsRepositoryResult = {
  rows: ConversationWithRelations[];
  count: number;
};

/**
 * Arama terimiyle eşleşen konuşma id'lerini toplar: müşteri adı/kullanıcı
 * adı/telefon (contacts üzerinden) VEYA mesaj içeriği (messages üzerinden).
 * PostgREST tek sorguda ana tablo + embed'lenmiş tablo arasında OR
 * desteklemediği için iki güvenli (parametreli ilike) sorgu birleştirilir.
 */
async function findConversationIdsMatchingSearch(
  supabase: TypedSupabaseClient,
  term: string
): Promise<string[]> {
  const [contactsResult, messagesResult] = await Promise.all([
    supabase
      .from("contacts")
      .select("id")
      .or(buildOrIlikeFilter(CONTACT_SEARCH_COLUMNS, term)),
    supabase
      .from("messages")
      .select("conversation_id")
      .ilike("content", `%${escapeIlikePattern(term)}%`),
  ]);

  if (contactsResult.error) {
    throw contactsResult.error;
  }
  if (messagesResult.error) {
    throw messagesResult.error;
  }

  const matchedContactIds = (contactsResult.data ?? []).map((row) => row.id);
  let conversationIdsFromContacts: string[] = [];

  if (matchedContactIds.length > 0) {
    const { data, error } = await supabase
      .from("conversations")
      .select("id")
      .in("contact_id", matchedContactIds);

    if (error) {
      throw error;
    }
    conversationIdsFromContacts = (data ?? []).map((row) => row.id);
  }

  const conversationIdsFromMessages = (messagesResult.data ?? []).map(
    (row) => row.conversation_id
  );

  return Array.from(
    new Set([...conversationIdsFromContacts, ...conversationIdsFromMessages])
  );
}

/**
 * `conversations`'ı arama/durum filtresi ve sayfalama ile listeler.
 * İlişkili `contact` ve `assignee` (personel) tek sorguda embed edilir.
 */
export async function listConversations(
  supabase: TypedSupabaseClient,
  { search, status, page, pageSize }: ListConversationsRepositoryParams
): Promise<ListConversationsRepositoryResult> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("conversations")
    .select(CONVERSATION_SELECT_WITH_RELATIONS, { count: "exact" });

  if (status) {
    query = query.eq("status", status);
  }

  if (search) {
    const matchingIds = await findConversationIdsMatchingSearch(supabase, search);
    if (matchingIds.length === 0) {
      return { rows: [], count: 0 };
    }
    query = query.in("id", matchingIds);
  }

  const { data, error, count } = await query
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  return { rows: (data ?? []) as unknown as ConversationWithRelations[], count: count ?? 0 };
}

export async function getConversationById(
  supabase: TypedSupabaseClient,
  id: string
): Promise<ConversationWithRelations | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT_WITH_RELATIONS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as ConversationWithRelations | null;
}

/** Kanal + dış id ile mevcut konuşmayı arar (senkronizasyon ön kontrolü). */
export async function findConversationByExternalId(
  supabase: TypedSupabaseClient,
  channel: Conversation["channel"],
  externalConversationId: string
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("channel", channel)
    .eq("external_conversation_id", externalConversationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export type FindOrCreateConversationParams = {
  contactId: string;
  channel: Conversation["channel"];
  externalConversationId: string;
  initialStatus?: ConversationStatus;
};

/**
 * `conversations`'ı `channel` + `external_conversation_id` ile bul; yoksa
 * aynı contact+channel konuşmasını yeniden kullan; yoksa oluştur.
 *
 * ChatPlace webhook sıkça `clientId`, MCP ise `chat.id` gönderir — ikisi
 * farklı external id üretip mesajları ikiye bölerdi.
 */
export async function findOrCreateConversation(
  supabase: TypedSupabaseClient,
  { contactId, channel, externalConversationId, initialStatus = "open" }: FindOrCreateConversationParams
): Promise<Conversation> {
  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("*")
    .eq("channel", channel)
    .eq("external_conversation_id", externalConversationId)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existing) {
    return existing;
  }

  const { data: byContact, error: byContactError } = await supabase
    .from("conversations")
    .select("*")
    .eq("contact_id", contactId)
    .eq("channel", channel)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (byContactError) {
    throw byContactError;
  }

  if (byContact) {
    return byContact;
  }

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({
      contact_id: contactId,
      channel,
      external_conversation_id: externalConversationId,
      status: initialStatus,
    })
    .select("*")
    .single();

  if (createError) {
    throw createError;
  }

  return created;
}

export async function updateConversationStatus(
  supabase: TypedSupabaseClient,
  id: string,
  status: ConversationStatus
): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/** `userId` null verilirse atama kaldırılır. */
export async function assignConversation(
  supabase: TypedSupabaseClient,
  id: string,
  userId: string | null
): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .update({ assigned_to: userId })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * `last_message_at`'i günceller — ancak yalnızca yeni zaman damgası
 * mevcuttan daha güncelse (geriye alma koruması, bkz. docs/CHATPLACE.md
 * "Kronoloji"). Not: Bu bir oku-sonra-yaz desenidir; PostgREST tek
 * başına atomik `GREATEST` ifadesi desteklemez. Bu panelin yazma hacminde
 * (tek personel + seed script) kabul edilebilir bir sınırlamadır.
 */
export async function touchLastMessageAt(
  supabase: TypedSupabaseClient,
  id: string,
  messageTimestamp: string
): Promise<void> {
  const { data: current, error: readError } = await supabase
    .from("conversations")
    .select("last_message_at")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (current?.last_message_at && current.last_message_at >= messageTimestamp) {
    return;
  }

  const { error: updateError } = await supabase
    .from("conversations")
    .update({ last_message_at: messageTimestamp })
    .eq("id", id);

  if (updateError) {
    throw updateError;
  }
}

/** Satış Beyni snapshot — konuşma bazlı kalıcı state. */
export async function getConversationSalesBrainState(
  supabase: TypedSupabaseClient,
  conversationId: string
): Promise<Json | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("sales_brain_state")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.sales_brain_state ?? null;
}

export async function saveConversationSalesBrainState(
  supabase: TypedSupabaseClient,
  conversationId: string,
  state: Json
): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .update({ sales_brain_state: state })
    .eq("id", conversationId);

  if (error) {
    throw error;
  }
}

/**
 * `ai_runs`'ı salt-okuma döner. OpenAI henüz bağlanmadığı için bu her
 * zaman boş dizi döner; okuma yolu ileride AI entegrasyonu için hazır
 * tutulur (bkz. docs/AI.md).
 */
export async function listAiRunsForConversation(
  supabase: TypedSupabaseClient,
  conversationId: string
): Promise<AiRun[]> {
  const { data, error } = await supabase
    .from("ai_runs")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}
