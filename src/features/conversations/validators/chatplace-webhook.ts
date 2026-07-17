import { z } from "zod";
import type { IngestInboundMessageRawInput } from "@/features/conversations/validators/ingest-inbound-message";

/**
 * ChatPlace webhook payload şeması.
 *
 * NOT: Gerçek ChatPlace webhook dokümantasyonu elde edilene kadar makul,
 * genel bir mesajlaşma-webhook sözleşmesi varsayılmıştır. Alan adları/olay
 * tipleri gerçek dokümana göre ayarlanabilir; ingest mantığı (mapper) bu
 * şemadan `ingestInboundMessage` girdisine çevirdiği için değişiklik yalnızca
 * bu dosyayla sınırlı kalır (bkz. docs/CHATPLACE.md).
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
    id: z.string().min(1),
    type: z
      .enum(["text", "image", "video", "audio", "file", "template"])
      .default("text"),
    text: z.string().max(4000).optional(),
    timestamp: z.iso.datetime().optional(),
  }),
});

export type ChatPlaceWebhookPayload = z.infer<typeof chatPlaceWebhookSchema>;

/** İşlenmesi gereken (gelen müşteri mesajı) olay tipleri. */
export const INBOUND_MESSAGE_EVENTS = ["message.received", "message.created"] as const;

export function isInboundMessageEvent(event: string): boolean {
  return (INBOUND_MESSAGE_EVENTS as readonly string[]).includes(event);
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
  return {
    channel: payload.conversation.channel,
    externalConversationId: payload.conversation.id,
    contact: {
      instagramUserId: payload.contact.id,
      username: payload.contact.username,
      fullName: payload.contact.full_name,
    },
    externalMessageId: payload.message.id,
    content: payload.message.text,
    messageType: payload.message.type,
    occurredAt: payload.message.timestamp,
    rawPayload,
  };
}
