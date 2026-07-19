# 44 — ChatPlace MCP Entegrasyonu

Sürüm 1.0 · Durum: **Uygulandı (salt okuma)** · Son güncelleme: 2026-07-18

Bu doküman gerçek uygulamayı anlatır; kod ile çelişirse kod esas alınır.

---

## Amaç

ChatPlace'te biriken Instagram konuşma geçmişini (mesajlar, kişiler) MCP
(Model Context Protocol) üzerinden **salt okuma** ile panele senkronize etmek
ve mevcut CRM / AI hafızası / öğrenme hatlarına beslemek.

## Mimari

```
ChatPlace MCP (https://mcp.chatplace.io/mcp)
        │  JSON-RPC 2.0 (Streamable HTTP) + Bearer auth
        ▼
src/server/chatplace/mcp-client.ts        ← tek çıkış noktası (yalnız sunucu)
        ▼
src/features/conversations/services/chatplace-sync.service.ts
        ▼
contacts / conversations / messages / customer_timeline_events (Supabase)
        ▼
Mevcut hatlar: conversation learning, AI Memory, CRM, Smart Sales
```

- **İstemci** (`mcp-client.ts`): `initialize` → `notifications/initialized` →
  `tools/list` / `tools/call`. Oturum `Mcp-Session-Id` header'ı ile korunur.
  Timeout (varsayılan 30 sn), 429/502/503/504 için üstel geri çekilmeli
  retry (2 deneme), SSE ve JSON cevap ayrıştırma, hata normalizasyonu
  (`ChatPlaceMcpError`).
- **Güvenlik**: `CHATPLACE_API_KEY` yalnızca sunucu tarafında okunur;
  Authorization header'ı hiçbir log/hata mesajına yazılmaz; istemci
  bileşenlerine hiçbir sır gönderilmez.
- **Yazma yok**: İstemci yalnızca okuma araçlarını çağırır. Mesaj gönderme /
  ChatPlace kaydı değiştirme bilinçli olarak uygulanmadı; ileride açık izin +
  onay akışı (Approval Engine) gerektirir.

## Environment değişkenleri (yalnız ad; değer asla dokümana yazılmaz)

| Değişken | Zorunluluk | Açıklama |
| --- | --- | --- |
| `CHATPLACE_API_KEY` | MCP senkronu için gerekli | Bearer token; yalnız `.env.local` |
| `CHATPLACE_MCP_URL` | MCP senkronu için gerekli | `https://mcp.chatplace.io/mcp` |
| `CHATPLACE_WEBHOOK_SECRET` | **Opsiyonel** | Yalnız inbound webhook HMAC doğrulaması |
| `CHATPLACE_WEBHOOK_TOKEN` | **Opsiyonel** | Yalnız inbound webhook statik token doğrulaması |

