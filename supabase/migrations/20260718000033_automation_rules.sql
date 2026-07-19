-- Automation Rules Engine (docs/14, docs/32):
-- trigger (olay) → condition (koşul) → action (aksiyon) akışı.
-- Her çalıştırma automation_runs tablosuna loglanır; log'suz otomasyon yok.
-- AI bütçe/durum değiştiremez; aksiyonlar bildirim ve onay talebi ile sınırlı
-- (docs/META.md, 04-ai-behavior kuralı).

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  trigger_type text not null check (trigger_type in (
    'inbound_message',    -- yeni müşteri mesajı geldiğinde
    'reservation_created',-- yeni rezervasyon oluşturulduğunda
    'deposit_verified'    -- kapora onaylandığında
  )),
  -- [{ "field": "message", "op": "contains", "value": "iptal" }]
  conditions jsonb not null default '[]'::jsonb,
  -- [{ "type": "panel_notification", "params": { "title": "..." } }]
  actions jsonb not null default '[]'::jsonb,
  is_enabled boolean not null default true,
  run_count integer not null default 0,
  last_run_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automation_rules_trigger_enabled_idx
  on public.automation_rules (trigger_type, is_enabled);

create trigger set_automation_rules_updated_at
  before update on public.automation_rules
  for each row execute function public.set_updated_at();

alter table public.automation_rules enable row level security;

comment on table public.automation_rules is
  'Automation Engine: trigger-condition-action kurallari. Aksiyonlar bildirim/onay talebi ile sinirlidir.';

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules (id)
    on delete cascade,
  trigger_type text not null,
  status text not null check (status in ('completed', 'skipped', 'failed')),
  detail text,
  -- Hassas içerik loglanmaz; yalnızca ilişkili kayıt ID'leri tutulur.
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists automation_runs_rule_created_idx
  on public.automation_runs (rule_id, created_at desc);

alter table public.automation_runs enable row level security;

comment on table public.automation_runs is
  'Automation Engine yurutme loglari: her kural calistirmasi kaydedilir.';
