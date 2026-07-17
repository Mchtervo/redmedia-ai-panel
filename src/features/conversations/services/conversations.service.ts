import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { findOrCreateContactByInstagramUserId } from "@/features/contacts/repositories/contacts.repository";
import {
  assignConversation as assignConversationRepo,
  findOrCreateConversation,
  getConversationById,
  listAiRunsForConversation,
  listConversations,
  touchLastMessageAt,
  updateConversationStatus as updateConversationStatusRepo,
} from "@/features/conversations/repositories/conversations.repository";
import {
  findMessageByExternalId,
  insertInboundMessage,
  insertOutboundAiMessage,
  insertOutboundStaffMessage,
  listMessagesByConversation,
} from "@/features/conversations/repositories/messages.repository";
import type {
  ConversationDetail,
  ConversationStatus,
  ListConversationsResult,
  Message,
} from "@/features/conversations/types";
import {
  ingestInboundMessageSchema,
  type IngestInboundMessageRawInput,
} from "@/features/conversations/validators/ingest-inbound-message";

type TypedSupabaseClient = SupabaseClient<Database>;

export const CONVERSATIONS_PAGE_SIZE = 20;

export type ListInboxConversationsParams = {
  search?: string;
  status?: ConversationStatus;
  page: number;
};

export async function listInboxConversations(
  supabase: TypedSupabaseClient,
  { search, status, page }: ListInboxConversationsParams
): Promise<ListConversationsResult> {
  const { rows, count } = await listConversations(supabase, {
    search,
    status,
    page,
    pageSize: CONVERSATIONS_PAGE_SIZE,
  });

  return {
    items: rows,
    totalCount: count,
    page,
    pageSize: CONVERSATIONS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(count / CONVERSATIONS_PAGE_SIZE)),
  };
}

export async function getInboxConversationDetail(
  supabase: TypedSupabaseClient,
  id: string
): Promise<ConversationDetail | null> {
  const conversation = await getConversationById(supabase, id);

  if (!conversation) {
    return null;
  }

  const [messages, aiRuns] = await Promise.all([
    listMessagesByConversation(supabase, id),
    listAiRunsForConversation(supabase, id),
  ]);

  return { conversation, messages, aiRuns };
}

/**
 * Gelen (inbound) bir müşteri mesajını sisteme alır: contact ve conversation
 * bul-veya-oluşturulur, tekrar kontrolü yapılır, mesaj yazılır ve
 * `last_message_at` güncellenir (bkz. docs/CHATPLACE.md "Mesaj Akışı").
 *
 * Not: Bu fonksiyon şu an gerçek bir ChatPlace webhook'u tarafından
 * tetiklenmiyor — yalnızca `scripts/seed-conversations.ts` (development-only)
 * tarafından çağrılıyor. Webhook Route Handler'ı eklendiğinde aynı
 * fonksiyon kullanılacaktır.
 */
export type IngestInboundMessageResult = {
  message: Message;
  wasDuplicate: boolean;
  conversationId: string;
  contactId: string;
};

export async function ingestInboundMessage(
  supabase: TypedSupabaseClient,
  rawInput: IngestInboundMessageRawInput
): Promise<IngestInboundMessageResult> {
  // Dış kaynaklı (webhook/seed) girdi; Zod ile doğrulanır ve varsayılanlar
  // (messageType, initialStatus) uygulanır (bkz. .cursor/rules/01-code-quality.mdc).
  const input = ingestInboundMessageSchema.parse(rawInput);

  const contact = await findOrCreateContactByInstagramUserId(supabase, {
    instagramUserId: input.contact.instagramUserId,
    username: input.contact.username,
    fullName: input.contact.fullName,
  });

  const conversation = await findOrCreateConversation(supabase, {
    contactId: contact.id,
    channel: input.channel,
    externalConversationId: input.externalConversationId,
    initialStatus: input.initialStatus,
  });

  if (input.externalMessageId) {
    const existing = await findMessageByExternalId(
      supabase,
      conversation.id,
      input.externalMessageId
    );

    if (existing) {
      return {
        message: existing,
        wasDuplicate: true,
        conversationId: conversation.id,
        contactId: contact.id,
      };
    }
  }

  const message = await insertInboundMessage(supabase, {
    conversationId: conversation.id,
    externalMessageId: input.externalMessageId,
    content: input.content,
    messageType: input.messageType,
    occurredAt: input.occurredAt,
    // Zod `z.record(...)` çıktısı yapısal olarak JSON-uyumludur; `Json`
    // tipi TypeScript'in `unknown` değerleri kabul etmemesi nedeniyle
    // burada açıkça belirtilir.
    rawPayload: input.rawPayload as Message["raw_payload"],
  });

  await touchLastMessageAt(supabase, conversation.id, message.created_at);

  return {
    message,
    wasDuplicate: false,
    conversationId: conversation.id,
    contactId: contact.id,
  };
}

export type SendStaffMessageParams = {
  conversationId: string;
  content: string;
};

/**
 * Personelin panelden yazdığı cevabı kaydeder. ChatPlace'e gerçek bir
 * gönderim YAPMAZ (bkz. docs/CHATPLACE.md, v1 kasıtlı sınırlaması) —
 * yalnızca `messages` tablosuna `direction=outbound, sender_type=staff`
 * olarak yazar.
 */
export async function sendStaffMessage(
  supabase: TypedSupabaseClient,
  { conversationId, content }: SendStaffMessageParams
): Promise<Message> {
  const message = await insertOutboundStaffMessage(supabase, {
    conversationId,
    content,
  });

  await touchLastMessageAt(supabase, conversationId, message.created_at);

  return message;
}

export type SendAiMessageParams = {
  conversationId: string;
  content: string;
  aiRunId?: string;
};

/**
 * AI cevabını panel DB'sine kaydeder. Instagram'a iletim ChatPlace
 * External Request `data.reply` + Mesaj bloğu ile yapılır.
 */
export async function sendAiMessage(
  supabase: TypedSupabaseClient,
  { conversationId, content, aiRunId }: SendAiMessageParams
): Promise<Message> {
  const message = await insertOutboundAiMessage(supabase, {
    conversationId,
    content,
    rawPayload: aiRunId ? { ai_run_id: aiRunId } : null,
  });

  await touchLastMessageAt(supabase, conversationId, message.created_at);

  return message;
}

export async function updateConversationStatus(
  supabase: TypedSupabaseClient,
  conversationId: string,
  status: ConversationStatus
) {
  return updateConversationStatusRepo(supabase, conversationId, status);
}

/** `userId` null verilirse atama kaldırılır (bkz. Inbox "Atamayı kaldır"). */
export async function assignConversation(
  supabase: TypedSupabaseClient,
  conversationId: string,
  userId: string | null
) {
  return assignConversationRepo(supabase, conversationId, userId);
}
