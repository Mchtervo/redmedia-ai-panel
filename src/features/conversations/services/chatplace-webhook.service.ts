import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import {
  markWebhookEventFailed,
  markWebhookEventHandled,
  recordWebhookEvent,
} from "@/features/integrations/repositories/webhook-events.repository";
import {
  ingestInboundMessage,
  sendAiMessage,
} from "@/features/conversations/services/conversations.service";
import {
  chatPlaceWebhookSchema,
  isInboundMessageEvent,
  toIngestInput,
} from "@/features/conversations/validators/chatplace-webhook";
import {
  generateSimpleAssistantReply,
  isAiAutoReplyEnabled,
} from "@/features/ai/services/simple-assistant.service";

type TypedSupabaseClient = SupabaseClient<Database>;

export type ProcessChatPlaceWebhookResult =
  | { outcome: "processed"; webhookEventId: string; reply?: string }
  | { outcome: "duplicate"; webhookEventId: string }
  | { outcome: "ignored"; webhookEventId: string; reason: string }
  | { outcome: "invalid"; webhookEventId: string; reason: string }
  | { outcome: "error"; webhookEventId: string };

export type ProcessChatPlaceWebhookParams = {
  payload: Record<string, unknown>;
  signatureVerified: boolean;
};

/**
 * ChatPlace webhook'unun uçtan uca işlenmesi (bkz. docs/CHATPLACE.md):
 *   1. Ham olayı `webhook_events`'e kaydet (received).
 *   2. Zod ile doğrula (geçersizse failed).
 *   3. Gelen mesaj olayı değilse ignored.
 *   4. `ingestInboundMessage` ile mesajı al (duplicate ise ignored).
 *   5. Yeni mesajda (opsiyonel) basit AI cevabı üret → `data.reply`.
 *   6. Başarılı → processed; beklenmeyen hata → failed.
 *
 * İmza doğrulaması ve rate limiting bu servisten ÖNCE, route handler'da
 * yapılır; bu servis yalnızca imzası doğrulanmış istekler için çağrılır.
 */
export async function processChatPlaceWebhook(
  supabase: TypedSupabaseClient,
  { payload, signatureVerified }: ProcessChatPlaceWebhookParams
): Promise<ProcessChatPlaceWebhookResult> {
  const eventType =
    typeof payload.event === "string" ? payload.event : null;

  const webhookEvent = await recordWebhookEvent(supabase, {
    provider: "chatplace",
    eventType,
    signatureVerified,
    payload: payload as Json,
  });

  const parsed = chatPlaceWebhookSchema.safeParse(payload);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const reason = issue
      ? `${issue.path.join(".")}: ${issue.message}`
      : "Geçersiz payload.";
    await markWebhookEventFailed(supabase, webhookEvent.id, reason);
    return { outcome: "invalid", webhookEventId: webhookEvent.id, reason };
  }

  if (!isInboundMessageEvent(parsed.data.event)) {
    await markWebhookEventHandled(supabase, webhookEvent.id, "ignored");
    return {
      outcome: "ignored",
      webhookEventId: webhookEvent.id,
      reason: `İşlenmeyen olay tipi: ${parsed.data.event}`,
    };
  }

  try {
    const ingestResult = await ingestInboundMessage(
      supabase,
      toIngestInput(parsed.data, payload)
    );

    if (ingestResult.wasDuplicate) {
      await markWebhookEventHandled(supabase, webhookEvent.id, "ignored");
      return { outcome: "duplicate", webhookEventId: webhookEvent.id };
    }

    let reply: string | undefined;

    if (isAiAutoReplyEnabled()) {
      const customerMessage = parsed.data.message.text?.trim() ?? "";
      if (customerMessage) {
        try {
          const aiResult = await generateSimpleAssistantReply(supabase, {
            customerMessage,
            conversationId: ingestResult.conversationId,
            contactId: ingestResult.contactId,
          });

          if (aiResult?.reply) {
            reply = aiResult.reply;
            await sendAiMessage(supabase, {
              conversationId: ingestResult.conversationId,
              content: aiResult.reply,
              aiRunId: aiResult.aiRunId,
            });
          }
        } catch (aiError) {
          // AI hatası webhook'u bozmaz; mesaj processed kalır.
          console.error(
            "[chatplace-webhook] AI cevap hatası:",
            aiError instanceof Error ? aiError.message : "bilinmeyen"
          );
        }
      }
    }

    await markWebhookEventHandled(supabase, webhookEvent.id, "processed");
    return {
      outcome: "processed",
      webhookEventId: webhookEvent.id,
      ...(reply ? { reply } : {}),
    };
  } catch (error) {
    // Hata detayı istemciye sızdırılmaz; kısa, hassas-veri içermeyen bir
    // özet kaydedilir (bkz. .cursor/rules/02-security.mdc).
    const message = error instanceof Error ? error.message : "İşleme hatası.";
    await markWebhookEventFailed(supabase, webhookEvent.id, message);
    return { outcome: "error", webhookEventId: webhookEvent.id };
  }
}
