# Meta (Instagram / Facebook) Entegrasyonu

> **Durum:** Graph API okuma/senkron + kontrollü Ads yazma (Autopilot).

## Amaç

Meta reklamları, insights ve Instagram içeriklerini panelde görüntülemek;
Ads Manager hiyerarşisi ile KPI/kreatif/skor; isteğe bağlı Autopilot ile
sınırlı pause/bütçe uygulaması.

## Okuma

- Campaign / Ad Set / Ad / Creative / Insights / Instagram sync
- UI: `/dashboard/marketing/performance` (Ads Manager)
- Skor: İyi / Orta / Kötü (kural tabanlı; CPA, mesaj maliyeti, CTR)

## Yazma (kontrollü Autopilot)

Varsayılan **kapalı**. Açıkken AI motoru deterministik kurallarla:

- Kötü ACTIVE ad set → `PAUSED`
- İyi ACTIVE ad set → `daily_budget` artışı (max ±% env tavanı, varsayılan 20)
- Belirsiz / yetersiz harcama → dokunulmaz

**Zorunlu güvenlik rayları:**

1. `META_ADS_AUTOPILOT_ENABLED=true` (env kill-switch; default false)
2. UI kill-switch: `business_settings.settings.meta_ads_autopilot_ui_enabled`
   (Acil durdur → false)
3. İkisi de açık değilse yalnızca dry-run log (Meta’ya yazılmaz)
4. Günlük bütçe değişimi `META_ADS_AUTOPILOT_MAX_BUDGET_DELTA_PCT` ile sınırlı
5. `META_ADS_AUTOPILOT_MIN_SPEND_TRY` altında karar yok
6. Yalnızca ACTIVE/PAUSED (archived/deleted yok)
7. Her eylem `ad_action_logs` (before/after, reason, dry_run, success)
8. Token yoksa / sync tutarsızsa POST yok

UI: `/dashboard/marketing/autopilot`

**Bilinçli olarak sonraya:** yeni kampanya/kreatif oluşturma, lookalike,
Advantage+ migration, çoklu ad account.

## OAuth

- UI: `/dashboard/marketing/connections` → **Meta'ya Bağlan** / **Tekrar Yetkilendir**
- Scope: `ads_read`, `ads_management`, (+ mevcut page/instagram scope’ları)
- Yazma için kullanıcı **Tekrar Yetkilendir** ile `ads_management` almalı
- Başlat: `GET /api/meta/oauth/start` (oturum gerekli; local’de `DEV_BYPASS_AUTH`)
- Callback: `GET /api/meta/oauth/callback`
- Uzun ömürlü token `meta_oauth_tokens` (service role)
- `META_ACCESS_TOKEN` env **kullanılmaz**

## Sync

| Tür | Servis |
|-----|--------|
| Campaigns / AdSets / Ads / Creatives | `meta-ads-sync.service` |
| Insights | `meta-insights-sync.service` |
| Instagram | `meta-instagram-sync.service` |
| Autopilot (sync sonrası) | `ads-autopilot.service` |

Manuel: `/dashboard/marketing/connections`  
Otomatik: `GET /api/cron/meta-sync` + `Authorization: Bearer CRON_SECRET`  
(cron sonunda autopilot çalışır; silahlı değilse dry-run)

## Conversions API (CAPI)

- Token: Events Manager Pixel/Dataset CAPI token (`META_CAPI_ACCESS_TOKEN`).
- `META_ACCESS_TOKEN` ile karıştırılmaz.
- `META_CAPI_TEST_EVENT_CODE` yoksa olay gönderilmez.

## Env

Bkz. `.env.example` Meta + Autopilot bölümü. Secret frontend'e gitmez.

## Migration

- `20260717000022_meta_oauth_tokens.sql`
- `20260717000023_meta_connection_configured_status.sql`
- `20260724000001_ad_action_logs.sql`
