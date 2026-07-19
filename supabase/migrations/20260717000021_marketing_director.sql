-- AI Marketing Director
-- Mevcut campaigns / ad_sets / ads / ad_creatives / ad_daily_metrics yeniden kullanılır.
-- organization_id YOK (single-tenant Redmedia).
-- AI kampanya kapatmaz / bütçe değiştirmez; yalnızca öneri kaydı.

-- Bağlantı durumu (token değerleri burada tutulmaz; env / vault)
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
      'token_expired'
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
  ('meta_ad_account', 'Meta reklam hesabı', 'disconnected'),
  ('facebook_page', 'Facebook sayfası', 'disconnected'),
  ('instagram_business', 'Instagram Business hesabı', 'disconnected'),
  ('meta_pixel', 'Meta Pixel', 'disconnected'),
  ('conversions_api', 'Conversions API', 'disconnected')
on conflict (connection_type) do nothing;

-- Mevcut metrik tablosuna opsiyonel alanlar (hesaplanabilir metrikler için cache)
alter table public.ad_daily_metrics
  add column if not exists frequency numeric(10, 4),
  add column if not exists cpm numeric(12, 4),
  add column if not exists cpc numeric(12, 4),
  add column if not exists ctr numeric(10, 6);

-- Instagram içerikleri
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

-- Gönderi ↔ reklam bağları
create table if not exists public.instagram_media_ad_links (
  id uuid primary key default gen_random_uuid(),
  instagram_media_id uuid not null references public.instagram_media (id) on delete cascade,
  ad_id uuid not null references public.ads (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (instagram_media_id, ad_id)
);

alter table public.instagram_media_ad_links enable row level security;

-- CRM müşteri attribution (ayrı tablo)
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

-- AI stratejileri (yalnızca öneri; uygulama yok)
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

-- Deney motoru (tek değişken)
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

-- Sync logları
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
