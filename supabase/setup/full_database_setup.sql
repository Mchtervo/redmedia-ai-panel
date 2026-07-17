-- ============================================================================
-- Redmedia AI Panel - Birleştirilmiş Veritabanı Kurulum Dosyası
-- ============================================================================
--
-- Bu dosya, supabase/migrations/ klasöründeki 10 migration dosyasının
-- içeriğini, ORİJİNAL SIRASINI BOZMADAN tek bir dosyada birleştirir.
-- Amacı: Supabase Dashboard -> SQL Editor üzerinden tek seferde çalıştırmak.
--
-- GÜVENLİ (idempotent) hale getirmek için şu değişiklikler yapıldı:
--   - create table            -> create table IF NOT EXISTS
--   - create index            -> create index IF NOT EXISTS
--   - create unique index     -> create unique index IF NOT EXISTS
--   - create trigger          -> create OR REPLACE trigger
--   - create extension        -> zaten IF NOT EXISTS idi (değişmedi)
--   - create or replace function -> zaten idempotent idi (değişmedi)
--   - alter table ... enable row level security -> zaten idempotent
--     (tablo zaten RLS aktifse hata vermez)
--   - comment on table/function  -> zaten idempotent (her zaman üzerine yazar)
--
-- Bu dosyada VERİ SİLEN hiçbir komut (DROP TABLE, DROP DATABASE, TRUNCATE)
-- YOKTUR. Dosya güvenle birden fazla kez çalıştırılabilir.
--
-- Kaynak migration dosyaları (değiştirilmedi, olduğu gibi kalır):
--   supabase/migrations/20260717000001_extensions_and_helpers.sql
--   supabase/migrations/20260717000002_profiles_and_settings.sql
--   supabase/migrations/20260717000003_meta_ads.sql
--   supabase/migrations/20260717000004_contacts_and_conversations.sql
--   supabase/migrations/20260717000005_leads.sql
--   supabase/migrations/20260717000006_knowledge_base.sql
--   supabase/migrations/20260717000007_ai.sql
--   supabase/migrations/20260717000008_integrations.sql
--   supabase/migrations/20260717000009_sales_and_attribution.sql
--   supabase/migrations/20260717000010_recommendations_and_automation.sql
--
-- Beklenen sonuç: 25 tablo, hepsinde RLS aktif, hiçbir RLS policy'si yok
-- (personel yetkilendirmesi henüz kurulmadığı için kasıtlı olarak boş).
-- ============================================================================


-- ============================================================================
-- BÖLÜM 1 / 10 — extensions_and_helpers
-- Ortak eklentiler ve yardımcı fonksiyonlar.
-- Bu bölüm, sonraki tüm bölümlerin bağımlı olduğu temel altyapıyı kurar.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- updated_at kolonunu her UPDATE işleminde otomatik olarak şimdiki zamana ayarlar.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'updated_at kolonunu her guncellemede otomatik olarak simdiki zamana ayarlar.';


-- ============================================================================
-- BÖLÜM 2 / 10 — profiles_and_settings
-- profiles: Redmedia personeli / panel kullanıcıları.
-- business_settings: Redmedia işletme ayarları (AI grounding ve genel panel ayarları).
--
-- Not: Bu tablolar için henüz personel yetkilendirme akışı (Aşama 2) kurulmadığı
-- için kasıtlı olarak hiçbir RLS policy eklenmedi. RLS aktif ve varsayılan
-- olarak anon/authenticated rolleri için erişim reddedilir; uygulama şu an
-- yalnızca sunucu tarafında service role ile erişir. Personel yetkilendirmesi
-- kurulduğunda buraya rol bazlı policy'ler eklenecektir.
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Redmedia personeli / panel kullanicilari (Supabase Auth kullanicisiyla birebir eslesir).';

create unique index if not exists profiles_email_key
  on public.profiles (email)
  where email is not null;

create or replace trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- business_settings: kolonlar kullanıcı tarafından belirtilmedi, docs/AI.md ve
-- docs/PROJECT.md'deki "kaynak işletme bilgisi" ihtiyacına göre v1 taslağı.
create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'Redmedia',
  timezone text not null default 'Europe/Istanbul',
  default_currency text not null default 'TRY',
  contact_email text,
  contact_phone text,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.business_settings is
  'Redmedia isletme ayarlari (AI grounding ve genel panel ayarlari icin).';

