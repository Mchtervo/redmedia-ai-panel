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
  listRecentMessagesByConversation,
} from "@/features/conversations/repositories/messages.repository";
import type {
  ConversationDetail,
  ConversationStatus,
  ListConversationsResult,
  Message,
} from "@/features/conversations/types";
import {
  ingestInboundMessageSchema,
  resolveInboundMessageSource,
  type IngestInboundMessageRawInput,
} from "@/features/conversations/validators/ingest-inbound-message";
import type { MessageSource } from "@/features/conversations/types/message-source";

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

  const source = resolveInboundMessageSource({
    source: input.source,
    externalConversationId: input.externalConversationId,
    rawPayload: input.rawPayload,
  });

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
    source,
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
  /** Verilmezse Meta başarılıysa meta_delivery, aksi halde unknown. */
  source?: MessageSource;
};

/**
 * Personelin panelden yazdığı cevabı kaydeder.
 * Contact'ta meta_igsid varsa Meta Messaging API ile Instagram DM dener;
 * yoksa / başarısızsa yalnızca DB kaydı (eski personel köprüsü).
 */
export async function sendStaffMessage(
  supabase: TypedSupabaseClient,
  { conversationId, content, source: sourceOverride }: SendStaffMessageParams,
  options?: { actorId?: string | null }
): Promise<Message> {
  const conv = await getConversationById(supabase, conversationId);
  let metaDelivery: {
    ok: boolean;
    metaMessageId?: string;
    error?: string;
  } | null = null;

  if (conv?.contact_id) {
    try {
      const { sendMetaDmForContact } = await import(
        "@/features/marketing/services/meta/meta-messaging.service"
      );
      const sent = await sendMetaDmForContact(supabase, {
        contactId: conv.contact_id,
        conversationId: null,
        text: content,
      });
      if (sent.ok) {
        metaDelivery = { ok: true, metaMessageId: sent.metaMessageId };
      } else if (sent.code !== "missing_igsid") {
        metaDelivery = { ok: false, error: sent.message };
      }
    } catch {
      metaDelivery = { ok: false, error: "Meta gönderim denemesi başarısız." };
    }
  }

  const staffSource =
    sourceOverride ??
    (metaDelivery?.ok === true
      ? ("meta_delivery" as const)
      : ("unknown" as const));

  const message = await insertOutboundStaffMessage(supabase, {
    conversationId,
    content,
    externalMessageId: metaDelivery?.metaMessageId ?? null,
    source: staffSource,
    rawPayload: metaDelivery
      ? {
          delivery: metaDelivery.ok ? "meta_messaging" : "db_only",
          meta_error: metaDelivery.error ?? null,
        }
      : { delivery: "db_only" },
  });

  await touchLastMessageAt(supabase, conversationId, message.created_at);

  // Admin AI düzeltmesi: son AI mesajından sonra personel yazdıysa kaydet
  try {
    const recent = await listRecentMessagesByConversation(
      supabase,
      conversationId,
      8
    );
    const lastAi = [...recent]
      .reverse()
      .find((m) => m.sender_type === "ai" && m.content);
    if (lastAi?.content && lastAi.content.trim() !== content.trim()) {
      const { insertAdminAiCorrection, recordConversationOutcome } =
        await import("@/features/ai-brain/services/ai-brain.service");
      await insertAdminAiCorrection(supabase, {
        conversationId,
        contactId: conv?.contact_id ?? null,
        aiMessageId: lastAi.id,
        staffMessageId: message.id,
        aiText: lastAi.content,
        staffText: content,
        actorId: options?.actorId ?? null,
      });
      await recordConversationOutcome(supabase, {
        conversationId,
        contactId: conv?.contact_id ?? null,
        outcome: "admin_corrected_ai",
      });

      // Human Feedback Learning — fark → kalıp
      try {
        const { learnFromHumanCorrection } = await import(
          "@/features/ai/services/human-feedback-learning.service"
        );
        await learnFromHumanCorrection(supabase, {
          conversationId,
          aiText: lastAi.content,
          staffText: content,
        });
      } catch {
        /* pattern çıkarma opsiyonel */
      }
    }
  } catch {
    // düzeltme kaydı opsiyonel
  }

  return message;
}

export type SendAiMessageParams = {
  conversationId: string;
  content: string;
  aiRunId?: string;
  /** Varsayılan: chatplace_webhook (canlı AI reply yolu). */
  source?: "chatplace_webhook" | "meta_delivery" | "lab" | "unknown";
};

/**
 * AI cevabını panel DB'sine kaydeder. Instagram'a iletim ChatPlace
 * External Request `data.reply` + Mesaj bloğu ile yapılır.
 */
export async function sendAiMessage(
  supabase: TypedSupabaseClient,
  { conversationId, content, aiRunId, source }: SendAiMessageParams
): Promise<Message> {
  const message = await insertOutboundAiMessage(supabase, {
    conversationId,
    content,
    source: source ?? "chatplace_webhook",
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
  const updated = await updateConversationStatusRepo(
    supabase,
    conversationId,
    status
  );

  if (status === "closed") {
    try {
      const { learnOnConversationClosed } = await import(
        "@/features/learning/services/learning-automation.service"
      );
      await learnOnConversationClosed(supabase, conversationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      console.error(
        "[conversations] kapanış öğrenmesi başarısız:",
        conversationId,
        message
      );
    }
  }

  return updated;
}

/** `userId` null verilirse atama kaldırılır (bkz. Inbox "Atamayı kaldır"). */
export async function assignConversation(
  supabase: TypedSupabaseClient,
  conversationId: string,
  userId: string | null
) {
  return assignConversationRepo(supabase, conversationId, userId);
}
