# Veritabanı (Supabase)

> **Durum:** v1 şeması canlı Supabase projesine uygulandı. REST API üzerinden
> (salt-okuma) doğrulandı: 25/25 tablo mevcut. TypeScript tipleri
> `src/types/database.ts` içinde tanımlıdır ve Supabase istemcilerine
> (`src/lib/supabase/client.ts`, `src/server/supabase/server.ts`,
> `src/server/supabase/admin.ts`) bağlanmıştır.

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
