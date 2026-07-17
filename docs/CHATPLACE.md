# ChatPlace Entegrasyonu

> **Durum:** Conversation Engine v1 + **gelen (inbound) webhook alımı**
> kuruldu. `app/api/chatplace/webhook/route.ts` gerçek webhook isteklerini
> imza doğrulaması, Zod doğrulama ve `webhook_events` kaydı ile işleyip
> `ingestInboundMessage` üzerinden Supabase'e yazar. ChatPlace'e **giden**
> (mesaj gönderme) gerçek API çağrısı hâlâ yapılmıyor (v1 kasıtlı sınırlaması).

## Webhook Endpoint (Gelen)

- **URL:** `POST /api/chatplace/webhook`
- **Runtime:** Node.js (imza doğrulaması `node:crypto` kullanır).
- **İmza:** `x-chatplace-signature` header'ı, ham gövdenin
  HMAC-SHA256'sı (`CHATPLACE_WEBHOOK_SECRET` ile). `sha256=<hex>` veya `<hex>`
  formatı kabul edilir; timing-safe karşılaştırılır
  (`src/server/webhooks/chatplace-signature.ts`).
- **Rate limiting:** IP başına best-effort in-memory limit
  (`src/server/rate-limit/`), 60 istek / 60 sn.
- **İşleyen kod:**
  - Route: `src/app/api/chatplace/webhook/route.ts` (ince katman: rate limit,
    imza, JSON parse).
  - Orkestrasyon: `src/features/conversations/services/chatplace-webhook.service.ts`.
  - Payload şeması + mapper: `src/features/conversations/validators/chatplace-webhook.ts`.
  - `webhook_events` kayıt: `src/features/integrations/repositories/webhook-events.repository.ts`.

### İşleme Adımları ve HTTP Kodları

| Durum | webhook_events.status | HTTP |
|---|---|---|
| Rate limit aşıldı | (kayıt yok) | 429 |
| İmza geçersiz/eksik | (kayıt yok — DoS/flood önleme) | 401 |
| Geçersiz JSON | (kayıt yok) | 400 |
| Zod doğrulama başarısız | `failed` | 400 |
| Gelen mesaj olayı değil | `ignored` | 200 |
| Duplicate (external_message_id mevcut) | `ignored` | 200 |
| Başarıyla işlendi | `processed` | 200 |
| Beklenmeyen işleme hatası | `failed` | 500 |

### Varsayılan Payload Sözleşmesi

Gerçek ChatPlace dokümanı elde edilene kadar makul, genel bir mesajlaşma
webhook sözleşmesi varsayılmıştır (yalnızca `chatplace-webhook.ts` içindeki
şema + mapper değiştirilerek uyarlanır):

```json
{
  "event": "message.received",
  "conversation": { "id": "<external_conversation_id>", "channel": "instagram|facebook" },
  "contact": { "id": "<instagram_user_id>", "username": "...", "full_name": "..." },
  "message": { "id": "<external_message_id>", "type": "text", "text": "...", "timestamp": "ISO-8601" }
}
```

İşlenen olay tipleri: `message.received`, `message.created`. Diğerleri
`ignored` olarak kaydedilir (mesaj üretmez).

### Local Test

Örnek payload'lar `scripts/chatplace-payloads/` altındadır; imzayı otomatik
hesaplayıp gönderen yardımcı:

```bash
npm run dev                              # ayrı terminalde
npm run webhook:send                     # message-text (geçerli imza)
npm run webhook:send -- message-image
npm run webhook:send -- duplicate        # ignored (dedup)
npm run webhook:send -- invalid          # 400 (zod)
npm run webhook:send -- message-text --bad-sign   # 401
npm run webhook:send -- message-text --no-sign    # 401
```

## Amaç

ChatPlace, Redmedia'nın müşteri konuşma otomasyonlarını yürüttüğü platformdur.
Panel, ChatPlace üzerinden yürüyen konuşmaları görüntülemek, müşteri geçmişini
(hafızasını) saklamak ve gerektiğinde AI destekli cevap süreçlerini bu
konuşmalarla ilişkilendirmek için ChatPlace ile entegre olacaktır.

## Mesaj Akışı (Uçtan Uca Karar)

**Gelen mesaj (ChatPlace → biz, henüz bağlanmadı):**

1. ChatPlace bir webhook isteği gönderir → planlanan `app/api/chatplace/webhook/route.ts`.
2. İstek imza/secret ile **doğrulanır** (`.cursor/rules/02-security.mdc`); doğrulanamayan istek reddedilir ve işlenmez.
3. Ham olay, işlenmeden önce `webhook_events`'e yazılır (`status='received'`) — böylece işleme sırasında hata olsa da veri kaybolmaz.
4. Gövde Zod ile doğrulanır.
5. `contacts`: `instagram_user_id` ile bul-veya-oluştur (bkz. `features/contacts/repositories/contacts.repository.ts` → `findOrCreateContactByInstagramUserId`).
6. `conversations`: `channel` + `external_conversation_id` ile bul-veya-oluştur (bkz. `features/conversations/repositories/conversations.repository.ts` → `findOrCreateConversation`).
7. `messages`: `external_message_id` ile **tekrar kontrolü** yapılır; yeni ise `direction=inbound, sender_type=customer` olarak eklenir.
8. `conversations.last_message_at`, **geriye alınmayacak şekilde** (`GREATEST(mevcut, yeni)`) güncellenir.
9. `webhook_events.status='processed'` olarak işaretlenir.
10. Gerekiyorsa AI modülü tetiklenir (bkz. `docs/AI.md`).

