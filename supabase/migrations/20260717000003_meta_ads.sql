-- Meta reklam hiyerarşisi: ad_accounts -> campaigns -> ad_sets -> ads -> ad_creatives
-- ve günlük performans metrikleri (ad_daily_metrics).
-- Kolonlar kullanıcı tarafından belirtilmedi (ad_daily_metrics hariç); docs/META.md'deki
-- "yalnızca okuma/analiz" kapsamına göre v1 taslağı.

create table public.ad_accounts (
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

create trigger set_ad_accounts_updated_at
  before update on public.ad_accounts
  for each row
  execute function public.set_updated_at();

alter table public.ad_accounts enable row level security;

create table public.campaigns (
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

create index campaigns_ad_account_id_idx on public.campaigns (ad_account_id);

create trigger set_campaigns_updated_at
  before update on public.campaigns
  for each row
  execute function public.set_updated_at();

alter table public.campaigns enable row level security;

create table public.ad_sets (
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

create index ad_sets_campaign_id_idx on public.ad_sets (campaign_id);

create trigger set_ad_sets_updated_at
  before update on public.ad_sets
  for each row
  execute function public.set_updated_at();

alter table public.ad_sets enable row level security;

create table public.ads (
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

create index ads_ad_set_id_idx on public.ads (ad_set_id);

create trigger set_ads_updated_at
  before update on public.ads
  for each row
  execute function public.set_updated_at();

alter table public.ads enable row level security;

create table public.ad_creatives (
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

create index ad_creatives_ad_id_idx on public.ad_creatives (ad_id);

alter table public.ad_creatives enable row level security;

-- ad_daily_metrics: kullanıcı tarafından belirtilen kolonlarla birebir oluşturuldu.
create table public.ad_daily_metrics (
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

create index ad_daily_metrics_ad_id_idx on public.ad_daily_metrics (ad_id);
create index ad_daily_metrics_date_idx on public.ad_daily_metrics (date);

alter table public.ad_daily_metrics enable row level security;
