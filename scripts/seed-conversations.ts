/**
 * Development-only seed script — Conversation Engine (Inbox) test verisi.
 *
 * GÜVENLİK: Bu script `NODE_ENV === "production"` olduğunda ÇALIŞMAZ
 * (bkz. .cursor/rules/02-security.mdc, 00-project.mdc). Service role
 * yalnızca burada, sunucu/araç tarafında (Node script, tarayıcı değil)
 * kullanılır (bkz. `@/server/supabase/admin`).
 *
 * Gerçek müşteri verisi İÇERMEZ — yalnızca "Demo Müşteri" adlı, açıkça
 * sahte kayıtlar oluşturur.
 *
 * Kullanım:
 *   npm run seed:conversations
 */

import { createAdminClient } from "@/server/supabase/admin";
import {
  ingestInboundMessage,
  sendStaffMessage,
} from "@/features/conversations/services/conversations.service";

const DEMO_INSTAGRAM_IDS = ["demo_musteri_1", "demo_musteri_2", "demo_musteri_3"] as const;

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[seed-conversations] REDDEDILDI: NODE_ENV=production ortamında seed script çalıştırılamaz."
    );
    process.exit(1);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "[seed-conversations] HATA: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY .env.local içinde tanımlı değil."
    );
    process.exit(1);
  }

  const supabase = createAdminClient();

  console.log("[seed-conversations] Önceki demo verisi temizleniyor…");
  const { error: cleanupError } = await supabase
    .from("contacts")
    .delete()
    .in("instagram_user_id", [...DEMO_INSTAGRAM_IDS]);

  if (cleanupError) {
    throw cleanupError;
  }

  // --- Demo Müşteri 1: açık konuşma, müşteri + personel karşılıklı ---
  console.log("[seed-conversations] Demo Müşteri 1 (açık) oluşturuluyor…");
  const ingest1a = await ingestInboundMessage(supabase, {
    channel: "instagram",
    externalConversationId: "seed-conv-1",
    contact: {
      instagramUserId: "demo_musteri_1",
      username: "demo_musteri_1",
      fullName: "Demo Müşteri Bir",
    },
    externalMessageId: "seed-msg-1a",
    content: "Merhaba, düğün paketleriniz hakkında bilgi alabilir miyim?",
    occurredAt: hoursAgo(3),
    source: "seed",
  });
  await sendStaffMessage(supabase, {
    conversationId: ingest1a.message.conversation_id,
    content: "Merhaba! Elbette, size hemen paket detaylarımızı paylaşayım.",
    source: "seed",
  });
  await ingestInboundMessage(supabase, {
    channel: "instagram",
    externalConversationId: "seed-conv-1",
    contact: { instagramUserId: "demo_musteri_1" },
    externalMessageId: "seed-msg-1b",
    content: "Teşekkürler, bekliyorum.",
    occurredAt: hoursAgo(1),
    source: "seed",
  });

  // --- Demo Müşteri 2: bekleyen konuşma, sadece müşteri mesajları ---
  console.log("[seed-conversations] Demo Müşteri 2 (bekleyen) oluşturuluyor…");
  await ingestInboundMessage(supabase, {
    channel: "instagram",
    externalConversationId: "seed-conv-2",
    contact: {
      instagramUserId: "demo_musteri_2",
      username: "demo_musteri_2",
      fullName: "Demo Müşteri İki",
    },
    externalMessageId: "seed-msg-2a",
    content: "İndirim yapabilir misiniz?",
    occurredAt: hoursAgo(5),
    source: "seed",
  });
  const ingest2b = await ingestInboundMessage(supabase, {
    channel: "instagram",
    externalConversationId: "seed-conv-2",
    contact: { instagramUserId: "demo_musteri_2" },
    externalMessageId: "seed-msg-2b",
    content: "Cevap bekliyorum, ilginizi rica ederim.",
    occurredAt: hoursAgo(4),
    initialStatus: "pending",
    source: "seed",
  });
  await supabase
    .from("conversations")
    .update({ status: "pending" })
    .eq("id", ingest2b.message.conversation_id);

  // --- Demo Müşteri 3: kapalı konuşma, tam akış (müşteri/personel/AI/sistem) ---
  console.log("[seed-conversations] Demo Müşteri 3 (kapalı) oluşturuluyor…");
  const ingest3a = await ingestInboundMessage(supabase, {
    channel: "facebook",
    externalConversationId: "seed-conv-3",
    contact: {
      instagramUserId: "demo_musteri_3",
      username: "demo_musteri_3",
      fullName: "Demo Müşteri Üç",
    },
    externalMessageId: "seed-msg-3a",
    content: "Rezervasyonum onaylandı mı?",
    occurredAt: hoursAgo(30),
    source: "seed",
  });
  const conversationId3 = ingest3a.message.conversation_id;

  // Not: `ai`/`system` gönderen tipleri için henüz bir servis fonksiyonu
  // yok (OpenAI bağlanmadı, bkz. docs/AI.md); UI çeşitliliğini test etmek
  // için burada doğrudan (seed'e özel) eklenir.
  await supabase.from("messages").insert([
    {
      conversation_id: conversationId3,
      direction: "outbound",
      sender_type: "ai",
      message_type: "text",
      source: "seed",
      content: "Merhaba! Rezervasyon durumunuzu hemen kontrol ediyorum.",
      raw_payload: { source: "seed" },
      created_at: hoursAgo(29),
    },
    {
      conversation_id: conversationId3,
      direction: "outbound",
      sender_type: "system",
      message_type: "text",
      source: "seed",
      content: "Konuşma personel tarafından kapatıldı.",
      raw_payload: { source: "seed" },
      created_at: hoursAgo(28),
    },
  ]);

  await sendStaffMessage(supabase, {
    conversationId: conversationId3,
    content: "Evet, rezervasyonunuz onaylandı. İyi günler dileriz!",
    source: "seed",
  });

  await supabase
    .from("conversations")
    .update({ status: "closed" })
    .eq("id", conversationId3);

  console.log("[seed-conversations] Tamamlandı: 3 müşteri, 3 konuşma, birkaç mesaj oluşturuldu.");
  console.log("[seed-conversations] Temizlemek için aynı script'i tekrar çalıştırabilirsiniz (önce eskiyi siler).");
}

main()
  .catch((error) => {
    console.error("[seed-conversations] HATA:", error);
    process.exit(1);
  })
  .then(() => process.exit(0));
