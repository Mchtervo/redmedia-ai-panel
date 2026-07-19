# features/customer-intelligence

**Amaç:** Customer Intelligence (CRM Memory) — müşteri başına tek profil.

**Tablo:** `customer_profiles` (contacts ile 1:1)

**Akış:** ChatPlace webhook → mesaj ingest → profil güncelle → AI cevap
(CRM profili promptta) → `last_ai_response` kaydet.

**Panel:** Müşteri detayında CRM Bellek kartı (`/dashboard/customers/[id]`).
