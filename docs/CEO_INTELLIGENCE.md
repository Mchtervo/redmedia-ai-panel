# Redmedia CEO Intelligence

Salt okuma karar destek modülü. Mevcut CRM, rezervasyon, ödeme, personel
ve konuşma verilerini analiz eder; yöneticiye özet, risk, öneri ve doğal dil
cevapları sunar.

## Kurallar (zorunlu)

CEO Intelligence **asla**:

- fiyat değiştirmez
- kampanya oluşturmaz / açıp kapatmaz
- personel atamaz
- ödeme onaylamaz
- rezervasyon onaylamaz / iptal etmez

Yalnızca analiz, rapor ve **tavsiye** üretir. Karar admin’dedir.

## Özellikler

1. **Günlük özet (Dashboard)** — her açılışta metrikler yenilenir
2. **Yönetim asistanı** — doğal dil soru; yalnızca sistem verisi
3. **Öneriler** — tavsiye niteliğinde
4. **Risk merkezi** — çakışma, bekleyen dekont/kapora, sıcak müşteri sessizliği vb.
5. **Günlük rapor** — cron ile günlük yönetim raporu

## Migration

`supabase/migrations/20260717000020_ceo_intelligence.sql`

Tablolar: `ceo_daily_briefs`, `ceo_daily_reports`, `ceo_assistant_logs`

## Rotalar

- `/dashboard` — CEO özet + asistan + risk + öneri
- `/dashboard/ceo` — günlük rapor arşivi
- `GET /api/cron/ceo-daily-report` — Bearer `CRON_SECRET`

## Kod

`src/features/ceo-intelligence/`
