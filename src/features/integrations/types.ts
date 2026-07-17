import type { Database, Json } from "@/types/database";

export type WebhookEvent = Database["public"]["Tables"]["webhook_events"]["Row"];
export type WebhookProvider = WebhookEvent["provider"];
export type WebhookStatus = WebhookEvent["status"];

export type { Json };
