-- ============================================================================
-- Redmedia AI Panel - Birle�tirilmi� Veritaban� Kurulum Dosyas�
-- ============================================================================
--
-- Bu dosya, supabase/migrations/ klas�r�ndeki 10 migration dosyas�n�n
-- i�eri�ini, OR�J�NAL SIRASINI BOZMADAN tek bir dosyada birle�tirir.
-- Amac�: Supabase Dashboard -> SQL Editor �zerinden tek seferde �al��t�rmak.
--
-- G�VENL� (idempotent) hale getirmek i�in �u de�i�iklikler yap�ld�:
--   - create table            -> create table IF NOT EXISTS
--   - create index            -> create index IF NOT EXISTS
--   - create unique index     -> create unique index IF NOT EXISTS
--   - create trigger          -> create OR REPLACE trigger
--   - create extension        -> zaten IF NOT EXISTS idi (de�i�medi)
--   - create or replace function -> zaten idempotent idi (de�i�medi)
--   - alter table ... enable row level security -> zaten idempotent
--     (tablo zaten RLS aktifse hata vermez)
--   - comment on table/function  -> zaten idempotent (her zaman �zerine yazar)
--
-- Bu dosyada VER� S�LEN hi�bir komut (DROP TABLE, DROP DATABASE, TRUNCATE)
-- YOKTUR. Dosya g�venle birden fazla kez �al��t�r�labilir.
--
-- Kaynak migration dosyalar� (de�i�tirilmedi, oldu�u gibi kal�r):
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
-- Beklenen sonu�: 25 tablo, hepsinde RLS aktif, hi�bir RLS policy'si yok
-- (personel yetkilendirmesi hen�z kurulmad��� i�in kas�tl� olarak bo�).
-- ============================================================================


-- ============================================================================
-- B�L�M 1 / 10 � extensions_and_helpers
-- Ortak eklentiler ve yard�mc� fonksiyonlar.
-- Bu b�l�m, sonraki t�m b�l�mlerin ba��ml� oldu�u temel altyap�y� kurar.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- updated_at kolonunu her UPDATE i�leminde otomatik olarak �imdiki zamana ayarlar.
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
-- B�L�M 2 / 10 � profiles_and_settings
-- profiles: Redmedia personeli / panel kullan�c�lar�.
-- business_settings: Redmedia i�letme ayarlar� (AI grounding ve genel panel ayarlar�).
--
-- Not: Bu tablolar i�in hen�z personel yetkilendirme ak��� (A�ama 2) kurulmad���
-- i�in kas�tl� olarak hi�bir RLS policy eklenmedi. RLS aktif ve varsay�lan
-- olarak anon/authenticated rolleri i�in eri�im reddedilir; uygulama �u an
-- yaln�zca sunucu taraf�nda service role ile eri�ir. Personel yetkilendirmesi
-- kuruldu�unda buraya rol bazl� policy'ler eklenecektir.
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

-- business_settings: kolonlar kullan�c� taraf�ndan belirtilmedi, docs/AI.md ve
-- docs/PROJECT.md'deki "kaynak i�letme bilgisi" ihtiyac�na g�re v1 tasla��.
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
-- B�L�M 3 / 10 � meta_ads
-- Meta reklam hiyerar�isi: ad_accounts -> campaigns -> ad_sets -> ads -> ad_creatives
-- ve g�nl�k performans metrikleri (ad_daily_metrics).
-- Kolonlar kullan�c� taraf�ndan belirtilmedi (ad_daily_metrics hari�); docs/META.md'deki
-- "yaln�zca okuma/analiz" kapsam�na g�re v1 tasla��.
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

-- ad_daily_metrics: kullan�c� taraf�ndan belirtilen kolonlarla birebir olu�turuldu.
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
-- B�L�M 4 / 10 � contacts_and_conversations
-- contacts, conversations, messages, conversation_summaries
-- Kolonlar kullan�c� taraf�ndan belirtilen tan�mla birebir olu�turuldu.
-- ============================================================================

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  instagram_user_id text,
  meta_igsid text,
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
comment on column public.contacts.meta_igsid is
  'Meta Instagram Scoped User ID (numeric). ChatPlace contact.id ile karıştırılmaz.';

create unique index if not exists contacts_instagram_user_id_key
  on public.contacts (instagram_user_id)
  where instagram_user_id is not null;

create unique index if not exists contacts_meta_igsid_key
  on public.contacts (meta_igsid)
  where meta_igsid is not null;

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
-- B�L�M 5 / 10 � leads
-- lead_profiles: kullan�c� taraf�ndan belirtilen tan�mla birebir olu�turuldu.
-- lead_events: kolonlar kullan�c� taraf�ndan belirtilmedi, "lead zaman �izelgesi"
-- ihtiyac�na g�re v1 tasla��.
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
-- B�L�M 6 / 10 � knowledge_base
-- knowledge_documents: kullan�c� taraf�ndan belirtilen tan�mla birebir olu�turuldu.
-- knowledge_chunks: kolonlar kullan�c� taraf�ndan belirtilmedi; AI grounding (RAG) i�in
-- par�alanm��/embedding'lenmi� i�erik saklama ihtiyac�na g�re v1 tasla��.
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
-- B�L�M 7 / 10 � ai
-- ai_runs: kullan�c� taraf�ndan belirtilen tan�mla birebir olu�turuldu
-- (+ ili�ki/insan onay� kolonlar�).
-- ai_feedback: kolonlar kullan�c� taraf�ndan belirtilmedi; personelin AI cevab�n�
-- de�erlendirmesi ihtiyac�na g�re v1 tasla��.
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
-- B�L�M 8 / 10 � integrations
-- integrations, webhook_events: kolonlar kullan�c� taraf�ndan belirtilmedi;
-- docs/CHATPLACE.md ve docs/META.md'deki entegrasyon/webhook ak���na g�re v1 tasla��.
--
-- Not: Bu tabloda ger�ek API anahtar�/token saklanmaz (bkz. .cursor/rules/02-security.mdc).
-- S�rlar her zaman sunucu taraf� environment variable olarak kal�r; burada yaln�zca
-- ba�lant� durumu ve hassas olmayan metadata tutulur.
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
-- B�L�M 9 / 10 � sales_and_attribution
-- attribution_events, sales, reservations: kolonlar kullan�c� taraf�ndan belirtilmedi;
-- sat�� d�n���m� ve reklam atf� (attribution) ihtiyac�na g�re v1 tasla��.
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
-- B�L�M 10 / 10 � recommendations_and_automation
-- recommendations, automation_logs: kolonlar kullan�c� taraf�ndan belirtilmedi;
-- docs/AI.md ve docs/META.md'deki "AI yaln�zca �neri �retir, insan onay� gerekir"
-- ve genel otomasyon takibi ihtiyac�na g�re v1 tasla��.
-- ============================================================================

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  -- target_type/target_id ile campaign/ad_set/ad/lead gibi farkl� tablolara
  -- kas�tl� olarak polimorfik (FK's�z) referans verir; tek bir hedef t�r�ne
  -- kilitlenmemek i�in sabit foreign key eklenmedi.
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
-- Conversation Learning (migration 20260717000011)
-- ============================================================================

alter table public.knowledge_documents
  add column if not exists review_status text not null default 'approved'
    check (review_status in ('pending_review', 'approved', 'rejected')),
  add column if not exists source_type text not null default 'manual'
    check (source_type in ('manual', 'conversation_learning', 'import')),
  add column if not exists source_conversation_id uuid
    references public.conversations (id) on delete set null,
  add column if not exists faq_question text,
  add column if not exists suggested_answer text,
  add column if not exists example_good_reply text,
  add column if not exists example_bad_reply text,
  add column if not exists is_pricing_sensitive boolean not null default false,
  add column if not exists is_campaign_claim boolean not null default false,
  add column if not exists reviewed_by uuid
    references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_notes text;

create index if not exists knowledge_documents_review_status_idx
  on public.knowledge_documents (review_status);
create index if not exists knowledge_documents_category_idx
  on public.knowledge_documents (category);
create index if not exists knowledge_documents_source_conversation_id_idx
  on public.knowledge_documents (source_conversation_id);

create table if not exists public.conversation_analyses (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique
    references public.conversations (id) on delete cascade,
  customer_intent text,
  event_type text,
  event_date_text text,
  venue_type text,
  requested_services text,
  budget_or_price_question text,
  objections text,
  phone_collected boolean not null default false,
  sale_outcome text not null default 'unknown'
    check (sale_outcome in ('won', 'lost', 'open', 'unknown')),
  advancing_reply text,
  losing_reply text,
  frequent_question text,
  recommended_answer text,
  lead_score integer check (lead_score between 0 and 100),
  sale_probability integer check (sale_probability between 0 and 100),
  lead_temperature text
    check (lead_temperature in ('cold', 'warm', 'hot')),
  loss_reason text,
  next_action text,
  message_count integer not null default 0,
  last_message_at_snapshot timestamptz,
  extraction jsonb,
  learning_status text not null default 'completed'
    check (learning_status in ('pending', 'completed', 'failed', 'skipped')),
  analyzed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversation_analyses_sale_outcome_idx
  on public.conversation_analyses (sale_outcome);
create index if not exists conversation_analyses_analyzed_at_idx
  on public.conversation_analyses (analyzed_at desc);

drop trigger if exists set_conversation_analyses_updated_at on public.conversation_analyses;
create trigger set_conversation_analyses_updated_at
  before update on public.conversation_analyses
  for each row
  execute function public.set_updated_at();

alter table public.conversation_analyses enable row level security;

alter table public.knowledge_documents
  add column if not exists source_analysis_id uuid
    references public.conversation_analyses (id) on delete set null;

create index if not exists knowledge_documents_source_analysis_id_idx
  on public.knowledge_documents (source_analysis_id);

alter table public.conversation_summaries
  add column if not exists lead_score integer check (lead_score between 0 and 100),
  add column if not exists sale_probability integer check (sale_probability between 0 and 100),
  add column if not exists customer_intent text,
  add column if not exists lead_temperature text
    check (lead_temperature in ('cold', 'warm', 'hot')),
  add column if not exists loss_reason text,
  add column if not exists sale_outcome text
    check (sale_outcome in ('won', 'lost', 'open', 'unknown'));

create table if not exists public.conversation_learning_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null
    check (trigger_source in (
      'manual',
      'cron',
      'conversation_closed',
      'idle_24h',
      'import'
    )),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'partial')),
  conversations_scanned integer not null default 0,
  conversations_analyzed integer not null default 0,
  knowledge_proposed integer not null default 0,
  error_message text,
  details jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists conversation_learning_runs_started_at_idx
  on public.conversation_learning_runs (started_at desc);

