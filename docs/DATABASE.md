# Veritabanı (Supabase)

> **Durum:** v1 şeması canlı Supabase projesine uygulandı. REST API üzerinden
> (salt-okuma) doğrulandı: 25/25 tablo mevcut. TypeScript tipleri
> `src/types/database.ts` içinde tanımlıdır ve Supabase istemcilerine
> (`src/lib/supabase/client.ts`, `src/server/supabase/server.ts`,
> `src/server/supabase/admin.ts`) bağlanmıştır.
>
> **Conversation Learning** migration'ı (`20260717000011`) canlıya
> `supabase/migrations/` + `full_database_setup.sql` üzerinden ayrıca
> uygulanmalıdır (2 yeni tablo + mevcut tablo kolonları).

## Teknoloji

- Supabase (PostgreSQL + RLS + Auth).
- Eklentiler: `pgcrypto` (`gen_random_uuid()` için), `vector` (AI embedding
  araması / RAG için, `knowledge_chunks.embedding`).

## Konvansiyonlar

Detaylı kurallar için `.cursor/rules/03-database.mdc`'ye bakınız. Özet:

- `snake_case` isimlendirme, çoğul tablo adları.
- Her şema değişikliği migration dosyası ile yapılır (`supabase/migrations`).
- Kullanıcı/müşteri verisi içeren her tablo RLS ile birlikte oluşturulur.
- `created_at` / `updated_at` standardı; `updated_at` olan tablolarda ortak
  `set_updated_at()` trigger fonksiyonu kullanılır.

## RLS Durumu (Önemli)

Personel yetkilendirme akışı (bkz. `docs/ROADMAP.md` Aşama 2) henüz
kurulmadığı için **tüm tablolarda RLS aktif, ancak henüz hiçbir policy
eklenmedi.** Bu, varsayılan olarak `anon`/`authenticated` rolleri için
erişimin tamamen reddedilmesi anlamına gelir; uygulama şu an yalnızca sunucu
tarafında **service role** ile erişecektir (bkz. `.cursor/rules/02-security.mdc`).
Personel giriş/yetki sistemi kurulduğunda, rol bazlı (`admin`/`agent`)
policy'ler ayrı bir migration ile eklenecektir.

## Migration Dosyaları ve Tablolar

| Migration | Tablolar | Not |
|---|---|---|
| `20260717000001_extensions_and_helpers.sql` | — | `pgcrypto`, `vector` eklentileri + `set_updated_at()` fonksiyonu |
| `20260717000002_profiles_and_settings.sql` | `profiles`, `business_settings` | Kolonlar kullanıcı tarafından belirtilmedi, v1 taslağı |
| `20260717000003_meta_ads.sql` | `ad_accounts`, `campaigns`, `ad_sets`, `ads`, `ad_creatives`, `ad_daily_metrics` | `ad_daily_metrics` kullanıcı tanımıyla birebir; diğerleri v1 taslağı |
| `20260717000004_contacts_and_conversations.sql` | `contacts`, `conversations`, `messages`, `conversation_summaries` | Kullanıcı tanımıyla birebir |
| `20260717000005_leads.sql` | `lead_profiles`, `lead_events` | `lead_profiles` kullanıcı tanımıyla birebir; `lead_events` v1 taslağı |
| `20260717000006_knowledge_base.sql` | `knowledge_documents`, `knowledge_chunks` | `knowledge_documents` kullanıcı tanımıyla birebir; `knowledge_chunks` v1 taslağı (RAG embedding) |
| `20260717000007_ai.sql` | `ai_runs`, `ai_feedback` | `ai_runs` kullanıcı tanımıyla birebir (+ilişki/onay kolonları); `ai_feedback` v1 taslağı |
| `20260717000008_integrations.sql` | `integrations`, `webhook_events` | v1 taslağı, sır/token içermez |
| `20260717000009_sales_and_attribution.sql` | `attribution_events`, `sales`, `reservations` | v1 taslağı |
| `20260717000010_recommendations_and_automation.sql` | `recommendations`, `automation_logs` | v1 taslağı |
| `20260717000011_conversation_learning.sql` | `conversation_analyses`, `conversation_learning_runs` + `knowledge_documents` / `conversation_summaries` / `conversations` genişletmesi | Conversation Learning |
| `20260717000012_customer_profiles.sql` | `customer_profiles` | Customer Intelligence (CRM Memory) |
| `20260717000013_reservation_os_core.sql` | catalog, plateaus, teams, expand `reservations`, items, changes | Reservation OS |
| `20260717000014_reservation_os_payments.sql` | `payment_accounts`, `payment_receipts` | Kapora/dekont |
| `20260717000015_reservation_os_followups_reminders.sql` | `follow_up_tasks`, `reminder_jobs` | Follow-up + hatırlatma |
| `20260717000016_reservation_os_seed.sql` | seed | Hizmet/kampanya seed |
| `20260717000017_staff_management.sql` | staff tabloları | Personel yönetimi |
| `20260717000018_customer_memory_ai_brain.sql` | AI Brain / müşteri hafızası | Customer memory |
| `20260717000019_smart_sales_crm.sql` | smart sales tabloları | Smart Sales CRM |
| `20260717000020_ceo_intelligence.sql` | CEO intelligence tabloları | CEO raporları |
| `20260717000021_marketing_director.sql` | marketing tabloları | Marketing Director |
| `20260717000022_meta_oauth_tokens.sql` | `meta_oauth_tokens` | Meta OAuth token yönetimi |
| `20260717000023_meta_connection_configured_status.sql` | — | Bağlantı durumu genişletmesi |
| `20260717000024_ai_attribution_engine.sql` | attribution tabloları | AI Attribution Engine |
| `20260718000025_conversations_whatsapp_channel.sql` | — | WhatsApp kanal desteği |
| `20260718000026_conversation_sales_scores.sql` | `conversation_sales_scores` | Konuşma puanlama (Sales Learning) |
| `20260718000027_sales_patterns.sql` | `sales_patterns` | Öğrenilen satış kalıpları |
| `20260718000028_company_personality.sql` | `company_personality_traits` | Şirket kişiliği hafızası |
| `20260718000029_ai_mistakes.sql` | `ai_mistakes` | AI hata hafızası (self-improvement) |
| `20260718000030_ai_weekly_reports.sql` | `ai_weekly_reports` | Haftalık AI öz değerlendirme |
| `20260718000031_ai_playbooks.sql` | `ai_playbooks` | Playbook Engine (docs/27) |
| `20260718000032_ai_approvals.sql` | `ai_approvals` | Approval Engine onay kuyruğu (docs/43) |
| `20260718000033_automation_rules.sql` | `automation_rules`, `automation_runs` | Automation Engine (docs/14, 32) |
| `20260718000034_knowledge_rag.sql` | — | RAG: `knowledge_chunks` ivfflat index + `match_knowledge_chunks()` (docs/29, 30) |

