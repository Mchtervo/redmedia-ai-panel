# Kapora, dekont ve AI Brain

## Kapora / IBAN

- Varsayılan kapora: `reservation_settings.default_deposit_amount` (1000 TL)
- IBAN: `/dashboard/settings/payment` → `payment_accounts` (aktif + varsayılan)
- Müşteri onay/kapora istediğinde AI `buildDepositIbanMessage` şablonunu gönderir
- Kesin confirmed yalnızca admin **Ödeme Alındı** ile

## Dekont

Webhook görsel URL → Vision → IBAN/hesap/tutar/okunabilirlik/tekrar kontrolü.
Müşteriye şablon cevap; asla “ödeme kesin geçti / rezervasyon kesinleşti” demez.

## Customer Memory

`customer_profiles` özet alanları (pazarlık, fiyat hassasiyeti, tip, notlar…).
Ham DM her mesajda prompta gitmez; özet + son 12 mesaj.

## AI Brain

- Migration: `20260717000018_customer_memory_ai_brain.sql`
- Panel: `/dashboard/ai-brain`
- `knowledge_candidates` → admin onay → `knowledge_documents` + `sales_learnings`
- Admin AI düzeltmeleri `admin_ai_corrections` (3+ tekrar → aday)
- AI fiyat/kampanya/IBAN/kapora kuralını kendi değiştirmez
