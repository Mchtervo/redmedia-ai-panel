import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { Message } from "@/features/conversations/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export async function listMessagesByConversation(
  supabase: TypedSupabaseClient,
  conversationId: string
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    // Kronoloji: created_at artan sırada (bkz. docs/CHATPLACE.md "Kronoloji").
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

/** Tekrar kontrolü (idempotency) için — bkz. docs/CHATPLACE.md. */
export async function findMessageByExternalId(
  supabase: TypedSupabaseClient,
  conversationId: string,
  externalMessageId: string
): Promise<Message | null> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("external_message_id", externalMessageId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export type InsertInboundMessageParams = {
  conversationId: string;
  externalMessageId?: string;
  content?: string;
  messageType?: Message["message_type"];
  occurredAt?: string;
  rawPayload?: Json;
};

export async function insertInboundMessage(
  supabase: TypedSupabaseClient,
  params: InsertInboundMessageParams
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      external_message_id: params.externalMessageId ?? null,
      direction: "inbound",
      sender_type: "customer",
      message_type: params.messageType ?? "text",
      content: params.content ?? null,
      raw_payload: params.rawPayload ?? null,
      // `occurredAt` verilmişse (örn. seed script geçmiş bir tarih
      // simüle ediyorsa) DB varsayılanı (now()) yerine bunu kullanır.
      ...(params.occurredAt ? { created_at: params.occurredAt } : {}),
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export type InsertOutboundStaffMessageParams = {
  conversationId: string;
  content: string;
};

/**
 * Personelin panelden yazdığı cevabı kaydeder. Not: Bu fonksiyon
 * ChatPlace'e gerçek bir "mesaj gönder" API çağrısı YAPMAZ — yalnızca
 * `messages` tablosuna yazar (bkz. docs/CHATPLACE.md, v1 kasıtlı sınırlaması).
 */
export async function insertOutboundStaffMessage(
  supabase: TypedSupabaseClient,
  { conversationId, content }: InsertOutboundStaffMessageParams
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      direction: "outbound",
      sender_type: "staff",
      message_type: "text",
      content,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
