import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { findOrCreateContactByInstagramUserId } from "@/features/contacts/repositories/contacts.repository";
import {
  findOrCreateConversation,
  touchLastMessageAt,
} from "@/features/conversations/repositories/conversations.repository";
import { findMessageByExternalId } from "@/features/conversations/repositories/messages.repository";
import type { ImportConversationsPayload } from "@/features/learning/validators/import-conversations";

type TypedSupabaseClient = SupabaseClient<Database>;

export type ImportConversationsResult = {
  conversationsProcessed: number;
  messagesInserted: number;
  messagesSkippedDuplicate: number;
  conversationIds: string[];
};

/**
 * Geçmiş konuşmaları JSON export formatından içe aktarır.
 * Dedup: channel+external_conversation_id ve conversation+external_message_id.
 * ChatPlace history REST API olmadığı için webhook + bu import yolu kullanılır.
 */
export async function importHistoricalConversations(
  supabase: TypedSupabaseClient,
  payload: ImportConversationsPayload
): Promise<ImportConversationsResult> {
  let conversationsProcessed = 0;
  let messagesInserted = 0;
  let messagesSkippedDuplicate = 0;
  const conversationIds: string[] = [];

  for (const item of payload.conversations) {
    const contact = await findOrCreateContactByInstagramUserId(supabase, {
      instagramUserId: item.contact.instagramUserId,
      username: item.contact.username,
      fullName: item.contact.fullName,
    });

    if (item.contact.phone?.trim()) {
      await supabase
        .from("contacts")
        .update({ phone: item.contact.phone.trim() })
        .eq("id", contact.id)
        .is("phone", null);
    }

    const conversation = await findOrCreateConversation(supabase, {
      contactId: contact.id,
      channel: item.channel,
      externalConversationId: item.externalConversationId,
    });

    conversationIds.push(conversation.id);
    conversationsProcessed += 1;

    for (const message of item.messages) {
      const existing = await findMessageByExternalId(
        supabase,
        conversation.id,
        message.externalMessageId
      );

      if (existing) {
        messagesSkippedDuplicate += 1;
        continue;
      }

      const direction = message.direction;
      const senderType =
        message.senderType ??
        (direction === "inbound" ? "customer" : "staff");

      const insertPayload = {
        conversation_id: conversation.id,
        external_message_id: message.externalMessageId,
        direction,
        sender_type: senderType,
        message_type: message.messageType ?? "text",
        content: message.content ?? null,
        source: "import" as const,
        raw_payload: { source: "import" },
        ...(message.createdAt ? { created_at: message.createdAt } : {}),
      } satisfies Database["public"]["Tables"]["messages"]["Insert"];

      const { error } = await supabase.from("messages").insert(insertPayload);
      if (error) {
        throw error;
      }

      messagesInserted += 1;

      if (message.createdAt) {
        await touchLastMessageAt(supabase, conversation.id, message.createdAt);
      }
    }
  }

  return {
    conversationsProcessed,
    messagesInserted,
    messagesSkippedDuplicate,
    conversationIds,
  };
}
