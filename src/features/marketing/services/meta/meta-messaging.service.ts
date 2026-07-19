/**
 * Meta Instagram Messaging API — DM gönderimi.
 * Alıcı: contacts.meta_igsid (ChatPlace ID değil).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { resolveMetaAccessToken } from "@/features/marketing/services/meta/token.service";
import {
  graphPostJson,
  MetaGraphError,
} from "@/features/marketing/services/meta/graph-client";
import { resolvePageAccessToken } from "@/features/marketing/services/meta/page-resolve.service";
import { insertOutboundAiMessage } from "@/features/conversations/repositories/messages.repository";
import { touchLastMessageAt } from "@/features/conversations/repositories/conversations.repository";

type TypedSupabaseClient = SupabaseClient<Database>;

export type MetaSendResult =
  | {
      ok: true;
      metaMessageId: string;
      messagingType: "RESPONSE" | "MESSAGE_TAG";
    }
  | { ok: false; code: string; message: string };

function isOutsideWindowError(message: string): boolean {
  return /outside of allowed window|(#10)|(#551)|message tag|24 hour|human_agent/i.test(
    message
  );
}

/**
 * Instagram DM gönder. Önce RESPONSE (24s), olmazsa HUMAN_AGENT (7g).
 */
export async function sendInstagramDm(params: {
  pageAccessToken: string;
  pageId: string;
  recipientIgsid: string;
  text: string;
}): Promise<MetaSendResult> {
  const text = params.text.trim();
  if (!text) {
    return { ok: false, code: "empty", message: "Mesaj boş." };
  }
  if (!/^\d{5,}$/.test(params.recipientIgsid)) {
    return {
      ok: false,
      code: "invalid_igsid",
      message: "Geçersiz Meta IGSID.",
    };
  }

  const path = `${params.pageId}/messages`;

  try {
    const res = await graphPostJson<{ message_id?: string }>({
      accessToken: params.pageAccessToken,
      path,
      body: {
        recipient: { id: params.recipientIgsid },
        message: { text },
        messaging_type: "RESPONSE",
      },
    });
    if (!res.message_id) {
      return {
        ok: false,
        code: "no_message_id",
        message: "Meta mesaj kimliği dönmedi.",
      };
    }
    return {
      ok: true,
      metaMessageId: res.message_id,
      messagingType: "RESPONSE",
    };
  } catch (first) {
    const msg =
      first instanceof MetaGraphError
        ? first.message
        : first instanceof Error
          ? first.message
          : "Gönderim başarısız.";

    if (!isOutsideWindowError(msg) && !(first instanceof MetaGraphError)) {
      return { ok: false, code: "send_failed", message: msg };
    }

    try {
      const res = await graphPostJson<{ message_id?: string }>({
        accessToken: params.pageAccessToken,
        path,
        body: {
          recipient: { id: params.recipientIgsid },
          message: { text },
          messaging_type: "MESSAGE_TAG",
          tag: "HUMAN_AGENT",
        },
      });
      if (!res.message_id) {
        return {
          ok: false,
          code: "no_message_id",
          message: "Meta mesaj kimliği dönmedi.",
        };
      }
      return {
        ok: true,
        metaMessageId: res.message_id,
        messagingType: "MESSAGE_TAG",
      };
    } catch (second) {
      const msg2 =
        second instanceof Error ? second.message : "Gönderim başarısız.";
      return {
        ok: false,
        code:
          second instanceof MetaGraphError ? second.code : "send_failed",
        message: msg2.slice(0, 300),
      };
    }
  }
}

/**
 * Contact + conversation üzerinden DM gönderir; başarılıysa messages'a yazar.
 */
export async function sendMetaDmForContact(
  supabase: TypedSupabaseClient,
  params: {
    contactId: string;
    conversationId: string | null;
    text: string;
  }
): Promise<MetaSendResult & { persistedMessageId?: string }> {
  let { data: contact, error } = await supabase
    .from("contacts")
    .select("id,meta_igsid,username")
    .eq("id", params.contactId)
    .maybeSingle();
  if (error) throw error;
  if (!contact) {
    return { ok: false, code: "missing_contact", message: "Müşteri bulunamadı." };
  }

  // IGSID yoksa en güncel Meta thread'ten bir kez yakalamayı dene
  if (!contact.meta_igsid && contact.username) {
    try {
      const { captureMetaIgsidFromLatestThread } = await import(
        "@/features/marketing/services/meta/meta-igsid-sync.service"
      );
      await captureMetaIgsidFromLatestThread(supabase, {
        usernameHint: contact.username,
      });
      const refreshed = await supabase
        .from("contacts")
        .select("id,meta_igsid,username")
        .eq("id", params.contactId)
        .maybeSingle();
      if (refreshed.data) contact = refreshed.data;
    } catch {
      // yakalama opsiyonel
    }
  }

  if (!contact.meta_igsid) {
    return {
      ok: false,
      code: "missing_igsid",
      message:
        "Bu müşteride Meta IGSID yok. Müşteri tekrar yazınca otomatik yakalanır.",
    };
  }

  const token = await resolveMetaAccessToken(supabase);
  if (!token) {
    return {
      ok: false,
      code: "token_missing",
      message: "Meta OAuth bağlantısı yok.",
    };
  }

  let page;
  try {
    page = await resolvePageAccessToken(token.accessToken);
  } catch (e) {
    return {
      ok: false,
      code: "page_token",
      message: e instanceof Error ? e.message : "Page token alınamadı.",
    };
  }

  const sent = await sendInstagramDm({
    pageAccessToken: page.pageAccessToken,
    pageId: page.pageId,
    recipientIgsid: contact.meta_igsid,
    text: params.text,
  });

  if (!sent.ok) return sent;

  if (params.conversationId) {
    const message = await insertOutboundAiMessage(supabase, {
      conversationId: params.conversationId,
      content: params.text.trim(),
      externalMessageId: sent.metaMessageId,
      source: "meta_delivery",
      rawPayload: {
        delivery: "meta_messaging",
        messaging_type: sent.messagingType,
        recipient_igsid: contact.meta_igsid,
      },
    });
    await touchLastMessageAt(
      supabase,
      params.conversationId,
      message.created_at
    );
    return { ...sent, persistedMessageId: message.id };
  }

  return sent;
}