create or replace trigger set_business_settings_updated_at
  before update on public.business_settings
  for each row
  execute function public.set_updated_at();

alter table public.business_settings enable row level security;


-- ============================================================================
-- BÖLÜM 3 / 10 — meta_ads
-- Meta reklam hiyerarşisi: ad_accounts -> campaigns -> ad_sets -> ads -> ad_creatives
-- ve günlük performans metrikleri (ad_daily_metrics).
-- Kolonlar kullanıcı tarafından belirtilmedi (ad_daily_metrics hariç); docs/META.md'deki
-- "yalnızca okuma/analiz" kapsamına göre v1 taslağı.
-- ============================================================================

create table if not exists public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  meta_account_id text not null unique,
  name text,
  currency text,
  timezone text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ad_accounts is 'Meta (Facebook/Instagram) reklam hesaplari.';

create or replace trigger set_ad_accounts_updated_at
  before update on public.ad_accounts
  for each row
  execute function public.set_updated_at();

alter table public.ad_accounts enable row level security;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references public.ad_accounts (id) on delete cascade,
  meta_campaign_id text not null,
  name text,
  objective text,
  status text check (status in ('active', 'paused', 'archived', 'deleted')),
  daily_budget numeric(12, 2),
  lifetime_budget numeric(12, 2),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ad_account_id, meta_campaign_id)
);

comment on table public.campaigns is 'Meta reklam kampanyalari.';

create index if not exists campaigns_ad_account_id_idx on public.campaigns (ad_account_id);

create or replace trigger set_campaigns_updated_at
  before update on public.campaigns
  for each row
  execute function public.set_updated_at();

alter table public.campaigns enable row level security;

create table if not exists public.ad_sets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  meta_ad_set_id text not null,
  name text,
  status text check (status in ('active', 'paused', 'archived', 'deleted')),
  daily_budget numeric(12, 2),
  targeting jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, meta_ad_set_id)
);

comment on table public.ad_sets is 'Meta reklam kampanyalarina bagli reklam setleri (ad set).';

create index if not exists ad_sets_campaign_id_idx on public.ad_sets (campaign_id);

create or replace trigger set_ad_sets_updated_at
  before update on public.ad_sets
  for each row
  execute function public.set_updated_at();

alter table public.ad_sets enable row level security;

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  ad_set_id uuid not null references public.ad_sets (id) on delete cascade,
  meta_ad_id text not null,
  name text,
  status text check (status in ('active', 'paused', 'archived', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ad_set_id, meta_ad_id)
);

comment on table public.ads is 'Tek bir Meta reklami (ad).';

create index if not exists ads_ad_set_id_idx on public.ads (ad_set_id);

create or replace trigger set_ads_updated_at
  before update on public.ads
  for each row
  execute function public.set_updated_at();

alter table public.ads enable row level security;

create table if not exists public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.ads (id) on delete cascade,
  meta_creative_id text,
  title text,
  body text,
  image_url text,
  video_url text,
  call_to_action text,
  created_at timestamptz not null default now()
);

comment on table public.ad_creatives is 'Reklamin gorsel/metin icerigi (creative).';

create index if not exists ad_creatives_ad_id_idx on public.ad_creatives (ad_id);

alter table public.ad_creatives enable row level security;

-- ad_daily_metrics: kullanıcı tarafından belirtilen kolonlarla birebir oluşturuldu.
create table if not exists public.ad_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  ad_id uuid not null references public.ads (id) on delete cascade,
  spend numeric(12, 2) not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  messages_started integer not null default 0,
  leads integer not null default 0,
  purchases integer not null default 0,
  revenue numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (ad_id, date)
);

comment on table public.ad_daily_metrics is 'Her reklamin gunluk performans metrikleri.';

create index if not exists ad_daily_metrics_ad_id_idx on public.ad_daily_metrics (ad_id);
create index if not exists ad_daily_metrics_date_idx on public.ad_daily_metrics (date);

alter table public.ad_daily_metrics enable row level security;


