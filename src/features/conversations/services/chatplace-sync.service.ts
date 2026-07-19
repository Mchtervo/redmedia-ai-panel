import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import {
  ChatPlaceMcpClient,
  ChatPlaceMcpError,
  isChatPlaceMcpConfigured,
} from "@/server/chatplace/mcp-client";
import {
  chatPlaceChatDetailSchema,
  chatPlaceChatsListSchema,
  chatPlaceMessagesSchema,
  mapChatPlaceSide,
  stripChatPlaceHtml,
  unixSecondsToIso,
  type ChatPlaceChat,
} from "@/features/conversations/validators/chatplace-mcp";
import { findOrCreateContactByInstagramUserId } from "@/features/contacts/repositories/contacts.repository";
import { getContactById } from "@/features/contacts/repositories/contacts.repository";
import {
  findConversationByExternalId,
  findOrCreateConversation,
  getConversationById,
  touchLastMessageAt,
} from "@/features/conversations/repositories/conversations.repository";
import {
  findMessageByExternalId,
  findSimilarMessage,
  insertSyncedMessage,
} from "@/features/conversations/repositories/messages.repository";
import { appendTimelineEvent } from "@/features/smart-sales/repositories/smart-sales.repository";
import {
  finishSyncLog,
  startSyncLog,
} from "@/features/marketing/services/meta/sync-log";
import { touchCustomerProfileFromMessage } from "@/features/customer-intelligence/services/customer-profile.service";
import { refreshSmartSalesProfile } from "@/features/smart-sales/services/smart-sales.service";

type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * ChatPlace MCP salt okuma senkronizasyonu (docs/44).
 *
 * - backfill: tüm chat listesi taranır, her chat'in erişilebilir mesaj
 *   geçmişi sayfa sayfa alınır. Idempotent: dış mesaj id'si + benzerlik
 *   penceresi ile tekrar yazılmaz; istenildiği kadar tekrar çalıştırılabilir.
 * - incremental: liste lastMessageAt'e göre azalan sıralı geldiği için,
 *   panel kaydından daha yeni aktivitesi olmayan chat'e gelindiğinde durur.
 *
 * YAZMA YOK: ChatPlace tarafında hiçbir kayıt değiştirilmez, mesaj
 * gönderilmez. (Yazma için gelecekte açık izin + onay akışı gerekir.)
 */

const CHATS_PAGE_SIZE = 50;
const MESSAGES_PAGE_SIZE = 50;
const DEFAULT_MAX_CHATS = 500;
const DEFAULT_MAX_MESSAGE_PAGES = 40;
const INTER_PAGE_DELAY_MS = 150;

export type ChatPlaceSyncMode = "backfill" | "incremental";

export type ChatPlaceSyncOptions = {
  mode: ChatPlaceSyncMode;
  /** Güvenlik üst sınırı: tek çalıştırmada işlenecek chat sayısı. */
  maxChats?: number;
  /** Chat başına en fazla mesaj sayfası (backfill koruması). */
  maxMessagePagesPerChat?: number;
};

