import { z } from "zod";
import { CONVERSATION_STATUS_VALUES } from "@/features/conversations/types";

/**
 * `ingestInboundMessage` servis fonksiyonunun girdi şeması. Şu an bu
 * fonksiyon yalnızca `scripts/seed-conversations.ts` (development-only)
 * tarafından çağrılıyor; gerçek bir ChatPlace webhook'u henüz bağlı değil
 * (bkz. docs/CHATPLACE.md). Girdi, dış kaynaklı kabul edilip yine de Zod
 * ile doğrulanır — webhook Route Handler'ı eklendiğinde aynı şema
 * kullanılacaktır.
 */
export const ingestInboundMessageSchema = z.object({
  channel: z.enum(["instagram", "facebook"]),
  externalConversationId: z.string().min(1),
  contact: z.object({
    instagramUserId: z.string().min(1),
    username: z.string().min(1).optional(),
    fullName: z.string().min(1).optional(),
  }),
  externalMessageId: z.string().min(1).optional(),
  content: z.string().max(4000).optional(),
  messageType: z
    .enum(["text", "image", "video", "audio", "file", "template"])
    .default("text"),
  occurredAt: z.iso.datetime().optional(),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
  /** Konuşma yoksa hangi durumla oluşturulacağı; varsayılan `open`. */
  initialStatus: z.enum(CONVERSATION_STATUS_VALUES).optional().default("open"),
});

/** Şema tarafından doğrulanıp varsayılanları uygulanmış (parse edilmiş) şekil. */
export type IngestInboundMessageInput = z.infer<typeof ingestInboundMessageSchema>;

/** Çağıranın sağlaması gereken (varsayılanlar hariç, opsiyonel) ham girdi şekli. */
export type IngestInboundMessageRawInput = z.input<typeof ingestInboundMessageSchema>;