-- ============================================================================
-- BÖLÜM 4 / 10 — contacts_and_conversations
-- contacts, conversations, messages, conversation_summaries
-- Kolonlar kullanıcı tarafından belirtilen tanımla birebir oluşturuldu.
-- ============================================================================

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  instagram_user_id text,
  username text,
  full_name text,
  phone text,
  email text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz,
  status text not null default 'active' check (status in ('active', 'archived', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contacts is 'Bir Instagram/Facebook kullanicisini (musteriyi) temsil eder.';

create unique index if not exists contacts_instagram_user_id_key
  on public.contacts (instagram_user_id)
  where instagram_user_id is not null;

create or replace trigger set_contacts_updated_at
  before update on public.contacts
  for each row
  execute function public.set_updated_at();

alter table public.contacts enable row level security;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  channel text not null check (channel in ('instagram', 'facebook')),
  external_conversation_id text,
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  assigned_to uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.conversations is 'Musteri ile yurutulen gorusme (ChatPlace uzerinden).';

create index if not exists conversations_contact_id_idx on public.conversations (contact_id);

create unique index if not exists conversations_channel_external_id_key
  on public.conversations (channel, external_conversation_id)
  where external_conversation_id is not null;

create or replace trigger set_conversations_updated_at
  before update on public.conversations
  for each row
  execute function public.set_updated_at();

alter table public.conversations enable row level security;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  external_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('customer', 'ai', 'staff', 'system')),
  message_type text not null default 'text'
    check (message_type in ('text', 'image', 'video', 'audio', 'file', 'template')),
  content text,
  created_at timestamptz not null default now(),
  raw_payload jsonb
);

comment on table public.messages is 'Konusma icindeki tum mesajlar.';

create index if not exists messages_conversation_id_idx on public.messages (conversation_id);

create unique index if not exists messages_conversation_external_id_key
  on public.messages (conversation_id, external_message_id)
  where external_message_id is not null;

alter table public.messages enable row level security;

create table if not exists public.conversation_summaries (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  summary text,
  customer_needs text,
  objections text,
  important_dates jsonb,
  budget text,
  next_action text,
  updated_at timestamptz not null default now()
);

comment on table public.conversation_summaries is 'Uzun konusmanin AI tarafindan uretilen kisa hafizasi.';

create or replace trigger set_conversation_summaries_updated_at
  before update on public.conversation_summaries
  for each row
  execute function public.set_updated_at();

alter table public.conversation_summaries enable row level security;


-- ============================================================================
-- BÖLÜM 5 / 10 — leads
-- lead_profiles: kullanıcı tarafından belirtilen tanımla birebir oluşturuldu.
-- lead_events: kolonlar kullanıcı tarafından belirtilmedi, "lead zaman çizelgesi"
-- ihtiyacına göre v1 taslağı.
-- ============================================================================

