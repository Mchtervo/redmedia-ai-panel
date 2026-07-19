import { z } from "zod";

/**
 * ChatPlace geçmiş konuşma içe aktarma sözleşmesi.
 * Kamuya açık ChatPlace history REST API yok; webhook ile gelen
 * kayıtlar + bu JSON export formatı kullanılır.
 */
export const importMessageSchema = z.object({
  externalMessageId: z.string().min(1).max(200),
  direction: z.enum(["inbound", "outbound"]),
  senderType: z.enum(["customer", "ai", "staff", "system"]).optional(),
  messageType: z
    .enum(["text", "image", "video", "audio", "file", "template"])
    .optional()
    .default("text"),
  content: z.string().max(8000).nullable().optional(),
  createdAt: z.string().min(10).max(40).optional(),
});

export const importConversationSchema = z.object({
  externalConversationId: z.string().min(1).max(200),
  channel: z.enum(["instagram", "facebook"]).default("instagram"),
  contact: z.object({
    instagramUserId: z.string().min(1).max(200),
    username: z.string().max(200).nullable().optional(),
    fullName: z.string().max(300).nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
  }),
  messages: z.array(importMessageSchema).min(1).max(500),
});

export const importConversationsPayloadSchema = z.object({
  conversations: z.array(importConversationSchema).min(1).max(100),
});

export type ImportConversationsPayload = z.infer<
  typeof importConversationsPayloadSchema
>;
