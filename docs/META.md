# Meta (Instagram / Facebook) Entegrasyonu

> **Durum:** Canlı Graph API entegrasyonu aktif (okuma + senkron).

## Amaç

Meta reklamları, insights ve Instagram içeriklerini panelde görüntülemek;
AI yalnızca analiz/öneri üretir.

## v1 Sınırları

- Reklamlar otomatik kapatılmaz / bütçe değiştirilmez.
- AI yalnızca öneri üretir.

## OAuth

- UI: `/dashboard/marketing/connections` → **Meta'ya Bağlan** / **Tekrar Yetkilendir**
- Başlat: `GET /api/meta/oauth/start` (oturum gerekli)
- Callback: `GET /api/meta/oauth/callback`
- Uzun ömürlü token `meta_oauth_tokens` tablosunda (service role).
- Yeni token kaydı eski aktif satırları `is_active=false` yapar.
- `META_ACCESS_TOKEN` env **kullanılmaz**; tüm Graph çağrıları DB OAuth tokenı ile.
- Connection Health: 🟢 Bağlı · 🟡 Süresi Doluyor · 🔴 Yetkilendirme Gerekli

## Sync

| Tür | Servis |
|-----|--------|
| Campaigns / AdSets / Ads / Creatives | `meta-ads-sync.service` |
| Insights | `meta-insights-sync.service` |
| Instagram | `meta-instagram-sync.service` |

Manuel: `/dashboard/marketing/connections`  
Otomatik: `GET /api/cron/meta-sync` + `Authorization: Bearer CRON_SECRET`

## Conversions API (CAPI)

- Token: Events Manager Pixel/Dataset CAPI token (`META_CAPI_ACCESS_TOKEN`).
- `META_ACCESS_TOKEN` ile karıştırılmaz; `/debug_token` kullanılmaz.
- Test: `POST /{META_PIXEL_ID}/events` + `Authorization: Bearer …`
- `META_CAPI_TEST_EVENT_CODE` yoksa olay gönderilmez → durum
  **Yapılandırıldı, henüz olayla doğrulanmadı**.
- Test kodu varsa güvenli `PageView` (`test_event_code`) gönderilir → **Bağlı**.

## Env

Bkz. `.env.example` Meta bölümü. Secret frontend'e gitmez.

## Migration

- `20260717000022_meta_oauth_tokens.sql`
- `20260717000023_meta_connection_configured_status.sql`