Bu akışın **5-8. adımları v1'de gerçek implementasyonu ile hazır**
(`features/conversations/services/conversations.service.ts` → `ingestInboundMessage`),
ve artık **gerçek webhook isteği** (`POST /api/chatplace/webhook`) tarafından
da tetikleniyor (bkz. üstteki "Webhook Endpoint" bölümü). Development'ta
`scripts/seed-conversations.ts` de aynı fonksiyonu kullanır.

**Giden mesaj (personel panelden yazıyor, v1 — ChatPlace'e gönderilmiyor):**

`features/conversations/services/conversations.service.ts` → `sendStaffMessage`,
`messages` tablosuna `direction=outbound, sender_type=staff` olarak kayıt
atar ve `conversations.last_message_at`'i günceller. **ChatPlace'in "mesaj
gönder" API'si v1'de çağrılmaz** — bu nedenle v1'de panelden yazılan bir
cevap gerçek müşteriye ulaşmaz, yalnızca panel içinde görünür kalır. Bu,
gerçek ChatPlace bağlantısı kurulana kadar bilinçli bir sınırlamadır.

## Tekrar Önleme (Idempotency)

- **Birincil mekanizma:** `messages` tablosunda `(conversation_id, external_message_id)` üzerinde kısmi unique index — aynı mesaj tekrar gelirse INSERT çakışır, handler "zaten var" olarak ele alır ve yeni satır oluşturmaz.
- **Bul-veya-oluştur:** `contacts` ve `conversations` için kör INSERT yerine doğal dış kimlikle eşleştirme yapılır; retry'lar yinelenen satır üretmez.
- **Giden mesajlarda:** panelde gönder butonu istek bitene kadar devre dışı bırakılır (çift gönderim koruması).

## Kronoloji

- Birincil sıralama `messages.created_at` (Postgres mikrosaniye hassasiyeti, pratikte yeterli).
- `conversations.last_message_at`, körü körüne üzerine yazılmaz; `GREATEST(mevcut, yeni)` mantığıyla güncellenir — geciken/sıra dışı bir mesaj konuşmanın "son aktivite" zamanını geriye almaz.
- İleride doğruluk kritikleşirse, sağlayıcının kendi zaman damgasından türetilen ayrı bir `occurred_at` kolonu eklenebilir (şema değişikliği gerektirir, v1'de yapılmadı).

## Güvenlik Notları

- Webhook secret/imza doğrulaması zorunludur ve uygulandı (HMAC-SHA256, timing-safe).
- Endpoint'te rate limiting uygulandı (best-effort in-memory; üretimde paylaşımlı depoya geçirilmeli).
- Gelen mesaj içeriği (hassas müşteri verisi) loglanmaz; hata durumunda yalnızca kısa, içeriksiz özet `webhook_events.error_message`'a yazılır.
- `CHATPLACE_WEBHOOK_SECRET` yalnızca sunucu tarafında okunur, `NEXT_PUBLIC_` öneki almaz, asla loglanmaz.
- Service role yalnızca sunucu tarafında (Route Handler, Server Action) kullanılır — bkz. `docs/DATABASE.md` RLS notu.

## Kapsam (v1 — Tamamlandı)

- `contacts` / `conversations` / `messages` / `webhook_events` şemasını kullanan repository + service katmanı.
- **Gelen ChatPlace webhook alımı** (`POST /api/chatplace/webhook`): imza doğrulama, Zod, `webhook_events` kaydı, `ingestInboundMessage`, duplicate/hata durumlarının izlenmesi.
- Inbox ekranı: konuşma listesi, arama (müşteri adı, Instagram kullanıcı adı, mesaj içeriği), durum filtresi (tümü/açık/bekleyen/kapalı), konuşma detayı, durum değiştirme, personele atama/atamayı kaldırma, personel mesaj yazma (yalnızca veritabanına kayıt).
- Development-only script'ler: `scripts/seed-conversations.ts`, `scripts/send-chatplace-webhook.ts`.

## Kapsam Dışı (v1)

- Gerçek ChatPlace "mesaj gönder" (giden) API çağrısı.
- ChatPlace tarafındaki otomasyon akışının panelden düzenlenmesi.
- Webhook için kalıcı/dağıtık rate limiting (şu an in-memory best-effort).

Gerçek entegrasyon başladığında bu belge; kullanılan endpoint'ler, webhook
event tipleri ve hata senaryolarıyla güncellenecektir.