alter table public.conversation_learning_runs enable row level security;

alter table public.conversations
  add column if not exists last_learned_at timestamptz;


-- ============================================================================
-- Customer Intelligence / CRM Memory (migration 20260717000012)
-- ============================================================================

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null unique
    references public.contacts (id) on delete cascade,
  instagram_id text,
  username text,
  full_name text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  total_messages integer not null default 0
    check (total_messages >= 0),
  total_conversations integer not null default 0
    check (total_conversations >= 0),
  lead_score integer not null default 0
    check (lead_score between 0 and 100),
  status text not null default 'new'
    check (status in ('new', 'interested', 'hot', 'booked', 'lost')),
  phone text,
  phone_verified boolean not null default false,
  event_type text,
  event_date date,
  venue text,
  city text not null default 'Ankara',
  budget text,
  requested_services text[] not null default '{}',
  objections text,
  last_summary text,
  last_ai_response text,
  notes text,
  tags text[] not null default '{}',
  booking_probability integer
    check (booking_probability is null or booking_probability between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_profiles_instagram_id_key
  on public.customer_profiles (instagram_id)
  where instagram_id is not null;
create index if not exists customer_profiles_status_idx
  on public.customer_profiles (status);
create index if not exists customer_profiles_lead_score_idx
  on public.customer_profiles (lead_score desc);

drop trigger if exists set_customer_profiles_updated_at on public.customer_profiles;
create trigger set_customer_profiles_updated_at
  before update on public.customer_profiles
  for each row
  execute function public.set_updated_at();

alter table public.customer_profiles enable row level security;
-- ============================================================================
-- DO�RULAMA � Bu dosyay� �al��t�rd�ktan sonra sonucu kontrol etmek i�in
-- SQL Editor'de a�a��daki iki sorguyu ayr�ca �al��t�rabilirsiniz.
-- ============================================================================

-- 1) Toplam tablo say�s� (beklenen: 40 � learning tablolar� dahil)
select count(*) as toplam_tablo_sayisi
from information_schema.tables

-- ============================================================================
-- Reservation OS migrations 13-16 (append)
-- ============================================================================

-- Reservation OS core: catalog, plateaus, teams, settings, expand reservations,
-- reservation_items (schedule fields), reservation_changes.

