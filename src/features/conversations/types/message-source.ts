/**
 * Mesaj kaynağı — null yasak. DB enum `public.message_source` ile senkron.
 */

export const MESSAGE_SOURCES = [
  "chatplace_mcp",
  "chatplace_webhook",
  "meta_delivery",
  "manual_test",
  "seed",
  "lab",
  "import",
  "migration",
  "legacy",
  "unknown",
] as const;

export type MessageSource = (typeof MESSAGE_SOURCES)[number];

export function isMessageSource(value: unknown): value is MessageSource {
  return (
    typeof value === "string" &&
    (MESSAGE_SOURCES as readonly string[]).includes(value)
  );
}

/** raw_payload içine source göm; mevcut alanları koru. */
export function withMessageSource(
  rawPayload: Record<string, unknown> | null | undefined,
  source: MessageSource
): Record<string, unknown> {
  return {
    ...(rawPayload ?? {}),
    source,
  };
}

export const MESSAGE_SOURCE_LABELS: Record<MessageSource, string> = {
  chatplace_mcp: "ChatPlace MCP",
  chatplace_webhook: "ChatPlace Webhook",
  meta_delivery: "Meta gönderim",
  manual_test: "Manuel test",
  seed: "Seed",
  lab: "Lab",
  import: "Import",
  migration: "Migration",
  legacy: "Legacy",
  unknown: "Bilinmiyor",
};
