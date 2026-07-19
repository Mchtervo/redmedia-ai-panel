import { z } from "zod";
import { CONVERSATION_STATUS_VALUES } from "@/features/conversations/types";
import {
  MESSAGE_SOURCES,
  type MessageSource,
} from "@/features/conversations/types/message-source";

/**
 * `ingestInboundMessage` girdi şeması (seed + ChatPlace webhook).
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
  /** Verilmezse external id / payload'dan türetilir; null olmaz. */
  source: z.enum(MESSAGE_SOURCES).optional(),
});

/** Inbound source türetme — boş bırakılmaz. */
export function resolveInboundMessageSource(input: {
  source?: MessageSource;
  externalConversationId: string;
  rawPayload?: Record<string, unknown>;
}): MessageSource {
  if (input.source) return input.source;

  const ext = input.externalConversationId;
  if (/^seed[-_]/i.test(ext)) return "seed";
  if (
    /^(ai-test|ai-dup|prod-token|c-c)/i.test(ext) ||
    ext.includes("{{") ||
    /test/i.test(ext)
  ) {
    return "manual_test";
  }

  const event = input.rawPayload?.event;
  if (typeof event === "string" && event.startsWith("message.")) {
    return "chatplace_webhook";
  }

  return "unknown";
}

/** Şema tarafından doğrulanıp varsayılanları uygulanmış (parse edilmiş) şekil. */
export type IngestInboundMessageInput = z.infer<typeof ingestInboundMessageSchema>;

/** Çağıranın sağlaması gereken (varsayılanlar hariç, opsiyonel) ham girdi şekli. */
export type IngestInboundMessageRawInput = z.input<typeof ingestInboundMessageSchema>;
