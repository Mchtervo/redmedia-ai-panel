-- CEO Intelligence: salt okuma analiz/rapor depoları
-- Fiyat, kampanya, personel, ödeme, rezervasyon DEĞİŞTİRMEZ.

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

create index if not exists ceo_daily_briefs_generated_idx
  on public.ceo_daily_briefs (generated_at desc);

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

create index if not exists ceo_daily_reports_date_idx
  on public.ceo_daily_reports (report_date desc);

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

create index if not exists ceo_assistant_logs_created_idx
  on public.ceo_assistant_logs (created_at desc);

alter table public.ceo_assistant_logs enable row level security;
