-- integrations, webhook_events: kolonlar kullanıcı tarafından belirtilmedi;
-- docs/CHATPLACE.md ve docs/META.md'deki entegrasyon/webhook akışına göre v1 taslağı.
--
-- Not: Bu tabloda gerçek API anahtarı/token saklanmaz (bkz. .cursor/rules/02-security.mdc).
-- Sırlar her zaman sunucu tarafı environment variable olarak kalır; burada yalnızca
-- bağlantı durumu ve hassas olmayan metadata tutulur.

create table public.integrations (
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

create trigger set_integrations_updated_at
  before update on public.integrations
  for each row
  execute function public.set_updated_at();

alter table public.integrations enable row level security;

create table public.webhook_events (
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

create index webhook_events_provider_idx on public.webhook_events (provider);
create index webhook_events_status_idx on public.webhook_events (status);

alter table public.webhook_events enable row level security;
