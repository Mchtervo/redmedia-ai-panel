import { z } from "zod";

/**
 * ChatPlace MCP araç cevapları için Zod şemaları (docs/44).
 * Alan adları gerçek MCP cevaplarından doğrulanmıştır
 * (scripts/chatplace-mcp-report.ts ile keşif).
 */

/** chats_list → items[] öğesi. */
export const chatPlaceChatSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  clientName: z.string().optional().nullable(),
  status: z.number().optional(),
  statusName: z.string().optional(),
  type: z.number().optional(),
  typeName: z.string().optional(),
  lastMessageAt: z.number().int().nonnegative(),
});

export type ChatPlaceChat = z.infer<typeof chatPlaceChatSchema>;

/** chats_list cevabı (keyset sayfalama). */
export const chatPlaceChatsListSchema = z.object({
  items: z.array(chatPlaceChatSchema).default([]),
  lastItemId: z.string().optional().nullable(),
  // API string veya number dönebiliyor.
  lastItemTimestamp: z
    .union([z.string(), z.number()])
    .optional()
    .nullable(),
  hasNextItems: z.boolean().default(false),
});

export type ChatPlaceChatsList = z.infer<typeof chatPlaceChatsListSchema>;

/** chats_get cevabı (username içerir). */
export const chatPlaceChatDetailSchema = chatPlaceChatSchema.extend({
  username: z.string().optional().nullable(),
});

export type ChatPlaceChatDetail = z.infer<typeof chatPlaceChatDetailSchema>;

/** chats_messages → tek mesaj. side: "client" | "bot" | (operatör vb.). */
export const chatPlaceMessageSchema = z.object({
  id: z.string().min(1),
  side: z.string().min(1),
  message: z.string().optional().nullable(),
  isRead: z.boolean().optional(),
  createdAt: z.number().int().nonnegative(),
});

export type ChatPlaceMessage = z.infer<typeof chatPlaceMessageSchema>;

export const chatPlaceMessagesSchema = z.array(chatPlaceMessageSchema);

/**
 * ChatPlace mesaj gövdesi HTML içerebilir (özellikle bot mesajları).
 * Etiketler temizlenir, satır sonları korunur, yaygın entity'ler çözülür.
 */
export function stripChatPlaceHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Unix saniye → ISO 8601 (orijinal mesaj zamanı korunur). */
export function unixSecondsToIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

export type MappedDirection = {
  direction: "inbound" | "outbound";
  senderType: "customer" | "ai" | "staff";
};

/** ChatPlace `side` → panel yön/gönderen eşlemesi. */
export function mapChatPlaceSide(side: string): MappedDirection {
  const normalized = side.trim().toLowerCase();
  if (normalized === "client") {
    return { direction: "inbound", senderType: "customer" };
  }
  if (normalized === "bot" || normalized === "ai") {
    return { direction: "outbound", senderType: "ai" };
  }
  // operator / manager / user → panel personeli
  return { direction: "outbound", senderType: "staff" };
}