export type ChatPlaceSyncResult = {
  status: "success" | "partial" | "skipped";
  mode: ChatPlaceSyncMode;
  chatsScanned: number;
  chatsSynced: number;
  messagesImported: number;
  messagesSkipped: number;
  errors: string[];
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tek chat'in mesaj geçmişini sayfa sayfa içeri alır.
 * Incremental modda bilinen bir mesaja rastlanan sayfadan sonra durur.
 */
async function syncChatMessages(
  supabase: TypedSupabaseClient,
  client: ChatPlaceMcpClient,
  params: {
    chat: ChatPlaceChat;
    conversationId: string;
    contactId: string;
    mode: ChatPlaceSyncMode;
    maxPages: number;
  }
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;
  let newestOccurredAt: string | null = null;
  let latestInboundContent: string | null = null;
  let latestInboundAt: string | null = null;

  for (let page = 1; page <= params.maxPages; page++) {
    if (page > 1) await sleep(INTER_PAGE_DELAY_MS);

    const raw = await client.callToolJson("chats_messages", {
      chatId: params.chat.id,
      page,
      limit: MESSAGES_PAGE_SIZE,
    });
    const messages = chatPlaceMessagesSchema.parse(raw);
    if (messages.length === 0) break;

    let knownOnThisPage = 0;

    for (const msg of messages) {
      const content = stripChatPlaceHtml(msg.message ?? "");
      const occurredAt = unixSecondsToIso(msg.createdAt);
      const { direction, senderType } = mapChatPlaceSide(msg.side);

      // 1) Sert dedupe: dış mesaj id'si zaten kayıtlıysa atla.
      const byExternalId = await findMessageByExternalId(
        supabase,
        params.conversationId,
        msg.id
      );
      if (byExternalId) {
        skipped++;
        knownOnThisPage++;
        continue;
      }

      // 2) Yumuşak dedupe: webhook üretilmiş-UUID ile yazmış olabilir —
      //    aynı yön + birebir içerik + ±3 dk penceresi.
      if (content) {
        const similar = await findSimilarMessage(supabase, {
          conversationId: params.conversationId,
          direction,
          content,
          occurredAt,
        });
        if (similar) {
          skipped++;
          knownOnThisPage++;
          continue;
        }
      }

      await insertSyncedMessage(supabase, {
        conversationId: params.conversationId,
        externalMessageId: msg.id,
        direction,
        senderType,
        content: content || null,
        occurredAt,
        rawPayload: {
          source: "chatplace_mcp",
          chatplace_chat_id: params.chat.id,
          chatplace_side: msg.side,
        } as Json,
      });
      imported++;
      if (!newestOccurredAt || occurredAt > newestOccurredAt) {
        newestOccurredAt = occurredAt;
      }
      if (direction === "inbound" && content) {
        if (!latestInboundAt || occurredAt > latestInboundAt) {
          latestInboundAt = occurredAt;
          latestInboundContent = content;
        }
      }
    }

    // Sayfa tamamen bilinen mesajlardan oluşuyorsa gerisi de bilinir
    // (mesajlar yeniden eskiye sıralı) — incremental'da dur.
    if (params.mode === "incremental" && knownOnThisPage === messages.length) {
      break;
    }
    if (messages.length < MESSAGES_PAGE_SIZE) break;
  }

  if (newestOccurredAt) {
    await touchLastMessageAt(supabase, params.conversationId, newestOccurredAt);
  }

  // CRM / smart-sales dokunuşu (AI cevap YOK — docs/44 + docs/47 §1.4).
  // Backfill'te binlerce LLM çağrısı olmaması için yalnızca bu koşuda
  // yeni içe aktarılan en son inbound mesaj üzerinde bir kez çalışır.
  if (
    imported > 0 &&
    latestInboundContent &&
    params.contactId &&
    params.mode === "incremental"
  ) {
    try {
      await touchCustomerProfileFromMessage(supabase, {
        contactId: params.contactId,
        customerMessage: latestInboundContent,
      });
      await refreshSmartSalesProfile(supabase, {
        contactId: params.contactId,
        conversationId: params.conversationId,
        customerMessage: latestInboundContent,
      });
      await appendTimelineEvent(supabase, {
        contactId: params.contactId,
        conversationId: params.conversationId,
        eventType: "customer_message",
        title: "Senkron mesaj (CRM güncellendi)",
        body: latestInboundContent.slice(0, 180),
        actorType: "system",
      });
    } catch (crmError) {
      console.error(
        "[chatplace-sync] CRM dokunuşu hatası:",
        crmError instanceof Error ? crmError.message : "bilinmeyen"
      );
    }
  }

  return { imported, skipped };
}

/**
 * Ana senkronizasyon: chat listesini keyset sayfalama ile gezer,
 * contact + conversation bul-veya-oluşturur, mesajları idempotent yazar.
 */
export async function syncChatPlaceConversations(
  supabase: TypedSupabaseClient,
  options: ChatPlaceSyncOptions
): Promise<ChatPlaceSyncResult> {
  const result: ChatPlaceSyncResult = {
    status: "success",
    mode: options.mode,
    chatsScanned: 0,
    chatsSynced: 0,
    messagesImported: 0,
    messagesSkipped: 0,
    errors: [],
  };

  if (!isChatPlaceMcpConfigured()) {
    result.status = "skipped";
    result.errors.push(
      "CHATPLACE_API_KEY / CHATPLACE_MCP_URL tanımlı değil; senkronizasyon atlandı."
    );
    return result;
  }

  const maxChats = options.maxChats ?? DEFAULT_MAX_CHATS;
  const maxPages = options.maxMessagePagesPerChat ?? DEFAULT_MAX_MESSAGE_PAGES;
  const client = new ChatPlaceMcpClient();
  const logId = await startSyncLog(supabase, "other", "chatplace_mcp").catch(
    () => null
  );

  let lastItemId: string | undefined;
  let lastItemTimestamp: number | undefined;
  let stop = false;

  try {
    while (!stop && result.chatsScanned < maxChats) {
      const rawList = await client.callToolJson("chats_list", {
        limit: CHATS_PAGE_SIZE,
        ...(lastItemId ? { lastItemId } : {}),
        ...(lastItemTimestamp ? { lastItemTimestamp } : {}),
      });
      const list = chatPlaceChatsListSchema.parse(rawList);
      if (list.items.length === 0) break;

      for (const chat of list.items) {
        if (result.chatsScanned >= maxChats) {
          stop = true;
          break;
        }
        result.chatsScanned++;

        try {
          const existing = await findConversationByExternalId(
            supabase,
            "instagram",
            chat.id
          );

          if (options.mode === "incremental" && existing) {
            // Farklı ISO biçimleri (+00:00 vs .000Z) string olarak
            // karşılaştırılamaz; epoch milisaniyesi üzerinden kıyaslanır.
            const knownLastMs = existing.last_message_at
              ? new Date(existing.last_message_at).getTime()
              : 0;
            const chatLastMs = chat.lastMessageAt * 1000;
            if (knownLastMs >= chatLastMs) {
              // Liste azalan sıralı: bundan sonrası da güncel demektir.
              stop = true;
              break;
            }
          }

          // Yeni konuşmada username için detay çek (tek ek istek).
          let username: string | undefined;
          if (!existing) {
            try {
              const detailRaw = await client.callToolJson("chats_get", {
                chatId: chat.id,
              });
              const detail = chatPlaceChatDetailSchema.parse(detailRaw);
              username = detail.username?.trim() || undefined;
            } catch {
              // username opsiyonel; detay hatası senkronu durdurmaz.
            }
          }

          const contact = await findOrCreateContactByInstagramUserId(
            supabase,
            {
              instagramUserId: chat.clientId,
              username,
              fullName: chat.clientName?.trim() || undefined,
            }
          );

          const conversation =
            existing ??
            (await findOrCreateConversation(supabase, {
              contactId: contact.id,
              channel: "instagram",
              externalConversationId: chat.id,
            }));

          const { imported, skipped } = await syncChatMessages(
            supabase,
            client,
            {
              chat,
              conversationId: conversation.id,
              contactId: contact.id,
              mode: options.mode,
              maxPages,
            }
          );

          result.messagesImported += imported;
          result.messagesSkipped += skipped;

          if (imported > 0) {
            result.chatsSynced++;
            // Müşteri zaman çizelgesine tek özet olay (mesaj başına değil).
            try {
              await appendTimelineEvent(supabase, {
                contactId: contact.id,
                conversationId: conversation.id,
                eventType: "chatplace_sync",
                title: "ChatPlace geçmişi senkronize edildi",
                body: `${imported} mesaj içe aktarıldı.`,
                actorType: "system",
              });
            } catch {
              // timeline opsiyonel
            }
          }
        } catch (chatError) {
          // Tek chat hatası tüm senkronu durdurmaz.
          const message =
            chatError instanceof ChatPlaceMcpError
              ? chatError.message
              : "Chat işlenemedi.";
          result.errors.push(`chat ${chat.id.slice(0, 8)}…: ${message}`);
          result.status = "partial";
        }
      }

      if (!list.hasNextItems) break;
      lastItemId = list.lastItemId ?? undefined;
      lastItemTimestamp = list.lastItemTimestamp
        ? Number(list.lastItemTimestamp)
        : undefined;
      await sleep(INTER_PAGE_DELAY_MS);
    }
  } catch (error) {
    const message =
      error instanceof ChatPlaceMcpError
        ? error.message
        : "ChatPlace MCP senkronizasyon hatası.";
    result.errors.push(message);
    result.status = "partial";
  }

  if (logId) {
    await finishSyncLog(supabase, logId, {
      status: result.status === "skipped" ? "skipped" : result.status,
      records: result.messagesImported,
      error: result.errors.length > 0 ? result.errors.join(" | ") : null,
      metadata: {
        mode: result.mode,
        chats_scanned: result.chatsScanned,
        chats_synced: result.chatsSynced,
        messages_skipped: result.messagesSkipped,
      } as Json,
    }).catch(() => undefined);
  }

  return result;
}

/**
 * Envanter okuma (salt okuma): bot, etiket, değişken ve otomasyon sayıları.
 * Entegrasyon sayfası/raporlar için; izin yoksa ilgili alan null döner.
 */
export type ChatPlaceInventory = {
  bots: number | null;
  tags: number | null;
  variables: number | null;
  automations: number | null;
};

export async function readChatPlaceInventory(): Promise<ChatPlaceInventory> {
  const inventory: ChatPlaceInventory = {
    bots: null,
    tags: null,
    variables: null,
    automations: null,
  };
  if (!isChatPlaceMcpConfigured()) return inventory;

  const client = new ChatPlaceMcpClient();

  const countOf = (value: unknown): number | null => {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") {
      const obj = value as { items?: unknown[] };
      if (Array.isArray(obj.items)) return obj.items.length;
    }
    return null;
  };

  try {
    const bots = await client.callToolJson("bots_list", {});
    inventory.bots = countOf(bots);

    const botList = Array.isArray(bots) ? (bots as Array<{ id?: string }>) : [];
    const firstBotId = botList[0]?.id;
    if (firstBotId) {
      try {
        const automations = await client.callToolJson("automations_list", {
          botId: firstBotId,
        });
        inventory.automations = countOf(automations);
      } catch {
        // izin yoksa null kalır
      }
    }
  } catch {
    // bots okunamazsa diğerlerini yine dene
  }

  try {
    inventory.tags = countOf(await client.callToolJson("tags_list", {}));
  } catch {
    // izin yoksa null kalır
  }

  try {
    inventory.variables = countOf(
      await client.callToolJson("variables_list", {})
    );
  } catch {
    // izin yoksa null kalır
  }

  return inventory;
}

