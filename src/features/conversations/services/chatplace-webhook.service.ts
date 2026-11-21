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
import {
  recordAiResponseOnProfile,
  touchCustomerProfileFromMessage,
} from "@/features/customer-intelligence/services/customer-profile.service";
import { syncReservationContextAfterMessage } from "@/features/reservations/services/ai-reservation-flow.service";
import { processInboundReceiptIfAny } from "@/features/payments/services/receipt-inbound.service";
import { refreshSmartSalesProfile } from "@/features/smart-sales/services/smart-sales.service";
import { scheduleSalesCadence } from "@/features/smart-sales/services/follow-up-cadence.service";
import { appendTimelineEvent } from "@/features/smart-sales/repositories/smart-sales.repository";
import { createApprovalRequest } from "@/features/approvals/repositories/approvals.repository";
import { createPanelNotification } from "@/features/notifications/services/notifications.service";
import { runAutomationsForEvent } from "@/features/automations/services/automation-engine.service";

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

    // En güncel Meta thread'ten IGSID yakala (pagination bu hesapta Timeout veriyor).
    // Aktif yazışmada genelde son gelen kişi 1. sırada → follow-up Meta DM için gerekli.
    try {
      const { captureMetaIgsidFromLatestThread } = await import(
        "@/features/marketing/services/meta/meta-igsid-sync.service"
      );
      await captureMetaIgsidFromLatestThread(supabase, {
        usernameHint: parsed.data.contact.username ?? null,
      });
    } catch {
      // IGSID yakalama opsiyonel; webhook akışını bozmaz
    }

    const rawCustomerMessage = parsed.data.message.text?.trim() ?? "";
    const { isJunkInboundMessageContent } = await import(
      "@/features/conversations/validators/inbound-message-content"
    );
    const junkInbound = isJunkInboundMessageContent(rawCustomerMessage);
    // UI sızıntısı (StoppedStatusLabel vb.) → AI'ye verme, CRM'e dönüşme
    const customerMessage = junkInbound ? "" : rawCustomerMessage;
    let receiptReply: string | null = null;

    try {
      receiptReply = await processInboundReceiptIfAny(supabase, {
        conversationId: ingestResult.conversationId,
        contactId: ingestResult.contactId,
        messageType: parsed.data.message.type,
        text: customerMessage,
        rawPayload: payload,
      });
    } catch (receiptError) {
      console.error(
        "[chatplace-webhook] dekont işleme hatası:",
        receiptError instanceof Error ? receiptError.message : "bilinmeyen"
      );
    }

    if (customerMessage) {
      try {
        await touchCustomerProfileFromMessage(supabase, {
          contactId: ingestResult.contactId,
          customerMessage,
        });
      } catch (profileError) {
        console.error(
          "[chatplace-webhook] CRM profil güncelleme hatası:",
          profileError instanceof Error ? profileError.message : "bilinmeyen"
        );
      }

      try {
        await refreshSmartSalesProfile(supabase, {
          contactId: ingestResult.contactId,
          conversationId: ingestResult.conversationId,
          customerMessage,
        });
      } catch (smartError) {
        console.error(
          "[chatplace-webhook] smart sales hatası:",
          smartError instanceof Error ? smartError.message : "bilinmeyen"
        );
      }

      try {
        await appendTimelineEvent(supabase, {
          contactId: ingestResult.contactId,
          conversationId: ingestResult.conversationId,
          eventType: "customer_message",
          title: "Müşteri mesajı",
          body: customerMessage.slice(0, 180),
          actorType: "customer",
        });
      } catch {
        // timeline opsiyonel
      }

      try {
        await syncReservationContextAfterMessage(supabase, {
          conversationId: ingestResult.conversationId,
          contactId: ingestResult.contactId,
          customerMessage,
        });
      } catch (reservationError) {
        console.error(
          "[chatplace-webhook] rezervasyon taslak hatası:",
          reservationError instanceof Error
            ? reservationError.message
            : "bilinmeyen"
        );
      }

      // Automation Engine (docs/14,32): inbound_message tetikleyicili
      // kurallar çalışır (örn. "iptal" kelimesi geçen mesajda onay talebi).
      try {
        await runAutomationsForEvent(supabase, "inbound_message", {
          message: customerMessage,
          conversationId: ingestResult.conversationId,
          contactId: ingestResult.contactId,
        });
      } catch (automationError) {
        console.error(
          "[chatplace-webhook] otomasyon hatası:",
          automationError instanceof Error
            ? automationError.message
            : "bilinmeyen"
        );
      }
    }

    let reply: string | undefined = receiptReply ?? undefined;

    if (isAiAutoReplyEnabled() && customerMessage && !receiptReply) {
      try {
        const aiResult = await generateSimpleAssistantReply(supabase, {
          customerMessage,
          conversationId: ingestResult.conversationId,
          contactId: ingestResult.contactId,
        });

        if (aiResult?.reply) {
          // Hassas talepte ÖNCE onay kuyruğu, SONRA yalnızca nötr ara cevap
          // (docs/47 §1.3). Nihai satış/indirim cevabı onaylanmadan gitmez.
          if (aiResult.requiresHumanApproval) {
            try {
              const approval = await createApprovalRequest(supabase, {
                actionType: "assistant_reply",
                title: `Müşteri talebi insan kararı bekliyor: "${customerMessage.slice(0, 120)}"`,
                payload: {
                  customerMessage: customerMessage.slice(0, 1000),
                  holdReply: aiResult.reply.slice(0, 600),
                  awaitingHumanDecision: true,
                },
                conversationId: ingestResult.conversationId,
                contactId: ingestResult.contactId,
                aiRunId: aiResult.aiRunId,
              });
              await createPanelNotification(supabase, {
                type: "ai_approval_pending",
                title: "İnsan onayı bekleyen müşteri talebi",
                body: customerMessage.slice(0, 180),
                payload: { approvalId: approval.id },
              });
            } catch (approvalError) {
              console.error(
                "[chatplace-webhook] onay kaydı hatası:",
                approvalError instanceof Error
                  ? approvalError.message
                  : "bilinmeyen"
              );
            }
          }

          reply = aiResult.reply;
          await sendAiMessage(supabase, {
            conversationId: ingestResult.conversationId,
            content: aiResult.reply,
            aiRunId: aiResult.aiRunId,
          });

          await recordAiResponseOnProfile(
            supabase,
            ingestResult.contactId,
            aiResult.reply
          );

          try {
            await appendTimelineEvent(supabase, {
              contactId: ingestResult.contactId,
              conversationId: ingestResult.conversationId,
              eventType: "ai_reply",
              title: "AI cevabı",
              body: aiResult.reply.slice(0, 180),
              actorType: "ai",
            });
            await scheduleSalesCadence(supabase, {
              contactId: ingestResult.contactId,
              conversationId: ingestResult.conversationId,
            });
          } catch {
            // cadence opsiyonel
          }
        }
      } catch (aiError) {
        // AI hatası webhook'u bozmaz; mesaj processed kalır.
        console.error(
          "[chatplace-webhook] AI cevap hatası:",
          aiError instanceof Error ? aiError.message : "bilinmeyen"
        );
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
