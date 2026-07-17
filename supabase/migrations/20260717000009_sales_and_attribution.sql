-- attribution_events, sales, reservations: kolonlar kullanıcı tarafından belirtilmedi;
-- satış dönüşümü ve reklam atfı (attribution) ihtiyacına göre v1 taslağı.

create table public.attribution_events (
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

create index attribution_events_contact_id_idx on public.attribution_events (contact_id);
create index attribution_events_campaign_id_idx on public.attribution_events (campaign_id);
create index attribution_events_ad_id_idx on public.attribution_events (ad_id);

alter table public.attribution_events enable row level security;

create table public.sales (
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

create index sales_contact_id_idx on public.sales (contact_id);
create index sales_lead_profile_id_idx on public.sales (lead_profile_id);

alter table public.sales enable row level security;

create table public.reservations (
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

create index reservations_contact_id_idx on public.reservations (contact_id);
create index reservations_lead_profile_id_idx on public.reservations (lead_profile_id);

create trigger set_reservations_updated_at
  before update on public.reservations
  for each row
  execute function public.set_updated_at();

alter table public.reservations enable row level security;