/**
 * Inbox'tan tek konuşma için ChatPlace mesajlarını zorla çek.
 * Webhook boş/yanlış metin getirdiyse gerçek DM'leri MCP'den tamamlar.
 */
export async function syncChatPlaceMessagesForConversation(
  supabase: TypedSupabaseClient,
  conversationId: string
): Promise<{
  imported: number;
  skipped: number;
  status: "success" | "skipped" | "error";
  message: string;
}> {
  if (!isChatPlaceMcpConfigured()) {
    return {
      imported: 0,
      skipped: 0,
      status: "skipped",
      message: "ChatPlace MCP yapılandırılmamış.",
    };
  }

  const conversation = await getConversationById(supabase, conversationId);
  if (!conversation) {
    return {
      imported: 0,
      skipped: 0,
      status: "error",
      message: "Konuşma bulunamadı.",
    };
  }

  const contact = conversation.contact_id
    ? await getContactById(supabase, conversation.contact_id)
    : null;
  const clientId = contact?.instagram_user_id?.trim() || null;
  const client = new ChatPlaceMcpClient();

  let chat: ChatPlaceChat | null = null;

  // 1) external id = chat.id ise doğrula
  if (conversation.external_conversation_id) {
    try {
      const detailRaw = await client.callToolJson("chats_get", {
        chatId: conversation.external_conversation_id,
      });
      chat = chatPlaceChatDetailSchema.parse(detailRaw);
    } catch {
      chat = null;
    }
  }

  // 2) clientId ile listeden bul
  if (!chat && clientId) {
    let lastItemId: string | undefined;
    let lastItemTimestamp: number | undefined;
    for (let page = 0; page < 20 && !chat; page++) {
      if (page > 0) await sleep(INTER_PAGE_DELAY_MS);
      const rawList = await client.callToolJson("chats_list", {
        limit: CHATS_PAGE_SIZE,
        ...(lastItemId ? { lastItemId } : {}),
        ...(lastItemTimestamp ? { lastItemTimestamp } : {}),
      });
      const list = chatPlaceChatsListSchema.parse(rawList);
      chat =
        list.items.find((item) => item.clientId === clientId) ?? null;
      if (chat || !list.hasNextItems || list.items.length === 0) break;
      lastItemId = list.lastItemId ?? undefined;
      lastItemTimestamp =
        typeof list.lastItemTimestamp === "number"
          ? list.lastItemTimestamp
          : list.lastItemTimestamp
            ? Number(list.lastItemTimestamp)
            : undefined;
    }
  }

  if (!chat) {
    return {
      imported: 0,
      skipped: 0,
      status: "error",
      message:
        "ChatPlace'te bu konuşma bulunamadı (chat.id / clientId eşleşmedi).",
    };
  }

  if (!conversation.contact_id) {
    return {
      imported: 0,
      skipped: 0,
      status: "error",
      message: "Konuşmaya bağlı müşteri kaydı yok.",
    };
  }

  try {
    const { imported, skipped } = await syncChatMessages(supabase, client, {
      chat,
      conversationId: conversation.id,
      contactId: conversation.contact_id,
      mode: "backfill",
      maxPages: DEFAULT_MAX_MESSAGE_PAGES,
    });
    return {
      imported,
      skipped,
      status: "success",
      message:
        imported > 0
          ? `${imported} mesaj çekildi.`
          : skipped > 0
            ? "Yeni mesaj yok; mevcut kayıtlar güncel."
            : "ChatPlace'te mesaj bulunamadı.",
    };
  } catch (error) {
    const msg =
      error instanceof ChatPlaceMcpError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Senkron hatası.";
    return {
      imported: 0,
      skipped: 0,
      status: "error",
      message: msg,
    };
  }
}
