# Modül 9 — AI Attribution Engine

Marketing Director’u reklam analizinden **gerçek gelir analizine** dönüştürür.

## Kurallar

- Reklam ↔ müşteri eşleşmesi yalnızca doğrulanabilir sinyallerle **exact**.
- Doğrulanamayan eşleşme **Olası Kaynak (probable)** + güven %.
- Probable gelir ROI’ye dahil edilmez.
- Kampanya otomatik kapatılmaz / bütçe değiştirilmez.

## Funnel

`DM → Lead → Rezervasyon → Kapora → Çekim → Teslim → Gelir`

Tablo: `attribution_funnel_events`

## Rotalar

| Yol | Açıklama |
|-----|----------|
| `/dashboard/marketing/attribution` | Attribution Dashboard |
| `/dashboard/marketing/attribution/[contactId]` | Lead timeline |
| `/dashboard/marketing/reports` | Günlük AI Marketing Report |

## Cron

`GET /api/cron/marketing-daily-report` + `Authorization: Bearer CRON_SECRET`

## Migration

`supabase/migrations/20260717000024_ai_attribution_engine.sql`
