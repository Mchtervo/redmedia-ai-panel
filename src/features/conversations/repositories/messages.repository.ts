import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { Message } from "@/features/conversations/types";
import {
  withMessageSource,
  type MessageSource,
} from "@/features/conversations/types/message-source";

type TypedSupabaseClient = SupabaseClient<Database>;

function payloadWithSource(
  rawPayload: Json | null | undefined,
  source: MessageSource
): Json {
  const base =
    rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
      ? (rawPayload as Record<string, unknown>)
      : {};
  return withMessageSource(base, source) as Json;
}

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

/**
 * AI bağlamı için son N mesajı kronolojik sırada döner
 * (en eskiden en yeniye). Mevcut inbound dahil olabilir.
 */
export async function listRecentMessagesByConversation(
  supabase: TypedSupabaseClient,
  conversationId: string,
  limit = 12
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).slice().reverse();
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
  /** Zorunlu — null yasak. */
  source: MessageSource;
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
      source: params.source,
      raw_payload: payloadWithSource(params.rawPayload, params.source),
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

/**
 * ChatPlace MCP senkronizasyonu: dış id'li mesajı geldiği yön/gönderen ve
 * ORİJİNAL zaman damgasıyla yazar (docs/44). Dedupe çağıran tarafta yapılır.
 */
export type InsertSyncedMessageParams = {
  conversationId: string;
  externalMessageId: string;
  direction: "inbound" | "outbound";
  senderType: "customer" | "ai" | "staff";
  content: string | null;
  occurredAt: string;
  rawPayload?: Json;
  source?: MessageSource;
};

export async function insertSyncedMessage(
  supabase: TypedSupabaseClient,
  params: InsertSyncedMessageParams
): Promise<Message> {
  const source = params.source ?? "chatplace_mcp";
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      external_message_id: params.externalMessageId,
      direction: params.direction,
      sender_type: params.senderType,
      message_type: "text",
      content: params.content,
      source,
      raw_payload: payloadWithSource(params.rawPayload, source),
      created_at: params.occurredAt,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Webhook'tan üretilmiş-UUID'li kayıtlarla MCP kayıtlarının çakışmasını
 * önleyen yumuşak tekrar kontrolü: aynı konuşma + yön + birebir içerik +
 * ±`toleranceSeconds` zaman penceresi (docs/44 "Çifte kayıt önleme").
 */
export async function findSimilarMessage(
  supabase: TypedSupabaseClient,
  params: {
    conversationId: string;
    direction: "inbound" | "outbound";
    content: string;
    occurredAt: string;
    toleranceSeconds?: number;
  }
): Promise<Message | null> {
  const tolerance = (params.toleranceSeconds ?? 180) * 1000;
  const occurred = new Date(params.occurredAt).getTime();
  const from = new Date(occurred - tolerance).toISOString();
  const to = new Date(occurred + tolerance).toISOString();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", params.conversationId)
    .eq("direction", params.direction)
    .eq("content", params.content)
    .gte("created_at", from)
    .lte("created_at", to)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export type InsertOutboundStaffMessageParams = {
  conversationId: string;
  content: string;
  externalMessageId?: string | null;
  rawPayload?: Json | null;
  source: MessageSource;
};

/**
 * Personelin panelden yazdığı cevabı `messages` tablosuna yazar.
 * Instagram iletimi üst katmanda Meta Messaging ile yapılabilir.
 */
export async function insertOutboundStaffMessage(
  supabase: TypedSupabaseClient,
  {
    conversationId,
    content,
    externalMessageId,
    rawPayload,
    source,
  }: InsertOutboundStaffMessageParams
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      direction: "outbound",
      sender_type: "staff",
      message_type: "text",
      content,
      external_message_id: externalMessageId ?? null,
      source,
      raw_payload: payloadWithSource(rawPayload, source),
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export type InsertOutboundAiMessageParams = {
  conversationId: string;
  content: string;
  /** OpenAI/ChatPlace tarafında varsa dış mesaj kimliği. */
  externalMessageId?: string | null;
  rawPayload?: Json | null;
  source: MessageSource;
};

/**
 * AI cevabını `messages` tablosuna yazar (`sender_type=ai`).
 * ChatPlace'e push gönderim bu katmanda yapılmaz; DM iletimi ChatPlace
 * External Request yanıt eşlemesi + Mesaj bloğu ile yapılır (docs/CHATPLACE.md).
 */
export async function insertOutboundAiMessage(
  supabase: TypedSupabaseClient,
  {
    conversationId,
    content,
    externalMessageId,
    rawPayload,
    source,
  }: InsertOutboundAiMessageParams
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      direction: "outbound",
      sender_type: "ai",
      message_type: "text",
      content,
      external_message_id: externalMessageId ?? null,
      source,
      raw_payload: payloadWithSource(rawPayload, source),
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