Webhook değişkenleri MCP salt okuma senkronizasyonu için **gerekmez**;
eksiklikleri startup'ı bozmaz (bkz. `src/lib/env.ts`). Kullanıldıkları tek
yer `src/app/api/chatplace/webhook/route.ts` →
`src/server/webhooks/chatplace-auth.ts` (HMAC **veya** statik token; ikisi de
geçersizse istek fail-closed reddedilir). Token'ı ChatPlace sağlamaz; panel
sahibi üretir (örn. yerelde `openssl rand -hex 32` veya
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`),
değeri `.env.local` içine ve ChatPlace External Request header'ına elle yazar.

## Keşfedilen MCP araçları (2026-07-18, `npm run chatplace:report`)

Toplam **50 araç**. Senkronizasyonda kullanılanlar:

| Araç | Kullanım |
| --- | --- |
| `chats_list` | Chat listesi; keyset sayfalama (`lastItemId` + `lastItemTimestamp`, `hasNextItems`) |
| `chats_get` | Chat detayı (`username` alanı için, yalnız yeni konuşmada) |
| `chats_messages` | Mesaj geçmişi; `page`/`limit` sayfalama |
| `bots_list`, `tags_list`, `variables_list`, `automations_list` | Envanter okuma (`readChatPlaceInventory`) |

Diğer araç grupları (kullanılmıyor, mevcut): `automations_*` (analitik,
şablonlar), `mailings_*`, `ai_agent_*` (bilgi tabanı, test), `virale_*`,
`products_*`, `comments_*`, `ref_links_*`, `media_files_list`.

**Eksik araçlar (API uydurulmadı, sınırlama olarak raporlanır):**

- Bağımsız bir "contacts_list" aracı yok — kişi bilgisi yalnız
  `chats_list/chats_get` içindeki `clientId`, `clientName`, `username`
  alanlarından gelir (telefon/e-posta alanı MCP'de sunulmuyor).
- Kişi başına etiket/değişken okuma aracı yok (`tags_list` yalnız şirket
  etiket kataloğunu döner).
- Mesaj gönderme aracı yok (salt okuma hedefi ile uyumlu).
- `chats_list` tarih filtresi sunmuyor; artımlı senkron panel tarafındaki
  `conversations.last_message_at` karşılaştırmasıyla yapılır.

## Veri eşlemesi

| ChatPlace | Panel |
| --- | --- |
| `chat.clientId` | `contacts.instagram_user_id` (bul-veya-oluştur) |
| `chat.clientName` | `contacts.full_name` |
| `chats_get.username` | `contacts.username` |
| `chat.id` | `conversations.external_conversation_id` (channel=instagram) |
| `message.id` | `messages.external_message_id` |
| `message.side` = `client` | `direction=inbound`, `sender_type=customer` |
| `message.side` = `bot` | `direction=outbound`, `sender_type=ai` |
| diğer `side` değerleri | `direction=outbound`, `sender_type=staff` |
| `message.createdAt` (unix sn) | `messages.created_at` (**orijinal zaman korunur**) |
| `message.message` (HTML olabilir) | `messages.content` (etiketler temizlenir) |

Her senkronlanan mesajın `raw_payload`'ına
`{ source: "chatplace_mcp", chatplace_chat_id, chatplace_side }` yazılır.

## Çifte kayıt önleme (idempotency)

1. **Sert dedupe**: aynı konuşmada aynı `external_message_id` varsa atlanır.
2. **Yumuşak dedupe**: webhook'tan üretilmiş-UUID ile yazılmış kayıtlar için
   aynı yön + birebir içerik + ±3 dk zaman penceresi eşleşirse atlanır
   (`findSimilarMessage`).

Doğrulama: backfill iki kez çalıştırıldı — 2. çalıştırma 0 içe aktarma,
122 atlama (tam idempotent).

## İşler (jobs)

| İş | Tetikleme | Davranış |
| --- | --- | --- |
| İlk backfill | `npm run chatplace:backfill [maxChats]` (manuel) | Tüm chat listesi + erişilebilir mesaj geçmişi; idempotent, tekrar çalıştırılabilir |
| Artımlı senkron | `GET /api/cron/chatplace-sync` (Bearer `CRON_SECRET`) | Liste `lastMessageAt` azalan sıralı; paneldeki `last_message_at`'ten yeni aktivitesi olmayan chat'te durur |
| Keşif raporu | `npm run chatplace:report` (manuel) | Araç listesi/şema dökümü; sır yazdırmaz |

Backfill modu cron'dan da çağrılabilir: `?mode=backfill`.

Her çalıştırma `marketing_sync_logs` tablosuna
(`sync_type=other`, `api_endpoint_kind=chatplace_mcp`) loglanır.

## Mevcut hatlarla entegrasyon

- **contacts/conversations/messages**: webhook ile aynı bul-veya-oluştur
  deseni; aynı tablolar, aynı repository katmanı.
- **Customer timeline**: mesaj başına değil, senkron başına tek özet olay
  (`event_type=chatplace_sync`).
- **Conversation learning / AI Memory / CRM**: senkronlanan mesajlar aynı
  `messages` tablosuna orijinal zamanla yazıldığı için mevcut cron'lar
  (`/api/cron/conversation-learning`) ve analiz servisleri ek iş yapmadan
  bu geçmişi işler.
- **AI otomatik cevap tetiklenmez**: senkron geçmiş içe aktarımıdır; webhook
  akışındaki AI cevap üretimi bilinçli olarak çağrılmaz.

## Bilinen sınırlamalar

- Webhook `contact.id` / `conversation.id` değerleri ChatPlace akış
  yapılandırmasına bağlıdır; MCP `clientId`/`chat.id` ile birebir aynı
  olmayabilir. Yumuşak dedupe bu durumda mesaj kopyasını engeller, ancak
  webhook farklı id gönderiyorsa aynı müşteri için ikinci contact kaydı
  oluşabilir (izlenmeli).
- `chats_messages` yalnız ChatPlace'in sakladığı geçmişi döner; ChatPlace
  öncesi Instagram geçmişi erişilebilir değildir.
- Sayfa başına bekleme (150 ms) + istek başına retry ile hız sınırına
  saygı gösterilir; büyük hesaplarda tam backfill uzun sürebilir.
- Kanal `instagram` varsayılır (bots_list'te tek Instagram botu var);
  ChatPlace çok kanallı hale gelirse eşleme genişletilmeli.

## Testler

- `npm run test:chatplace` — Bearer header kurulumu, sır sızmaması,
  cursor sayfalama, 429 retry, kalıcı hatada retry yapılmaması, bozuk MCP
  cevabı, araç hatası, SSE ayrıştırma, boş sonuç; ayrıca HTML temizleme,
  zaman dönüşümü, yön eşlemesi.
