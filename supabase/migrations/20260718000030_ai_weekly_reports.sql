-- AI Sales Learning Engine: Quality Control.
-- Haftalık AI öz değerlendirme raporu: öğrendiklerim, hatalarım,
-- düzelttiklerim, yeni satış teknikleri, en başarılı/başarısız cevaplar.

create table if not exists public.ai_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,   -- Pazartesi (Europe/Istanbul)
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

create trigger set_ai_weekly_reports_updated_at
  before update on public.ai_weekly_reports
  for each row execute function public.set_updated_at();

alter table public.ai_weekly_reports enable row level security;

comment on table public.ai_weekly_reports is
  'Haftalik AI oz degerlendirme raporu (Quality Control). Yalnizca gercek verilere dayanir.';
