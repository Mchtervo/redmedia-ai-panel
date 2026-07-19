# Reservation OS

Redmedia rezervasyon, fiyat kataloğu, takvim, kapora/dekont, hatırlatma ve
follow-up sistemi.

## Migrationlar

- `20260717000013_reservation_os_core.sql`
- `20260717000014_reservation_os_payments.sql`
- `20260717000015_reservation_os_followups_reminders.sql`
- `20260717000016_reservation_os_seed.sql`
- `20260717000017_staff_management.sql` — personel / rol / atama (bkz. `docs/STAFF.md`)

**Not:** Meta Ads `campaigns` tablosu korunur; fiyat kampanyaları
`service_campaigns` adındadır.

## Panel

- `/dashboard/reservations` — liste + manuel form
- `/dashboard/reservations/[id]` — detay, IBAN, ödeme onayı, zaman planı
- `/dashboard/services` — fiyat yönetimi
- `/dashboard/campaigns` — kampanya aktif/pasif
- `/dashboard/plateaus` — plato yönetimi
- `/dashboard/payments` — dekontlar
- `/dashboard/follow-ups`
- `/dashboard/reminders`
- `/dashboard/settings/payment` — IBAN

## AI

Webhook → CRM güncelle → rezervasyon draft sync → OpenAI (CRM + draft +
knowledge). IBAN isteğinde cevap `payment_accounts` şablonundan gelir.
Fiyat yalnızca `pricing` / DB hesabından.

## Cron

- `/api/cron/reminders`
- `/api/cron/follow-ups`

`Authorization: Bearer CRON_SECRET`
