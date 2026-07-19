import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createHash } from "node:crypto";
import {
  analyzeReceiptWithVision,
  createPaymentReceipt,
} from "@/features/payments/services/payments.service";
import { findDraftByConversation } from "@/features/reservations/repositories/reservations.repository";
import { sendAiMessage } from "@/features/conversations/services/conversations.service";
import { insertAiRun } from "@/features/ai/repositories/ai-runs.repository";

type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * ChatPlace/raw payload'dan medya URL çıkarır (alan adları sağlayıcıya göre değişebilir).
 */
export function extractMediaUrlFromPayload(
  rawPayload: Record<string, unknown>
): string | null {
  const message = rawPayload.message;
  if (!message || typeof message !== "object") return null;
  const msg = message as Record<string, unknown>;

  const candidates = [
    msg.media_url,
    msg.mediaUrl,
    msg.url,
    msg.attachment_url,
    msg.file_url,
    msg.image_url,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//i.test(c)) return c;
  }

  const attachments = msg.attachments;
  if (Array.isArray(attachments) && attachments[0]) {
    const first = attachments[0];
    if (typeof first === "string" && /^https?:\/\//i.test(first)) return first;
    if (first && typeof first === "object") {
      const a = first as Record<string, unknown>;
      for (const key of ["url", "media_url", "href"]) {
        if (typeof a[key] === "string" && /^https?:\/\//i.test(a[key] as string)) {
          return a[key] as string;
        }
      }
    }
  }

  return null;
}

/** Unit-testable: kapora onay niyeti. */
export function detectsReservationConfirm(message: string): boolean {
  return /iban|kapora|ödeme|odeme|hesap|dekont/i.test(message) ||
    /(rezervasyon(u|umu)?\s*(onay|onaylıyorum|oluştur)|onaylıyorum|kaporayı?\s*(yatır|gönder))/i.test(
      message.toLocaleLowerCase("tr-TR")
    );
}

export function isLikelyReceiptIntent(
  messageType: string | undefined,
  text: string,
  hasMedia: boolean
): boolean {
  if (messageType === "image" && hasMedia) return true;
  if (hasMedia && /dekont|ödeme|odeme|havale|eft|kapora/i.test(text)) {
    return true;
  }
  return false;
}

async function hashUrl(url: string): Promise<string> {
  return createHash("sha256").update(url).digest("hex");
}

/**
 * Dekont görseli geldiğinde: Vision → doğrulama → kayıt → müşteriye şablon cevap.
 * Kesin confirmed yapmaz.
 */
export async function processInboundReceiptIfAny(
  supabase: TypedSupabaseClient,
  params: {
    conversationId: string;
    contactId: string;
    messageType?: string;
    text: string;
    rawPayload: Record<string, unknown>;
  }
): Promise<string | null> {
  const mediaUrl = extractMediaUrlFromPayload(params.rawPayload);
  if (
    !isLikelyReceiptIntent(params.messageType, params.text, Boolean(mediaUrl))
  ) {
    return null;
  }
  if (!mediaUrl) return null;

  const draft = await findDraftByConversation(supabase, params.conversationId);
  if (!draft) return null;

  // Kapora istenmemiş / taslak çok erken ise yine de kaydetmeye çalış
  const analysis = await analyzeReceiptWithVision(mediaUrl);
  const fileHash = await hashUrl(mediaUrl);

  const result = await createPaymentReceipt(supabase, {
    reservationId: draft.id,
    contactId: params.contactId,
    fileUrl: mediaUrl,
    fileHash,
    uploadedVia: "chatplace",
    analysis,
  });

  const reply = result.customerReply;

  const aiRun = await insertAiRun(supabase, {
    taskType: "receipt_validation_reply",
    conversationId: params.conversationId,
    contactId: params.contactId,
    model: "system_receipt_template",
    result: {
      input: { mediaUrlHash: fileHash.slice(0, 12) },
      output: {
        reply,
        duplicate: result.duplicate,
        receiptId: result.receipt?.id ?? null,
      },
    },
    status: "completed",
    requiresHumanApproval: false,
  });

  await sendAiMessage(supabase, {
    conversationId: params.conversationId,
    content: reply,
    aiRunId: aiRun.id,
  });

  return reply;
}
