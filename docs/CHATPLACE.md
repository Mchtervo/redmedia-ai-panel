# ChatPlace Entegrasyonu

> **Durum:** Henüz bağlanmadı. Bu belge entegrasyon planını tanımlar; canlı
> bağlantı, API anahtarı veya kod içermez.

## Amaç

ChatPlace, Redmedia'nın müşteri konuşma otomasyonlarını yürüttüğü platformdur.
Panel, ChatPlace üzerinden yürüyen konuşmaları görüntülemek, müşteri geçmişini
(hafızasını) saklamak ve gerektiğinde AI destekli cevap süreçlerini bu
konuşmalarla ilişkilendirmek için ChatPlace ile entegre olacaktır.

## Planlanan Akış

1. ChatPlace'te bir müşteri mesajı/olayı gerçekleştiğinde, ChatPlace bir
   **webhook** isteği gönderir.
2. İstek, panelin `api/chatplace/webhook` (planlanan) Route Handler'ına
   ulaşır.
3. İstek önce **doğrulanır** (imza/secret kontrolü) —
   bkz. `.cursor/rules/02-security.mdc`. Doğrulanamayan istek reddedilir.
4. Gövde Zod şemasıyla doğrulanır.
5. Konuşma/mesaj verisi Supabase'e yazılır (müşteri hafızası burada oluşur).
6. Gerekiyorsa AI modülü tetiklenir (bkz. `docs/AI.md` ve
   `.cursor/rules/04-ai-behavior.mdc` — fiyat/hizmet/insan onayı sınırları
   burada da geçerlidir).

## Güvenlik Notları

- Webhook secret/imza doğrulaması zorunludur.
- Endpoint'te rate limiting uygulanır.
- Gelen mesaj içeriği (hassas müşteri verisi) loglanmaz; yalnızca ilişkili
  kayıt ID'si loglanabilir.

## Kapsam (v1)

- Konuşma/mesaj senkronizasyonu.
- Müşteri hafızasının Supabase'de saklanması.
- AI cevap üretimi tetikleyicisi (insan onayı gereken durumlar hariç,
  `.cursor/rules/04-ai-behavior.mdc`).

## Kapsam Dışı (v1)

- ChatPlace tarafındaki otomasyon akışının panelden düzenlenmesi (yalnızca
  görüntüleme/analiz; akış düzenleme ileride değerlendirilebilir).

Gerçek entegrasyon başladığında bu belge; kullanılan endpoint'ler, webhook
event tipleri ve hata senaryolarıyla güncellenecektir.
