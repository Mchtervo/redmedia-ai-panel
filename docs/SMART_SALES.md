# Akıllı Satış ve Müşteri Yönetimi

Migration: `20260717000019_smart_sales_crm.sql`

## Yaşam döngüsü

`customer_profiles.lifecycle_stage` — AI tonu aşamaya göre değişir.

## Takip

AI cevabından sonra 24s / 3g / 7g / 30g planı. Müşteri cevap verince
bekleyen takipler iptal olur.

## Opportunity Score + etiketler

Tahmini 0–100 puan; otomatik etiketler admin panelden düzenlenebilir.

## Zaman çizgisi + admin notları

`/dashboard/customers/[id]` — timeline, DM, notlar.
Admin notları AI’ye gider ama müşteriye söylenmez.

## Memnuniyet

Çekim tamamlandı → teşekkür / yorum / Google / IG etiket / referans görevleri.
Cron: `/api/cron/follow-ups`
