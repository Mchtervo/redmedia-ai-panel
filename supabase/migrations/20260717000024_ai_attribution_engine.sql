-- Modül 9: AI Attribution Engine
-- Lead → Rezervasyon → Kapora → Çekim → Teslim → Gelir zinciri
-- Doğrulanabilir eşleşme = exact; aksi halde probable + güven %

-- Funnel timeline olayları (müşteri/lead bazlı)
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

-- NULL reservation_id (dm/lead) için tek satır; rezervasyon aşamaları ayrı
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

-- Rezervasyondan öğrenim bağlantısı
alter table public.marketing_learnings
  add column if not exists source_reservation_id uuid
    references public.reservations (id) on delete set null;

alter table public.marketing_learnings
  add column if not exists source_contact_id uuid
    references public.contacts (id) on delete set null;

create index if not exists marketing_learnings_reservation_idx
  on public.marketing_learnings (source_reservation_id);

-- Günlük AI Marketing Report
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

create trigger set_marketing_daily_reports_updated_at
  before update on public.marketing_daily_reports
  for each row execute function public.set_updated_at();

alter table public.marketing_daily_reports enable row level security;

comment on table public.attribution_funnel_events is
  'Attribution funnel timeline. Gelir yalnızca doğrulanmış rezervasyon/kapora verisine dayanır.';

comment on table public.marketing_daily_reports is
  'Günlük AI Marketing Report. Kampanya kapatma/bütçe değişikliği içermez.';