-- ---------------------------------------------------------------------------
-- reservation_settings
-- ---------------------------------------------------------------------------
create table if not exists public.reservation_settings (
  id uuid primary key default gen_random_uuid(),
  default_deposit_amount numeric(12, 2) not null default 1000,
  default_currency text not null default 'TRY',
  default_travel_minutes integer not null default 60,
  auto_confirm_high_confidence_receipts boolean not null default false,
  timezone text not null default 'Europe/Istanbul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reservation_settings is
  'Rezervasyon OS genel ayarlari (kapora, yol suresi, auto-confirm).';

create trigger set_reservation_settings_updated_at
  before update on public.reservation_settings
  for each row
  execute function public.set_updated_at();

alter table public.reservation_settings enable row level security;

insert into public.reservation_settings (default_deposit_amount)
select 1000
where not exists (select 1 from public.reservation_settings);

-- ---------------------------------------------------------------------------
-- service_categories / services / service_campaigns
-- ---------------------------------------------------------------------------
create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_service_categories_updated_at
  before update on public.service_categories
  for each row
  execute function public.set_updated_at();

alter table public.service_categories enable row level security;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories (id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  base_price numeric(12, 2) not null check (base_price >= 0),
  currency text not null default 'TRY',
  service_type text not null default 'standard',
  default_duration_minutes integer not null default 120 check (default_duration_minutes >= 0),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists services_category_id_idx on public.services (category_id);
create index if not exists services_active_idx on public.services (active);

create trigger set_services_updated_at
  before update on public.services
  for each row
  execute function public.set_updated_at();

alter table public.services enable row level security;

create table if not exists public.service_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  campaign_type text not null default 'bundle'
    check (campaign_type in ('bundle', 'fixed_price', 'percentage', 'free_item')),
  discount_type text not null default 'fixed'
    check (discount_type in ('fixed', 'percentage', 'set_price', 'free')),
  discount_value numeric(12, 2) not null default 0,
  required_service_ids uuid[] not null default '{}',
  rewarded_service_id uuid references public.services (id) on delete set null,
  start_date date,
  end_date date,
  active boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_campaigns_active_idx on public.service_campaigns (active);

create trigger set_service_campaigns_updated_at
  before update on public.service_campaigns
  for each row
  execute function public.set_updated_at();

alter table public.service_campaigns enable row level security;

-- ---------------------------------------------------------------------------
-- plateaus / teams
-- ---------------------------------------------------------------------------
create table if not exists public.plateaus (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  address text,
  city text not null default 'Ankara',
  district text,
  active boolean not null default true,
  capacity integer,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_plateaus_updated_at
  before update on public.plateaus
  for each row
  execute function public.set_updated_at();

alter table public.plateaus enable row level security;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_teams_updated_at
  before update on public.teams
  for each row
  execute function public.set_updated_at();

alter table public.teams enable row level security;

-- ---------------------------------------------------------------------------
-- Expand reservations (drop old status check, add columns)
-- ---------------------------------------------------------------------------
alter table public.reservations drop constraint if exists reservations_status_check;

alter table public.reservations
  add column if not exists conversation_id uuid references public.conversations (id) on delete set null,
  add column if not exists customer_profile_id uuid references public.customer_profiles (id) on delete set null,
  add column if not exists customer_full_name text,
  add column if not exists customer_phone text,
  add column if not exists event_type text,
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists venue_type text,
  add column if not exists venue_name text,
  add column if not exists selected_plato_id uuid references public.plateaus (id) on delete set null,
  add column if not exists city text not null default 'Ankara',
  add column if not exists district text,
  add column if not exists selected_service_ids uuid[] not null default '{}',
  add column if not exists package_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists extra_services jsonb not null default '[]'::jsonb,
  add column if not exists subtotal numeric(12, 2) not null default 0,
  add column if not exists discount_amount numeric(12, 2) not null default 0,
  add column if not exists total_price numeric(12, 2) not null default 0,
  add column if not exists deposit_amount numeric(12, 2) not null default 1000,
  add column if not exists deposit_status text not null default 'not_requested',
  add column if not exists deposit_verified_at timestamptz,
  add column if not exists deposit_verified_by uuid references public.profiles (id) on delete set null,
  add column if not exists remaining_amount numeric(12, 2) not null default 0,
  add column if not exists remaining_payment_status text not null default 'unpaid',
  add column if not exists remaining_payment_due_at timestamptz,
  add column if not exists source text not null default 'manual',
  add column if not exists assigned_team_id uuid references public.teams (id) on delete set null,
  add column if not exists internal_notes text,
  add column if not exists customer_notes text,
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists time_status text not null default 'unknown',
  add column if not exists location_status text not null default 'unknown',
  add column if not exists needs_time_followup boolean not null default false,
  add column if not exists needs_location_followup boolean not null default false,
  add column if not exists conflict_override boolean not null default false,
  add column if not exists conflict_override_reason text,
  add column if not exists scheduled_start_at timestamptz,
  add column if not exists scheduled_end_at timestamptz,
  add column if not exists effective_busy_start_at timestamptz,
  add column if not exists effective_busy_end_at timestamptz;

-- Migrate legacy status values then apply new check
update public.reservations set status = 'inquiry' where status = 'pending';

alter table public.reservations
  alter column status set default 'draft';

alter table public.reservations
  add constraint reservations_status_check
  check (status in (
    'draft', 'inquiry', 'availability_check', 'pending_customer',
    'deposit_pending', 'payment_review', 'confirmed', 'completed',
    'cancelled', 'lost', 'shoot_completed'
  ));

alter table public.reservations
  drop constraint if exists reservations_deposit_status_check;
alter table public.reservations
  add constraint reservations_deposit_status_check
  check (deposit_status in (
    'not_requested', 'requested', 'receipt_uploaded', 'under_review',
    'verified', 'rejected', 'refunded'
  ));

alter table public.reservations
  drop constraint if exists reservations_remaining_payment_status_check;
alter table public.reservations
  add constraint reservations_remaining_payment_status_check
  check (remaining_payment_status in ('unpaid', 'partial', 'paid'));

alter table public.reservations
  drop constraint if exists reservations_source_check;
alter table public.reservations
  add constraint reservations_source_check
  check (source in ('manual', 'instagram_ai', 'admin_panel', 'website'));

alter table public.reservations
  drop constraint if exists reservations_time_status_check;
alter table public.reservations
  add constraint reservations_time_status_check
  check (time_status in ('unknown', 'approximate', 'confirmed'));

alter table public.reservations
  drop constraint if exists reservations_location_status_check;
alter table public.reservations
  add constraint reservations_location_status_check
  check (location_status in ('unknown', 'approximate', 'confirmed'));

create index if not exists reservations_event_date_idx on public.reservations (event_date);
create index if not exists reservations_status_idx on public.reservations (status);
create index if not exists reservations_selected_plato_id_idx on public.reservations (selected_plato_id);
create index if not exists reservations_assigned_team_id_idx on public.reservations (assigned_team_id);
create index if not exists reservations_effective_busy_idx
  on public.reservations (effective_busy_start_at, effective_busy_end_at);

-- ---------------------------------------------------------------------------
-- reservation_items
-- ---------------------------------------------------------------------------
create table if not exists public.reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  service_name_snapshot text not null,
  unit_price numeric(12, 2) not null default 0,
  quantity integer not null default 1 check (quantity > 0),
  discount_amount numeric(12, 2) not null default 0,
  final_price numeric(12, 2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  service_duration_minutes integer,
  travel_before_minutes integer not null default 0,
  preparation_before_minutes integer not null default 0,
  travel_after_minutes integer not null default 0,
  effective_busy_start_at timestamptz,
  effective_busy_end_at timestamptz,
  location_id uuid references public.plateaus (id) on delete set null,
  location_text text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  location_status text not null default 'unknown'
    check (location_status in ('unknown', 'approximate', 'confirmed')),
  time_status text not null default 'unknown'
    check (time_status in ('unknown', 'approximate', 'confirmed')),
  travel_time_source text not null default 'default'
    check (travel_time_source in ('default', 'manual', 'maps_api')),
  manual_travel_minutes integer,
  calculated_travel_minutes integer,
  route_distance_km numeric(10, 2),
  route_checked_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reservation_items_reservation_id_idx
  on public.reservation_items (reservation_id);

create trigger set_reservation_items_updated_at
  before update on public.reservation_items
  for each row
  execute function public.set_updated_at();

alter table public.reservation_items enable row level security;

-- ---------------------------------------------------------------------------
-- reservation_changes
-- ---------------------------------------------------------------------------
create table if not exists public.reservation_changes (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  changed_by_type text not null default 'system'
    check (changed_by_type in ('staff', 'ai', 'system', 'customer')),
  changed_by_id uuid,
  field_name text not null,
  old_value jsonb,
  new_value jsonb,
  reason text,
  requires_admin_approval boolean not null default false,
  approval_status text not null default 'applied'
    check (approval_status in ('pending', 'approved', 'rejected', 'applied')),
  created_at timestamptz not null default now()
);

create index if not exists reservation_changes_reservation_id_idx
  on public.reservation_changes (reservation_id);

alter table public.reservation_changes enable row level security;
-- Reservation OS: payment accounts + receipts

create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  account_holder_name text not null,
  iban text not null,
  currency text not null default 'TRY',
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payment_accounts is
  'Admin girisli IBAN bilgileri; AI yalnizca varsayilan aktif hesabi kullanir.';

create unique index if not exists payment_accounts_single_default_idx
  on public.payment_accounts (is_default)
  where is_default = true and active = true;

create trigger set_payment_accounts_updated_at
  before update on public.payment_accounts
  for each row
  execute function public.set_updated_at();

alter table public.payment_accounts enable row level security;

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  file_url text not null,
  file_hash text,
  original_filename text,
  uploaded_via text not null default 'admin_panel'
    check (uploaded_via in ('admin_panel', 'instagram', 'chatplace', 'website')),
  extracted_text text,
  detected_bank text,
  detected_sender_name text,
  detected_recipient_name text,
  detected_iban text,
  detected_amount numeric(12, 2),
  detected_currency text,
  detected_transaction_date date,
  detected_reference text,
  confidence_score numeric(4, 3),
  validation_result text,
  validation_reasons jsonb not null default '[]'::jsonb,
  manipulation_signals jsonb not null default '[]'::jsonb,
  receipt_verified boolean not null default false,
  payment_confirmed boolean not null default false,
  status text not null default 'uploaded'
    check (status in (
      'uploaded', 'analyzing', 'needs_review', 'verified', 'rejected'
    )),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_receipts_reservation_id_idx
  on public.payment_receipts (reservation_id);
create index if not exists payment_receipts_status_idx
  on public.payment_receipts (status);
create unique index if not exists payment_receipts_reference_unique_idx
  on public.payment_receipts (detected_reference)
  where detected_reference is not null;
create unique index if not exists payment_receipts_file_hash_unique_idx
  on public.payment_receipts (file_hash)
  where file_hash is not null;

alter table public.payment_receipts enable row level security;
-- Reservation OS: follow-ups + reminders

create table if not exists public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  reservation_id uuid references public.reservations (id) on delete set null,
  reason text not null,
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in (
      'pending', 'queued', 'sent', 'cancelled', 'failed', 'skipped'
    )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  message_template_id text,
  ai_generated_message text,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists follow_up_tasks_scheduled_at_idx
  on public.follow_up_tasks (scheduled_at)
  where status = 'pending';
create index if not exists follow_up_tasks_contact_id_idx
  on public.follow_up_tasks (contact_id);

create trigger set_follow_up_tasks_updated_at
  before update on public.follow_up_tasks
  for each row
  execute function public.set_updated_at();

alter table public.follow_up_tasks enable row level security;

create table if not exists public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  reminder_type text not null,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'cancelled', 'failed', 'skipped')),
  channel text not null default 'admin'
    check (channel in ('admin', 'customer', 'both')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (reservation_id, reminder_type, scheduled_at)
);

create index if not exists reminder_jobs_scheduled_at_idx
  on public.reminder_jobs (scheduled_at)
  where status = 'pending';

alter table public.reminder_jobs enable row level security;
-- Reservation OS seed: categories, services, campaigns, durations.
-- Fixed UUIDs for stable campaign wiring. IBAN is NOT seeded.

-- Categories
insert into public.service_categories (id, name, slug, description, sort_order) values
  ('a1000001-0001-4000-8000-000000000001', 'Dış Çekim', 'dis-cekim', 'Açık alan / plato dış çekim', 10),
  ('a1000001-0001-4000-8000-000000000002', 'Gelin Alma', 'gelin-alma', 'Gelin alma merasimi', 20),
  ('a1000001-0001-4000-8000-000000000003', 'Kına', 'kina', 'Kına gecesi çekimi', 30),
  ('a1000001-0001-4000-8000-000000000004', 'Kuaför & Hazırlık', 'kuafor-hazirlik', 'Kuaför ve hazırlık', 40),
  ('a1000001-0001-4000-8000-000000000005', 'Nikâh', 'nikah', 'Nikâh töreni', 50),
  ('a1000001-0001-4000-8000-000000000006', 'Nişan', 'nisan', 'Nişan töreni', 60),
  ('a1000001-0001-4000-8000-000000000007', 'Salon / Düğün', 'salon-dugun', 'Salon girişi ve düğün', 70)
on conflict (slug) do nothing;

-- Services (slug unique)
insert into public.services (id, category_id, name, slug, description, base_price, default_duration_minutes, service_type) values
  -- Dış çekim
  ('b2000001-0001-4000-8000-000000000001', 'a1000001-0001-4000-8000-000000000001', 'Fotoğraf', 'dis-cekim-fotograf', 'Poz sınırı yok, etkinliğe ait tüm kareler teslim.', 5000, 120, 'photo'),
  ('b2000001-0001-4000-8000-000000000002', 'a1000001-0001-4000-8000-000000000001', 'Video Klip — Dış Çekim', 'dis-cekim-video', 'Sinematik kurgu, etkinliğe özel klip teslimi.', 5000, 120, 'video'),
  ('b2000001-0001-4000-8000-000000000003', 'a1000001-0001-4000-8000-000000000001', 'Drone', 'dis-cekim-drone', 'Dış çekim drone.', 4000, 0, 'drone'),
  -- Gelin alma
  ('b2000001-0001-4000-8000-000000000011', 'a1000001-0001-4000-8000-000000000002', 'Fotoğraf', 'gelin-alma-fotograf', 'Gelin alma fotoğraf.', 5000, 60, 'photo'),
  ('b2000001-0001-4000-8000-000000000012', 'a1000001-0001-4000-8000-000000000002', 'Drone', 'gelin-alma-drone', 'Gelin alma drone.', 4000, 0, 'drone'),
  ('b2000001-0001-4000-8000-000000000013', 'a1000001-0001-4000-8000-000000000002', 'Omuz Kamera', 'gelin-alma-omuz', 'Gelin alma omuz kamera.', 6500, 60, 'shoulder_cam'),
  ('b2000001-0001-4000-8000-000000000014', 'a1000001-0001-4000-8000-000000000002', 'Gelin Alma Merasimi Klip', 'gelin-alma-klip', 'Kampanya fiyatı 3.500 TL.', 3500, 60, 'video'),
  -- Kına
  ('b2000001-0001-4000-8000-000000000021', 'a1000001-0001-4000-8000-000000000003', 'Fotoğraf', 'kina-fotograf', 'Kına fotoğraf.', 5000, 120, 'photo'),
  ('b2000001-0001-4000-8000-000000000022', 'a1000001-0001-4000-8000-000000000003', 'Video Klip — Kına', 'kina-video', 'Kına video klip.', 5000, 120, 'video'),
  ('b2000001-0001-4000-8000-000000000023', 'a1000001-0001-4000-8000-000000000003', 'Drone', 'kina-drone', 'Kına drone.', 4000, 0, 'drone'),
  ('b2000001-0001-4000-8000-000000000024', 'a1000001-0001-4000-8000-000000000003', 'Omuz Kamera', 'kina-omuz', 'Kına omuz kamera.', 6500, 120, 'shoulder_cam'),
  -- Kuaför
  ('b2000001-0001-4000-8000-000000000031', 'a1000001-0001-4000-8000-000000000004', 'Fotoğraf', 'kuafor-fotograf', 'Kuaför fotoğraf.', 5000, 90, 'photo'),
  ('b2000001-0001-4000-8000-000000000032', 'a1000001-0001-4000-8000-000000000004', 'Drone', 'kuafor-drone', 'Kuaför drone.', 4000, 0, 'drone'),
  ('b2000001-0001-4000-8000-000000000033', 'a1000001-0001-4000-8000-000000000004', 'Omuz Kamera', 'kuafor-omuz', 'Kuaför omuz kamera.', 6500, 90, 'shoulder_cam'),
  ('b2000001-0001-4000-8000-000000000034', 'a1000001-0001-4000-8000-000000000004', 'Kuaför & Hazırlık Klip', 'kuafor-klip', 'Normal 5.000 TL; foto+video ile 3.500 TL.', 5000, 90, 'video'),
  -- Nikâh
  ('b2000001-0001-4000-8000-000000000041', 'a1000001-0001-4000-8000-000000000005', 'Fotoğraf', 'nikah-fotograf', 'Nikâh fotoğraf.', 5000, 60, 'photo'),
  ('b2000001-0001-4000-8000-000000000042', 'a1000001-0001-4000-8000-000000000005', 'Video Klip — Nikâh', 'nikah-video', 'Nikâh video.', 5000, 60, 'video'),
  ('b2000001-0001-4000-8000-000000000043', 'a1000001-0001-4000-8000-000000000005', 'Drone', 'nikah-drone', 'Nikâh drone.', 4000, 0, 'drone'),
  ('b2000001-0001-4000-8000-000000000044', 'a1000001-0001-4000-8000-000000000005', 'Omuz Kamera', 'nikah-omuz', 'Nikâh omuz kamera.', 6500, 60, 'shoulder_cam'),
  -- Nişan
  ('b2000001-0001-4000-8000-000000000051', 'a1000001-0001-4000-8000-000000000006', 'Fotoğraf', 'nisan-fotograf', 'Nişan fotoğraf.', 5000, 120, 'photo'),
  ('b2000001-0001-4000-8000-000000000052', 'a1000001-0001-4000-8000-000000000006', 'Video Klip — Nişan', 'nisan-video', 'Nişan video.', 5000, 120, 'video'),
  ('b2000001-0001-4000-8000-000000000053', 'a1000001-0001-4000-8000-000000000006', 'Drone', 'nisan-drone', 'Nişan drone.', 4000, 0, 'drone'),
  ('b2000001-0001-4000-8000-000000000054', 'a1000001-0001-4000-8000-000000000006', 'Omuz Kamera', 'nisan-omuz', 'Nişan omuz kamera.', 6500, 120, 'shoulder_cam'),
  -- Salon
  ('b2000001-0001-4000-8000-000000000061', 'a1000001-0001-4000-8000-000000000007', 'Fotoğraf', 'salon-fotograf', 'Salon fotoğraf.', 5000, 60, 'photo'),
  ('b2000001-0001-4000-8000-000000000062', 'a1000001-0001-4000-8000-000000000007', 'Drone', 'salon-drone', 'Salon drone.', 4000, 0, 'drone'),
  ('b2000001-0001-4000-8000-000000000063', 'a1000001-0001-4000-8000-000000000007', 'Omuz Kamera', 'salon-omuz', 'Salon omuz kamera.', 6500, 60, 'shoulder_cam'),
  ('b2000001-0001-4000-8000-000000000064', 'a1000001-0001-4000-8000-000000000007', 'Salon Girişi & İlk Dans Klip', 'salon-giris-klip', 'Kampanya fiyatı 3.500 TL.', 3500, 60, 'video')
on conflict (slug) do nothing;

-- Campaigns
insert into public.service_campaigns (
  id, name, description, campaign_type, discount_type, discount_value,
  required_service_ids, rewarded_service_id, active, priority
) values
  (
    'c3000001-0001-4000-8000-000000000001',
    'Dış Çekim Foto+Video → Drone ücretsiz',
    'Dış çekimde Fotoğraf + Video Klip birlikte seçilirse Drone ücretsiz.',
    'free_item', 'free', 0,
    array[
      'b2000001-0001-4000-8000-000000000001'::uuid,
      'b2000001-0001-4000-8000-000000000002'::uuid
    ],
    'b2000001-0001-4000-8000-000000000003',
    true, 10
  ),
  (
    'c3000001-0001-4000-8000-000000000002',
    'Kuaför Foto+Video → Klip 3.500 TL',
    'Fotoğraf + video birlikte seçildiğinde kuaför klip fiyatı 3.500 TL.',
    'fixed_price', 'set_price', 3500,
    array[
      'b2000001-0001-4000-8000-000000000031'::uuid,
      'b2000001-0001-4000-8000-000000000034'::uuid
    ],
    'b2000001-0001-4000-8000-000000000034',
    true, 20
  )
on conflict (id) do nothing;

insert into public.teams (id, name, active)
values ('d4000001-0001-4000-8000-000000000001', 'Ana Ekip', true)
on conflict (id) do nothing;
where table_schema = 'public' and table_type = 'BASE TABLE';

-- 2) RLS'si kapal� olan tablolar (beklenen: 0 sat�r / bo� sonu�)
select c.relname as rls_kapali_tablo
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
-- Staff management: members, roles, unavailability, reservation assignments

create table if not exists public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.staff_roles is 'Personel gorev rolleri (ana cekim, fotografci, drone vb.).';

alter table public.staff_roles enable row level security;

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  profile_photo_url text,
  active boolean not null default true,
  notes text,
  default_start_time time,
  default_end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff_members is 'Panelden yonetilen cekim personeli.';

create index if not exists staff_members_active_idx on public.staff_members (active);

create trigger set_staff_members_updated_at
  before update on public.staff_members
  for each row
  execute function public.set_updated_at();

alter table public.staff_members enable row level security;

create table if not exists public.staff_member_roles (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members (id) on delete cascade,
  staff_role_id uuid not null references public.staff_roles (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (staff_member_id, staff_role_id)
);

create index if not exists staff_member_roles_member_idx
  on public.staff_member_roles (staff_member_id);
create index if not exists staff_member_roles_role_idx
  on public.staff_member_roles (staff_role_id);

alter table public.staff_member_roles enable row level security;

create table if not exists public.staff_unavailability (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  type text not null default 'manual_block'
    check (type in ('day_off', 'leave', 'sick', 'personal', 'manual_block')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index if not exists staff_unavailability_member_idx
  on public.staff_unavailability (staff_member_id);
create index if not exists staff_unavailability_range_idx
  on public.staff_unavailability (start_at, end_at);

create trigger set_staff_unavailability_updated_at
  before update on public.staff_unavailability
  for each row
  execute function public.set_updated_at();

alter table public.staff_unavailability enable row level security;

create table if not exists public.reservation_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  reservation_item_id uuid references public.reservation_items (id) on delete set null,
  staff_member_id uuid not null references public.staff_members (id) on delete restrict,
  assigned_role text not null,
  assignment_status text not null default 'assigned'
    check (assignment_status in (
      'proposed', 'assigned', 'accepted', 'declined', 'completed', 'cancelled'
    )),
  assigned_by uuid references public.profiles (id) on delete set null,
  notes text,
  override_conflict boolean not null default false,
  override_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reservation_staff_assignments_reservation_idx
  on public.reservation_staff_assignments (reservation_id);
create index if not exists reservation_staff_assignments_staff_idx
  on public.reservation_staff_assignments (staff_member_id);
create index if not exists reservation_staff_assignments_status_idx
  on public.reservation_staff_assignments (assignment_status);

create trigger set_reservation_staff_assignments_updated_at
  before update on public.reservation_staff_assignments
  for each row
  execute function public.set_updated_at();

alter table public.reservation_staff_assignments enable row level security;

-- services.required_role_slug optional override (nullable; logic can infer)
alter table public.services
  add column if not exists required_role_slug text;

-- Panel bildirimleri (personel atama vb.; ileride personel paneli icin)
create table if not exists public.panel_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  staff_member_id uuid references public.staff_members (id) on delete set null,
  reservation_id uuid references public.reservations (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists panel_notifications_created_at_idx
  on public.panel_notifications (created_at desc);
create index if not exists panel_notifications_unread_idx
  on public.panel_notifications (created_at desc)
  where read_at is null;

alter table public.panel_notifications enable row level security;

-- Personel islem audit log
create table if not exists public.staff_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists staff_audit_logs_created_at_idx
  on public.staff_audit_logs (created_at desc);
create index if not exists staff_audit_logs_entity_idx
  on public.staff_audit_logs (entity_type, entity_id);

alter table public.staff_audit_logs enable row level security;

-- Staff reminders: reminder_jobs'a personel baglantisi
alter table public.reminder_jobs
  add column if not exists staff_member_id uuid
    references public.staff_members (id) on delete cascade;

create index if not exists reminder_jobs_staff_member_idx
  on public.reminder_jobs (staff_member_id)
  where staff_member_id is not null;

-- Seed roles
insert into public.staff_roles (id, name, slug, description) values
  ('e5000001-0001-4000-8000-000000000001', 'Ana Ã‡ekim Sorumlusu', 'main_operator', 'Foto+video/drone/klip iÃ§eren ana Ã§ekimler'),
  ('e5000001-0001-4000-8000-000000000002', 'Etkinlik FotoÄŸrafÃ§Ä±sÄ±', 'event_photographer', 'NikÃ¢h/niÅŸan/kÄ±na yalnÄ±z fotoÄŸraf'),
  ('e5000001-0001-4000-8000-000000000003', 'DÃ¼ÄŸÃ¼n Salonu FotoÄŸrafÃ§Ä±sÄ±', 'wedding_venue_photographer', 'Salon yalnÄ±z fotoÄŸraf'),
  ('e5000001-0001-4000-8000-000000000004', 'Omuz Kamera OperatÃ¶rÃ¼', 'shoulder_camera_operator', 'Omuz kamera'),
  ('e5000001-0001-4000-8000-000000000005', 'Video OperatÃ¶rÃ¼', 'video_operator', 'Video Ã§ekimleri'),
  ('e5000001-0001-4000-8000-000000000006', 'Drone OperatÃ¶rÃ¼', 'drone_operator', 'Drone Ã§ekimleri'),
  ('e5000001-0001-4000-8000-000000000007', 'YardÄ±mcÄ± Personel', 'assistant', 'YardÄ±mcÄ± personel')
on conflict (slug) do nothing;

-- Staff management migration 17 appended

-- Customer memory extensions + Redmedia AI Brain

-- ---------------------------------------------------------------------------
-- customer_profiles: zengin mÃ¼ÅŸteri hafÄ±zasÄ±
-- ---------------------------------------------------------------------------
alter table public.customer_profiles
  add column if not exists memory_summary text,
  add column if not exists negotiation_tendency text,
  add column if not exists price_sensitivity text,
  add column if not exists rejected_services text[] not null default '{}',
  add column if not exists preferred_packages text[] not null default '{}',
  add column if not exists budget_range text,
  add column if not exists decision_speed text,
  add column if not exists prior_quote_received boolean not null default false,
  add column if not exists prior_reservation boolean not null default false,
  add column if not exists prior_cancellation boolean not null default false,
  add column if not exists interested_campaigns text[] not null default '{}',
  add column if not exists mentioned_dates text[] not null default '{}',
  add column if not exists preferred_style text,
  add column if not exists communication_tone text,
  add column if not exists uses_emoji boolean,
  add column if not exists formality text,
  add column if not exists frequent_questions text[] not null default '{}',
  add column if not exists customer_type text,
  add column if not exists customer_type_confidence numeric(4, 3),
  add column if not exists ai_notes text,
  add column if not exists memory_updated_at timestamptz;

comment on column public.customer_profiles.memory_summary is
  'Gecmis DM ozeti; ham gecmis yerine prompta gider.';

-- ---------------------------------------------------------------------------
-- knowledge_candidates (AI Brain onay kuyrugu)
-- ---------------------------------------------------------------------------
create table if not exists public.knowledge_candidates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'general',
  proposed_rule text not null,
  evidence_summary text,
  source_conversation_ids uuid[] not null default '{}',
  confidence_score numeric(4, 3) not null default 0.5
    check (confidence_score >= 0 and confidence_score <= 1),
  evidence_count integer not null default 1 check (evidence_count >= 0),
  source_count integer not null default 1 check (source_count >= 0),
  expected_impact text,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'archived', 'test_mode')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  knowledge_document_id uuid references public.knowledge_documents (id) on delete set null,
  valid_from timestamptz,
  valid_until timestamptz,
  last_validated_at timestamptz,
  last_observed_at timestamptz not null default now(),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_candidates_status_idx
  on public.knowledge_candidates (status, created_at desc);
create index if not exists knowledge_candidates_category_idx
  on public.knowledge_candidates (category);

create trigger set_knowledge_candidates_updated_at
  before update on public.knowledge_candidates
  for each row
  execute function public.set_updated_at();

alter table public.knowledge_candidates enable row level security;

-- ---------------------------------------------------------------------------
-- sales_learnings (onaylanmis satis ogrrenimleri)
-- ---------------------------------------------------------------------------
create table if not exists public.sales_learnings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  learning_type text not null default 'pattern',
  content text not null,
  customer_type text,
  confidence_score numeric(4, 3) not null default 0.5,
  evidence_count integer not null default 1,
  source_count integer not null default 1,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  last_validated_at timestamptz,
  last_observed_at timestamptz not null default now(),
  active boolean not null default true,
  knowledge_candidate_id uuid references public.knowledge_candidates (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_learnings_active_idx
  on public.sales_learnings (active, last_observed_at desc)
  where active = true;

create trigger set_sales_learnings_updated_at
  before update on public.sales_learnings
  for each row
  execute function public.set_updated_at();

alter table public.sales_learnings enable row level security;

-- ---------------------------------------------------------------------------
-- admin_ai_corrections
-- ---------------------------------------------------------------------------
create table if not exists public.admin_ai_corrections (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  ai_message_id uuid references public.messages (id) on delete set null,
  staff_message_id uuid references public.messages (id) on delete set null,
  ai_text text not null,
  staff_text text not null,
  reason text,
  customer_type text,
  led_to_sale boolean,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists admin_ai_corrections_created_at_idx
  on public.admin_ai_corrections (created_at desc);

alter table public.admin_ai_corrections enable row level security;

-- ---------------------------------------------------------------------------
-- conversation_outcomes (konusma sonuclari)
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_outcomes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  outcome text not null
    check (outcome in (
      'sale', 'draft_created', 'deposit_requested', 'deposit_sent',
      'customer_abandoned', 'no_reply', 'admin_took_over',
      'admin_corrected_ai', 'positive', 'negative', 'unknown'
    )),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  unique (conversation_id, outcome)
);

create index if not exists conversation_outcomes_outcome_idx
  on public.conversation_outcomes (outcome, recorded_at desc);

alter table public.conversation_outcomes enable row level security;
-- Smart sales: lifecycle, opportunity, admin notes, timeline, satisfaction

alter table public.customer_profiles
  add column if not exists lifecycle_stage text not null default 'new_customer'
    check (lifecycle_stage in (
      'new_customer',
      'gathering_info',
      'price_given',
      'negotiating',
      'awaiting_reservation',
      'awaiting_deposit',
      'awaiting_receipt',
      'reservation_confirmed',
      'shoot_completed',
      'delivery',
      'completed',
      'cancelled',
      'passive'
    )),
  add column if not exists opportunity_score integer not null default 0
    check (opportunity_score between 0 and 100),
  add column if not exists admin_notes text,
  add column if not exists last_outbound_at timestamptz,
  add column if not exists satisfaction_flow_status text
    check (satisfaction_flow_status is null or satisfaction_flow_status in (
      'pending', 'thanks_sent', 'review_asked', 'referral_asked', 'done', 'skipped'
    ));

create index if not exists customer_profiles_lifecycle_stage_idx
  on public.customer_profiles (lifecycle_stage);
create index if not exists customer_profiles_opportunity_score_idx
  on public.customer_profiles (opportunity_score desc);

-- MÃ¼ÅŸteri zaman Ã§izgisi olaylarÄ±
create table if not exists public.customer_timeline_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  reservation_id uuid references public.reservations (id) on delete set null,
  event_type text not null,
  title text not null,
  body text,
  actor_type text not null default 'system'
    check (actor_type in ('system', 'ai', 'staff', 'customer')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists customer_timeline_events_contact_idx
  on public.customer_timeline_events (contact_id, occurred_at desc);

alter table public.customer_timeline_events enable row level security;

-- Admin notlarÄ± (yalnÄ±zca ekip; AI prompt'ta gizli kullanÄ±m)
create table if not exists public.customer_admin_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_admin_notes_contact_idx
  on public.customer_admin_notes (contact_id, created_at desc);

create trigger set_customer_admin_notes_updated_at
  before update on public.customer_admin_notes
  for each row
  execute function public.set_updated_at();

alter table public.customer_admin_notes enable row level security;

-- Memnuniyet / referans gÃ¶revleri
create table if not exists public.satisfaction_tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  reservation_id uuid references public.reservations (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  step text not null
    check (step in ('thanks', 'review', 'google', 'instagram_tag', 'referral')),
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'sent', 'cancelled', 'skipped')),
  message_template text,
  created_at timestamptz not null default now(),
  unique (reservation_id, step)
);

create index if not exists satisfaction_tasks_scheduled_idx
  on public.satisfaction_tasks (scheduled_at)
  where status = 'pending';

alter table public.satisfaction_tasks enable row level security;

-- CEO Intelligence (20260717000020)
create table if not exists public.ceo_daily_briefs (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  metrics jsonb not null default '{}'::jsonb,
  summary_bullets text[] not null default '{}',
  narrative text,
  risks jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  action_items jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  model text,
  created_at timestamptz not null default now(),
  unique (report_date)
);
create index if not exists ceo_daily_briefs_generated_idx on public.ceo_daily_briefs (generated_at desc);
alter table public.ceo_daily_briefs enable row level security;

create table if not exists public.ceo_daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  metrics jsonb not null default '{}'::jsonb,
  content_markdown text not null,
  highlights jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  model text,
  created_at timestamptz not null default now(),
  unique (report_date)
);
create index if not exists ceo_daily_reports_date_idx on public.ceo_daily_reports (report_date desc);
alter table public.ceo_daily_reports enable row level security;

create table if not exists public.ceo_assistant_logs (
  id uuid primary key default gen_random_uuid(),
  asked_by uuid references public.profiles (id) on delete set null,
  question text not null,
  answer text not null,
  data_snapshot jsonb not null default '{}'::jsonb,
  model text,
  status text not null default 'completed'
    check (status in ('completed', 'no_data', 'error')),
  created_at timestamptz not null default now()
);
create index if not exists ceo_assistant_logs_created_idx on public.ceo_assistant_logs (created_at desc);
alter table public.ceo_assistant_logs enable row level security;
-- AI Marketing Director
-- Mevcut campaigns / ad_sets / ads / ad_creatives / ad_daily_metrics yeniden kullanÄ±lÄ±r.
-- organization_id YOK (single-tenant Redmedia).
-- AI kampanya kapatmaz / bÃ¼tÃ§e deÄŸiÅŸtirmez; yalnÄ±zca Ã¶neri kaydÄ±.

-- BaÄŸlantÄ± durumu (token deÄŸerleri burada tutulmaz; env / vault)
create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  connection_type text not null
    check (connection_type in (
      'meta_business',
      'meta_ad_account',
      'facebook_page',
      'instagram_business',
      'meta_pixel',
      'conversions_api'
    )),
  display_name text,
  external_id text,
  status text not null default 'disconnected'
    check (status in (
      'connected',
      'disconnected',
      'error',
      'token_expired',
      'configured'
    )),
  last_synced_at timestamptz,
  last_tested_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_type)
);

create trigger set_meta_connections_updated_at
  before update on public.meta_connections
  for each row execute function public.set_updated_at();

alter table public.meta_connections enable row level security;

insert into public.meta_connections (connection_type, display_name, status)
values
  ('meta_business', 'Meta Business', 'disconnected'),
  ('meta_ad_account', 'Meta reklam hesabÄ±', 'disconnected'),
  ('facebook_page', 'Facebook sayfasÄ±', 'disconnected'),
  ('instagram_business', 'Instagram Business hesabÄ±', 'disconnected'),
  ('meta_pixel', 'Meta Pixel', 'disconnected'),
  ('conversions_api', 'Conversions API', 'disconnected')
on conflict (connection_type) do nothing;

-- Mevcut metrik tablosuna opsiyonel alanlar (hesaplanabilir metrikler iÃ§in cache)
alter table public.ad_daily_metrics
  add column if not exists frequency numeric(10, 4),
  add column if not exists cpm numeric(12, 4),
  add column if not exists cpc numeric(12, 4),
  add column if not exists ctr numeric(10, 6);

-- Instagram iÃ§erikleri
create table if not exists public.instagram_media (
  id uuid primary key default gen_random_uuid(),
  meta_media_id text not null unique,
  media_type text not null default 'IMAGE'
    check (media_type in ('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM', 'REELS', 'STORY', 'OTHER')),
  caption text,
  permalink text,
  thumbnail_url text,
  media_url text,
  published_at timestamptz,
  used_in_ads boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists instagram_media_published_idx
  on public.instagram_media (published_at desc nulls last);

create trigger set_instagram_media_updated_at
  before update on public.instagram_media
  for each row execute function public.set_updated_at();

alter table public.instagram_media enable row level security;

create table if not exists public.instagram_media_insights (
  id uuid primary key default gen_random_uuid(),
  instagram_media_id uuid not null references public.instagram_media (id) on delete cascade,
  insight_date date not null default (timezone('Europe/Istanbul', now()))::date,
  likes integer not null default 0,
  comments integer not null default 0,
  saves integer not null default 0,
  shares integer not null default 0,
  plays integer not null default 0,
  reach integer not null default 0,
  engagement_rate numeric(10, 6),
  created_at timestamptz not null default now(),
  unique (instagram_media_id, insight_date)
);

create index if not exists instagram_media_insights_media_idx
  on public.instagram_media_insights (instagram_media_id);

alter table public.instagram_media_insights enable row level security;

-- GÃ¶nderi â†” reklam baÄŸlarÄ±
create table if not exists public.instagram_media_ad_links (
  id uuid primary key default gen_random_uuid(),
  instagram_media_id uuid not null references public.instagram_media (id) on delete cascade,
  ad_id uuid not null references public.ads (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (instagram_media_id, ad_id)
);

alter table public.instagram_media_ad_links enable row level security;

-- CRM mÃ¼ÅŸteri attribution (ayrÄ± tablo)
create table if not exists public.customer_attributions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  source_platform text,
  source_type text not null default 'unknown'
    check (source_type in (
      'instagram_organic',
      'instagram_ad',
      'facebook_ad',
      'referral',
      'google',
      'website',
      'phone',
      'whatsapp',
      'returning_customer',
      'other',
      'unknown'
    )),
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  meta_creative_id text,
  campaign_id uuid references public.campaigns (id) on delete set null,
  ad_set_id uuid references public.ad_sets (id) on delete set null,
  ad_id uuid references public.ads (id) on delete set null,
  creative_id uuid references public.ad_creatives (id) on delete set null,
  instagram_media_id uuid references public.instagram_media (id) on delete set null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  fbclid text,
  first_touch_at timestamptz,
  last_touch_at timestamptz,
  attribution_status text not null default 'unknown'
    check (attribution_status in ('exact', 'probable', 'manual', 'unknown')),
  attribution_confidence numeric(5, 2)
    check (attribution_confidence is null or (attribution_confidence >= 0 and attribution_confidence <= 100)),
  attribution_method text,
  notes text,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id)
);

create index if not exists customer_attributions_status_idx
  on public.customer_attributions (attribution_status);
create index if not exists customer_attributions_campaign_idx
  on public.customer_attributions (campaign_id);
create index if not exists customer_attributions_source_type_idx
  on public.customer_attributions (source_type);

create trigger set_customer_attributions_updated_at
  before update on public.customer_attributions
  for each row execute function public.set_updated_at();

alter table public.customer_attributions enable row level security;

create table if not exists public.attribution_audit_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  attribution_id uuid references public.customer_attributions (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists attribution_audit_logs_contact_idx
  on public.attribution_audit_logs (contact_id, created_at desc);

alter table public.attribution_audit_logs enable row level security;

-- AI stratejileri (yalnÄ±zca Ã¶neri; uygulama yok)
create table if not exists public.marketing_strategies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  period_type text not null default 'monthly'
    check (period_type in ('daily', 'weekly', 'monthly', 'custom')),
  budget_amount numeric(14, 2) not null,
  currency text not null default 'TRY',
  data_range_start date,
  data_range_end date,
  data_sufficiency text not null default 'insufficient'
    check (data_sufficiency in ('sufficient', 'partial', 'insufficient')),
  overall_confidence numeric(5, 2),
  status text not null default 'draft'
    check (status in ('draft', 'presented', 'accepted', 'rejected', 'archived')),
  summary text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_marketing_strategies_updated_at
  before update on public.marketing_strategies
  for each row execute function public.set_updated_at();

alter table public.marketing_strategies enable row level security;

create table if not exists public.marketing_strategy_items (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.marketing_strategies (id) on delete cascade,
  item_type text not null
    check (item_type in (
      'budget_allocation',
      'continue',
      'increase_budget',
      'decrease_budget',
      'pause_suggest',
      'remarketing',
      'test_content',
      'new_experiment',
      'other'
    )),
  recommendation text not null,
  suggested_budget numeric(14, 2),
  expected_goal text not null,
  rationale text not null,
  data_range_label text not null,
  data_sufficiency text not null
    check (data_sufficiency in ('sufficient', 'partial', 'insufficient')),
  confidence_level numeric(5, 2) not null
    check (confidence_level >= 0 and confidence_level <= 100),
  related_campaign_id uuid references public.campaigns (id) on delete set null,
  related_ad_id uuid references public.ads (id) on delete set null,
  related_instagram_media_id uuid references public.instagram_media (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists marketing_strategy_items_strategy_idx
  on public.marketing_strategy_items (strategy_id);

alter table public.marketing_strategy_items enable row level security;

-- AI Strategy History
create table if not exists public.marketing_strategy_history (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid references public.marketing_strategies (id) on delete set null,
  event_type text not null
    check (event_type in (
      'generated',
      'presented',
      'item_updated',
      'accepted',
      'rejected',
      'archived',
      'note'
    )),
  title text not null,
  detail text,
  confidence_level numeric(5, 2),
  rationale text,
  snapshot jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists marketing_strategy_history_strategy_idx
  on public.marketing_strategy_history (strategy_id, created_at desc);
create index if not exists marketing_strategy_history_created_idx
  on public.marketing_strategy_history (created_at desc);

alter table public.marketing_strategy_history enable row level security;

-- Deney motoru (tek deÄŸiÅŸken)
create table if not exists public.marketing_experiments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  experiment_type text not null
    check (experiment_type in (
      'creative',
      'audience',
      'ad_copy',
      'cta',
      'placement'
    )),
  hypothesis text not null,
  control_ad_id uuid references public.ads (id) on delete set null,
  test_ad_id uuid references public.ads (id) on delete set null,
  changed_variable text not null,
  start_date date,
  end_date date,
  budget_amount numeric(14, 2),
  primary_success_metric text not null default 'deposit'
    check (primary_success_metric in (
      'deposit',
      'reservation',
      'revenue',
      'qualified_customer',
      'message'
    )),
  minimum_data_threshold integer not null default 10,
  result_summary text,
  winner text
    check (winner is null or winner in ('control', 'test', 'inconclusive', 'none')),
  confidence_level numeric(5, 2),
  rationale text,
  learned_insight text,
  status text not null default 'draft'
    check (status in (
      'draft',
      'running',
      'completed',
      'cancelled',
      'insufficient_data'
    )),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_marketing_experiments_updated_at
  before update on public.marketing_experiments
  for each row execute function public.set_updated_at();

alter table public.marketing_experiments enable row level security;

-- Marketing memory / learnings
create table if not exists public.marketing_learnings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  data_range_start date,
  data_range_end date,
  related_campaign_ids uuid[] not null default '{}',
  related_ad_ids uuid[] not null default '{}',
  supporting_experiment_count integer not null default 0,
  confidence_level numeric(5, 2) not null default 0
    check (confidence_level >= 0 and confidence_level <= 100),
  rationale text not null default '',
  status text not null default 'hypothesis'
    check (status in (
      'hypothesis',
      'testing',
      'validated',
      'rejected',
      'archived'
    )),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_marketing_learnings_updated_at
  before update on public.marketing_learnings
  for each row execute function public.set_updated_at();

alter table public.marketing_learnings enable row level security;

-- Sync loglarÄ±
create table if not exists public.marketing_sync_logs (
  id uuid primary key default gen_random_uuid(),
  sync_type text not null
    check (sync_type in (
      'ads',
      'insights',
      'instagram',
      'attribution',
      'connection_test',
      'other'
    )),
  api_endpoint_kind text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'started'
    check (status in ('started', 'success', 'partial', 'failed', 'skipped')),
  records_fetched integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists marketing_sync_logs_started_idx
  on public.marketing_sync_logs (started_at desc);

alter table public.marketing_sync_logs enable row level security;

-- Meta OAuth token depolama (yalnÄ±zca sunucu / service role)
-- Token deÄŸerleri frontend'e asla gÃ¶nderilmez.

create table if not exists public.meta_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'meta' check (provider = 'meta'),
  access_token text not null,
  token_type text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  meta_user_id text,
  meta_user_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meta_oauth_tokens_active_idx
  on public.meta_oauth_tokens (is_active, expires_at desc);

create trigger set_meta_oauth_tokens_updated_at
  before update on public.meta_oauth_tokens
  for each row execute function public.set_updated_at();

alter table public.meta_oauth_tokens enable row level security;

comment on table public.meta_oauth_tokens is
  'Meta uzun Ã¶mÃ¼rlÃ¼ access token. YalnÄ±zca service role ile okunur.';

-- ============================================================================
-- 20260717000023_meta_connection_configured_status.sql
-- Mevcut tabloda check constraint'i 'configured' durumunu icerecek sekilde
-- yeniler (create table if not exists mevcut tabloyu guncellemedigi icin
-- bu ALTER zorunludur).
-- ============================================================================

alter table public.meta_connections
  drop constraint if exists meta_connections_status_check;

alter table public.meta_connections
  add constraint meta_connections_status_check
  check (status in (
    'connected',
    'disconnected',
    'error',
    'token_expired',
    'configured'
  ));

-- ============================================================================
-- 20260717000024_ai_attribution_engine.sql
-- Modul 9: AI Attribution Engine
-- Lead -> Rezervasyon -> Kapora -> Cekim -> Teslim -> Gelir zinciri
-- ============================================================================

create table if not exists public.attribution_funnel_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  reservation_id uuid references public.reservations (id) on delete set null,
  attribution_id uuid references public.customer_attributions (id) on delete set null,
  stage text not null check (stage in (
    'dm',
    'lead',
    'reservation',
    'kapora',
    'shoot',
    'delivery',
    'revenue'
  )),
  occurred_at timestamptz not null default now(),
  amount numeric(12, 2),
  currency text not null default 'TRY',
  campaign_id uuid references public.campaigns (id) on delete set null,
  ad_id uuid references public.ads (id) on delete set null,
  attribution_status text check (
    attribution_status is null
    or attribution_status in ('exact', 'probable', 'manual', 'unknown')
  ),
  attribution_confidence numeric(5, 2)
    check (
      attribution_confidence is null
      or (attribution_confidence >= 0 and attribution_confidence <= 100)
    ),
  source_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists attribution_funnel_events_contact_stage_null_res_uidx
  on public.attribution_funnel_events (contact_id, stage)
  where reservation_id is null;

create unique index if not exists attribution_funnel_events_contact_res_stage_uidx
  on public.attribution_funnel_events (contact_id, reservation_id, stage)
  where reservation_id is not null;

create index if not exists attribution_funnel_events_contact_idx
  on public.attribution_funnel_events (contact_id, occurred_at desc);

create index if not exists attribution_funnel_events_campaign_idx
  on public.attribution_funnel_events (campaign_id, stage);

create index if not exists attribution_funnel_events_stage_idx
  on public.attribution_funnel_events (stage, occurred_at desc);

alter table public.attribution_funnel_events enable row level security;

alter table public.marketing_learnings
  add column if not exists source_reservation_id uuid
    references public.reservations (id) on delete set null;

alter table public.marketing_learnings
  add column if not exists source_contact_id uuid
    references public.contacts (id) on delete set null;

create index if not exists marketing_learnings_reservation_idx
  on public.marketing_learnings (source_reservation_id);

create table if not exists public.marketing_daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null unique,
  summary_md text not null,
  metrics jsonb not null default '{}'::jsonb,
  campaign_rows jsonb not null default '[]'::jsonb,
  learnings_snapshot jsonb not null default '[]'::jsonb,
  data_sufficiency text not null default 'partial'
    check (data_sufficiency in ('sufficient', 'partial', 'insufficient')),
  overall_confidence numeric(5, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace trigger set_marketing_daily_reports_updated_at
  before update on public.marketing_daily_reports
  for each row execute function public.set_updated_at();

alter table public.marketing_daily_reports enable row level security;

comment on table public.attribution_funnel_events is
  'Attribution funnel timeline. Gelir yalnizca dogrulanmis rezervasyon/kapora verisine dayanir.';

comment on table public.marketing_daily_reports is
  'Gunluk AI Marketing Report. Kampanya kapatma/butce degisikligi icermez.';

-- ---------------------------------------------------------------------------
-- 20260718000025_conversations_whatsapp_channel.sql
-- ---------------------------------------------------------------------------

alter table public.conversations
  drop constraint if exists conversations_channel_check;

alter table public.conversations
  add constraint conversations_channel_check
  check (channel in ('instagram', 'facebook', 'whatsapp'));

-- ---------------------------------------------------------------------------
-- 20260718000026_conversation_sales_scores.sql
-- ---------------------------------------------------------------------------

alter table public.conversation_analyses
  add column if not exists score_sales_quality integer
    check (score_sales_quality is null or score_sales_quality between 0 and 100),
  add column if not exists score_empathy integer
    check (score_empathy is null or score_empathy between 0 and 100),
  add column if not exists score_speed integer
    check (score_speed is null or score_speed between 0 and 100),
  add column if not exists score_persuasion integer
    check (score_persuasion is null or score_persuasion between 0 and 100),
  add column if not exists score_closing integer
    check (score_closing is null or score_closing between 0 and 100),
  add column if not exists score_notes text,
  add column if not exists first_customer_question text,
  add column if not exists first_reply_given text,
  add column if not exists drop_off_point text,
  add column if not exists reservation_created boolean not null default false,
  add column if not exists deposit_received boolean not null default false,
  add column if not exists is_best_conversation boolean not null default false;

create index if not exists conversation_analyses_best_idx
  on public.conversation_analyses (is_best_conversation)
  where is_best_conversation = true;

create index if not exists conversation_analyses_sales_quality_idx
  on public.conversation_analyses (score_sales_quality desc nulls last);

-- ---------------------------------------------------------------------------
-- 20260718000027_sales_patterns.sql
-- ---------------------------------------------------------------------------

create table if not exists public.sales_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_type text not null check (pattern_type in (
    'opening',
    'price_explanation',
    'trust_building',
    'objection_response',
    'closing',
    'failure',
    'leave_reason'
  )),
  pattern_text text not null,
  pattern_key text not null,
  context_note text,
  won_count integer not null default 0,
  lost_count integer not null default 0,
  seen_count integer not null default 0,
  success_rate numeric(5, 2)
    check (success_rate is null or (success_rate >= 0 and success_rate <= 100)),
  confidence numeric(5, 2) not null default 30
    check (confidence >= 0 and confidence <= 100),
  status text not null default 'active'
    check (status in ('active', 'superseded')),
  superseded_by uuid references public.sales_patterns (id) on delete set null,
  source_conversation_ids uuid[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sales_patterns_type_key_uidx
  on public.sales_patterns (pattern_type, pattern_key);

create index if not exists sales_patterns_type_success_idx
  on public.sales_patterns (pattern_type, success_rate desc nulls last);

create index if not exists sales_patterns_status_idx
  on public.sales_patterns (status);

create or replace trigger set_sales_patterns_updated_at
  before update on public.sales_patterns
  for each row execute function public.set_updated_at();

alter table public.sales_patterns enable row level security;

-- ---------------------------------------------------------------------------
-- 20260718000028_company_personality.sql
-- ---------------------------------------------------------------------------

create table if not exists public.company_personality_traits (
  id uuid primary key default gen_random_uuid(),
  trait_type text not null check (trait_type in (
    'tone',
    'pricing_style',
    'phone_timing',
    'service_offering',
    'vocabulary',
    'trust_style'
  )),
  trait_text text not null,
  trait_key text not null,
  evidence_count integer not null default 1,
  confidence numeric(5, 2) not null default 30
    check (confidence >= 0 and confidence <= 100),
  status text not null default 'active'
    check (status in ('active', 'superseded')),
  source_conversation_ids uuid[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists company_personality_traits_type_key_uidx
  on public.company_personality_traits (trait_type, trait_key);

create index if not exists company_personality_traits_type_idx
  on public.company_personality_traits (trait_type, confidence desc);

create or replace trigger set_company_personality_traits_updated_at
  before update on public.company_personality_traits
  for each row execute function public.set_updated_at();

alter table public.company_personality_traits enable row level security;

-- ---------------------------------------------------------------------------
-- 20260718000029_ai_mistakes.sql
-- ---------------------------------------------------------------------------

create table if not exists public.ai_mistakes (
  id uuid primary key default gen_random_uuid(),
  mistake_type text not null check (mistake_type in (
    'premature_detail_question',
    'premature_phone_request',
    'wrong_information',
    'missed_buying_signal',
    'repeated_question',
    'tone_mismatch',
    'other'
  )),
  trigger_context text not null,
  wrong_reply text,
  correct_approach text not null,
  mistake_key text not null,
  occurrence_count integer not null default 1,
  is_resolved boolean not null default false,
  resolved_note text,
  source_conversation_id uuid
    references public.conversations (id) on delete set null,
  source_ai_run_id uuid
    references public.ai_runs (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_mistakes_key_uidx
  on public.ai_mistakes (mistake_key);

create index if not exists ai_mistakes_active_idx
  on public.ai_mistakes (is_resolved, last_seen_at desc);

create or replace trigger set_ai_mistakes_updated_at
  before update on public.ai_mistakes
  for each row execute function public.set_updated_at();

alter table public.ai_mistakes enable row level security;

-- ---------------------------------------------------------------------------
-- 20260718000030_ai_weekly_reports.sql
-- ---------------------------------------------------------------------------

create table if not exists public.ai_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  week_end date not null,
  summary_md text not null,
  learned_items jsonb not null default '[]'::jsonb,
  mistakes_made jsonb not null default '[]'::jsonb,
  mistakes_fixed jsonb not null default '[]'::jsonb,
  new_techniques jsonb not null default '[]'::jsonb,
  best_replies jsonb not null default '[]'::jsonb,
  worst_replies jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  data_sufficiency text not null default 'partial'
    check (data_sufficiency in ('sufficient', 'partial', 'insufficient')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_weekly_reports_week_idx
  on public.ai_weekly_reports (week_start desc);

create or replace trigger set_ai_weekly_reports_updated_at
  before update on public.ai_weekly_reports
  for each row execute function public.set_updated_at();

alter table public.ai_weekly_reports enable row level security;

notify pgrst, 'reload schema';

