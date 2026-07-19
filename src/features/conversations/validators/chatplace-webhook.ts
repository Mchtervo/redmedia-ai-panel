import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { IngestInboundMessageRawInput } from "@/features/conversations/validators/ingest-inbound-message";
import { isJunkInboundMessageContent } from "@/features/conversations/validators/inbound-message-content";

/**
 * ChatPlace webhook payload şeması.
 *
 * `message.id` opsiyoneldir. ChatPlace custom messageNonce üretemediği için
 * id yoksa / boşsa / çözülmemiş şablon ise backend UUID üretir
 * (bkz. docs/CHATPLACE.md).
 */
export const chatPlaceWebhookSchema = z.object({
  // Olay tipi, ör. "message.received". Yalnızca gelen müşteri mesajı olayları
  // işlenir; diğerleri (teslim raporu vb.) kaydedilir ama mesaj üretmez.
  event: z.string().min(1),
  conversation: z.object({
    id: z.string().min(1),
    channel: z.enum(["instagram", "facebook"]),
  }),
  contact: z.object({
    id: z.string().min(1),
    username: z.string().min(1).optional(),
    full_name: z.string().min(1).optional(),
  }),
  message: z.object({
    id: z.string().min(1).optional(),
    type: z
      .enum(["text", "image", "video", "audio", "file", "template"])
      .default("text"),
    text: z.string().max(4000).optional(),
    timestamp: z.iso.datetime().optional(),
    media_url: z.string().url().optional(),
    url: z.string().url().optional(),
    attachment_url: z.string().url().optional(),
  }),
});

export type ChatPlaceWebhookPayload = z.infer<typeof chatPlaceWebhookSchema>;

/** İşlenmesi gereken (gelen müşteri mesajı) olay tipleri. */
export const INBOUND_MESSAGE_EVENTS = ["message.received", "message.created"] as const;

export function isInboundMessageEvent(event: string): boolean {
  return (INBOUND_MESSAGE_EVENTS as readonly string[]).includes(event);
}

/**
 * ChatPlace `message.id` yoksa veya kullanılamazsa (boş / çözülmemiş şablon)
 * her istek için yeni UUID üretir. Geçerli bir id gelirse aynen kullanılır
 * (test script'leri ve gerçek benzersiz id'ler için dedup korunur).
 */
export function resolveExternalMessageId(
  messageId: string | undefined
): string {
  const trimmed = messageId?.trim();
  if (!trimmed) {
    return randomUUID();
  }

  // ChatPlace değişkeni çözülmeden gelmiş şablonlar (örn. {{ messageNonce }}).
  if (trimmed.includes("{{") || trimmed === "message.id") {
    return randomUUID();
  }

  return trimmed;
}

/**
 * ChatPlace değişkeni çözülmeden gelen metin alanları (örn. "{{ fullName }}")
 * isim olarak kaydedilmemeli; bu durumda alan yok sayılır.
 */
function sanitizeContactField(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes("{{")) return undefined;
  return trimmed;
}

/**
 * Doğrulanmış ChatPlace payload'ını `ingestInboundMessage` girdisine çevirir.
 * Ham payload da `rawPayload` olarak taşınır (denetim/replay için,
 * bkz. docs/CHATPLACE.md).
 */
export function toIngestInput(
  payload: ChatPlaceWebhookPayload,
  rawPayload: Record<string, unknown>
): IngestInboundMessageRawInput {
  const rawText = payload.message.text;
  const content = isJunkInboundMessageContent(rawText)
    ? "[sistem: geçersiz mesaj içeriği filtrelendi]"
    : rawText;

  return {
    channel: payload.conversation.channel,
    externalConversationId: payload.conversation.id,
    contact: {
      instagramUserId: payload.contact.id,
      username: sanitizeContactField(payload.contact.username),
      fullName: sanitizeContactField(payload.contact.full_name),
    },
    externalMessageId: resolveExternalMessageId(payload.message.id),
    content,
    messageType: payload.message.type,
    occurredAt: payload.message.timestamp,
    rawPayload,
    source: "chatplace_webhook",
  };
}