create table if not exists public.lead_profiles (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null unique references public.contacts (id) on delete cascade,
  service_type text,
  event_date date,
  location text,
  budget numeric(12, 2),
  budget_currency text not null default 'TRY',
  phone_collected boolean not null default false,
  lead_score integer check (lead_score between 0 and 100),
  lead_temperature text check (lead_temperature in ('cold', 'warm', 'hot')),
  reservation_status text not null default 'none'
    check (reservation_status in ('none', 'pending', 'confirmed', 'cancelled')),
  source_campaign_id uuid references public.campaigns (id) on delete set null,
  source_ad_id uuid references public.ads (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.lead_profiles is 'Musterinin satis (lead) bilgileri.';

create index if not exists lead_profiles_source_campaign_id_idx on public.lead_profiles (source_campaign_id);
create index if not exists lead_profiles_source_ad_id_idx on public.lead_profiles (source_ad_id);

create or replace trigger set_lead_profiles_updated_at
  before update on public.lead_profiles
  for each row
  execute function public.set_updated_at();

alter table public.lead_profiles enable row level security;

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_profile_id uuid not null references public.lead_profiles (id) on delete cascade,
  event_type text not null,
  event_data jsonb,
  actor_type text not null default 'system' check (actor_type in ('staff', 'ai', 'system')),
  actor_id uuid references public.profiles (id) on delete set null,
  occurred_at timestamptz not null default now()
);

comment on table public.lead_events is 'Bir lead uzerindeki degisiklik/olay gecmisi (zaman cizelgesi).';

create index if not exists lead_events_lead_profile_id_idx on public.lead_events (lead_profile_id);

alter table public.lead_events enable row level security;


-- ============================================================================
-- BÖLÜM 6 / 10 — knowledge_base
-- knowledge_documents: kullanıcı tarafından belirtilen tanımla birebir oluşturuldu.
-- knowledge_chunks: kolonlar kullanıcı tarafından belirtilmedi; AI grounding (RAG) için
-- parçalanmış/embedding'lenmiş içerik saklama ihtiyacına göre v1 taslağı.
-- ============================================================================

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  content text not null,
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.knowledge_documents is 'Redmedia hizmet/politika bilgisi (AI grounding kaynagi).';

create or replace trigger set_knowledge_documents_updated_at
  before update on public.knowledge_documents
  for each row
  execute function public.set_updated_at();

alter table public.knowledge_documents enable row level security;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

comment on table public.knowledge_chunks is
  'knowledge_documents''in AI aramasi (RAG) icin parcalanmis ve embedding''lenmis halleri.';

create index if not exists knowledge_chunks_document_id_idx on public.knowledge_chunks (document_id);

alter table public.knowledge_chunks enable row level security;


-- ============================================================================
-- BÖLÜM 7 / 10 — ai
-- ai_runs: kullanıcı tarafından belirtilen tanımla birebir oluşturuldu
-- (+ ilişki/insan onayı kolonları).
-- ai_feedback: kolonlar kullanıcı tarafından belirtilmedi; personelin AI cevabını
-- değerlendirmesi ihtiyacına göre v1 taslağı.
-- ============================================================================

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  task_type text not null,
  conversation_id uuid references public.conversations (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric(10, 4),
  result jsonb,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  requires_human_approval boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.ai_runs is 'Her yapay zeka (OpenAI) model calismasinin kaydi.';

create index if not exists ai_runs_conversation_id_idx on public.ai_runs (conversation_id);
create index if not exists ai_runs_contact_id_idx on public.ai_runs (contact_id);

alter table public.ai_runs enable row level security;

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references public.ai_runs (id) on delete cascade,
  feedback_type text not null check (feedback_type in ('positive', 'negative', 'correction')),
  comment text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.ai_feedback is 'Personelin bir AI cevabina (ai_runs) verdigi geri bildirim.';

create index if not exists ai_feedback_ai_run_id_idx on public.ai_feedback (ai_run_id);

alter table public.ai_feedback enable row level security;


-- ============================================================================
-- BÖLÜM 8 / 10 — integrations
-- integrations, webhook_events: kolonlar kullanıcı tarafından belirtilmedi;
-- docs/CHATPLACE.md ve docs/META.md'deki entegrasyon/webhook akışına göre v1 taslağı.
--
-- Not: Bu tabloda gerçek API anahtarı/token saklanmaz (bkz. .cursor/rules/02-security.mdc).
-- Sırlar her zaman sunucu tarafı environment variable olarak kalır; burada yalnızca
-- bağlantı durumu ve hassas olmayan metadata tutulur.
-- ============================================================================

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique check (provider in ('chatplace', 'meta', 'openai', 'supabase')),
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  connected_at timestamptz,
  last_checked_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.integrations is
  'Dis servis entegrasyonlarinin baglanti durumu (sir/token icermez).';

create or replace trigger set_integrations_updated_at
  before update on public.integrations
  for each row
  execute function public.set_updated_at();

alter table public.integrations enable row level security;

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('chatplace', 'meta')),
  event_type text,
  signature_verified boolean not null default false,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

comment on table public.webhook_events is
  'Dis servislerden gelen ham webhook isteklerinin kaydi (dogrulama + islenme durumu).';

create index if not exists webhook_events_provider_idx on public.webhook_events (provider);
create index if not exists webhook_events_status_idx on public.webhook_events (status);

alter table public.webhook_events enable row level security;


-- ============================================================================
-- BÖLÜM 9 / 10 — sales_and_attribution
-- attribution_events, sales, reservations: kolonlar kullanıcı tarafından belirtilmedi;
-- satış dönüşümü ve reklam atfı (attribution) ihtiyacına göre v1 taslağı.
-- ============================================================================

create table if not exists public.attribution_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts (id) on delete set null,
  lead_profile_id uuid references public.lead_profiles (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  ad_id uuid references public.ads (id) on delete set null,
  event_type text not null check (event_type in ('message_started', 'lead_created', 'reservation', 'purchase')),
  occurred_at timestamptz not null default now(),
  metadata jsonb,
  created_at timestamptz not null default now()
);

comment on table public.attribution_events is
  'Musteri/lead olaylarinin hangi kampanya/reklama atfedildigini kaydeder.';

create index if not exists attribution_events_contact_id_idx on public.attribution_events (contact_id);
create index if not exists attribution_events_campaign_id_idx on public.attribution_events (campaign_id);
create index if not exists attribution_events_ad_id_idx on public.attribution_events (ad_id);

alter table public.attribution_events enable row level security;

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts (id) on delete set null,
  lead_profile_id uuid references public.lead_profiles (id) on delete set null,
  service_type text,
  amount numeric(12, 2) not null,
  currency text not null default 'TRY',
  status text not null default 'completed' check (status in ('pending', 'completed', 'refunded', 'cancelled')),
  sold_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.sales is 'Tamamlanan satislar / satis donusumleri.';

create index if not exists sales_contact_id_idx on public.sales (contact_id);
create index if not exists sales_lead_profile_id_idx on public.sales (lead_profile_id);

alter table public.sales enable row level security;

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts (id) on delete set null,
  lead_profile_id uuid references public.lead_profiles (id) on delete set null,
  event_date date,
  location text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reservations is 'Musteri rezervasyonlari (etkinlik tarihi/yeri).';

create index if not exists reservations_contact_id_idx on public.reservations (contact_id);
create index if not exists reservations_lead_profile_id_idx on public.reservations (lead_profile_id);

create or replace trigger set_reservations_updated_at
  before update on public.reservations
  for each row
  execute function public.set_updated_at();

alter table public.reservations enable row level security;


-- ============================================================================
-- BÖLÜM 10 / 10 — recommendations_and_automation
-- recommendations, automation_logs: kolonlar kullanıcı tarafından belirtilmedi;
-- docs/AI.md ve docs/META.md'deki "AI yalnızca öneri üretir, insan onayı gerekir"
-- ve genel otomasyon takibi ihtiyacına göre v1 taslağı.
-- ============================================================================

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  -- target_type/target_id ile campaign/ad_set/ad/lead gibi farklı tablolara
  -- kasıtlı olarak polimorfik (FK'sız) referans verir; tek bir hedef türüne
  -- kilitlenmemek için sabit foreign key eklenmedi.
  target_type text not null check (target_type in ('campaign', 'ad_set', 'ad', 'lead')),
  target_id uuid not null,
  recommendation_type text not null,
  description text not null,
  suggested_action jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'applied')),
  requires_human_approval boolean not null default true,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.recommendations is
  'AI tarafindan uretilen oneriler (kampanya/reklam/lead); insan onayi olmadan uygulanmaz.';

create index if not exists recommendations_target_idx on public.recommendations (target_type, target_id);
create index if not exists recommendations_status_idx on public.recommendations (status);

alter table public.recommendations enable row level security;

create table if not exists public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('chatplace', 'meta', 'ai', 'system')),
  action text not null,
  status text not null default 'success' check (status in ('success', 'failed', 'skipped')),
  details jsonb,
  related_contact_id uuid references public.contacts (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.automation_logs is 'Otomasyon/entegrasyon islemlerinin genel aktivite kaydi.';

create index if not exists automation_logs_source_idx on public.automation_logs (source);
create index if not exists automation_logs_related_contact_id_idx on public.automation_logs (related_contact_id);

alter table public.automation_logs enable row level security;


-- ============================================================================
-- DOĞRULAMA — Bu dosyayı çalıştırdıktan sonra sonucu kontrol etmek için
-- SQL Editor'de aşağıdaki iki sorguyu ayrıca çalıştırabilirsiniz.
-- ============================================================================

-- 1) Toplam tablo sayısı (beklenen: 25)
select count(*) as toplam_tablo_sayisi
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';

-- 2) RLS'si kapalı olan tablolar (beklenen: 0 satır / boş sonuç)
select c.relname as rls_kapali_tablo
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
