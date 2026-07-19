# Customer Intelligence (CRM Memory)

## Amaç

Her Instagram müşterisi için tek bir CRM profili tutmak. AI her mesajdan
sonra profili günceller; cevap üretirken yalnızca bu müşterinin profilini
okur.

## Tablo

`customer_profiles` — `contacts` ile 1:1 (`contact_id` unique).

Durum: `new` | `interested` | `hot` | `booked` | `lost`

## Akış

1. Webhook mesajı ingest
2. `touchCustomerProfileFromMessage` (heuristik + OpenAI delta)
3. AI cevap (CRM profil promptta)
4. `last_ai_response` güncelle

## Panel

`/dashboard/customers/[id]` → CRM Bellek kartı

## Migration

`supabase/migrations/20260717000012_customer_profiles.sql`