"Kullanıcı tanımıyla birebir" olmayan tablolarda kolonlar, projenin amacına ve
`docs/META.md`, `docs/CHATPLACE.md`, `docs/AI.md` içindeki akışlara göre
makul bir v1 taslağı olarak tanımlandı; ihtiyaca göre yeni bir migration ile
değiştirilebilir.

## Önemli Tasarım Kararları

- **`profiles.id`**, Supabase Auth'taki `auth.users.id`'ye referans verir
  (personel = Supabase Auth kullanıcısı).
- **`lead_profiles.contact_id`** benzersizdir (bir contact için tek güncel
  lead profili varsayımı, v1 için).
- **`recommendations.target_id`** kasıtlı olarak polimorfiktir (foreign key
  yok); `target_type` ile hangi tabloya ait olduğu belirtilir çünkü farklı
  hedef türlerine (kampanya/ad set/reklam/lead) tek bir sabit FK ile
  bağlanmak mümkün değildir.
- **`integrations`** tablosunda gerçek API anahtarı/token saklanmaz; yalnızca
  bağlantı durumu ve hassas olmayan metadata tutulur (bkz.
  `.cursor/rules/02-security.mdc`).

## Migration'ları Canlı Supabase Projesine Uygulama (Tamamlandı)

Şema, Supabase Dashboard → SQL Editor üzerinden `supabase/setup/full_database_setup.sql`
çalıştırılarak canlı projeye uygulandı ve REST API üzerinden 25/25 tablonun
mevcut olduğu doğrulandı. Yeni bir şema değişikliği gerektiğinde:

1. Yeni bir migration dosyası `supabase/migrations/` altına eklenir.
2. Aynı değişiklik, idempotent (tekrar çalıştırılabilir) şekilde
   `supabase/setup/full_database_setup.sql`'e de yansıtılır.
3. Supabase Dashboard → SQL Editor'de çalıştırılır.

## TypeScript Tipleri

`src/types/database.ts`, migration SQL'lerinden elle derlenmiştir (canlı
şemayla REST API üzerinden karşılaştırılıp doğrulandı). Supabase CLI/DB
şifresi mevcut olduğunda `supabase gen types typescript` ile yeniden
üretilmesi önerilir. Bu tipler `createClient<Database>()` ile
`src/lib/supabase/client.ts`, `src/server/supabase/server.ts` ve
`src/server/supabase/admin.ts` istemcilerine bağlıdır.
