-- lead_profiles: kullanıcı tarafından belirtilen tanımla birebir oluşturuldu.
-- lead_events: kolonlar kullanıcı tarafından belirtilmedi, "lead zaman çizelgesi" ihtiyacına göre v1 taslağı.

create table public.lead_profiles (
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

create index lead_profiles_source_campaign_id_idx on public.lead_profiles (source_campaign_id);
create index lead_profiles_source_ad_id_idx on public.lead_profiles (source_ad_id);

create trigger set_lead_profiles_updated_at
  before update on public.lead_profiles
  for each row
  execute function public.set_updated_at();

alter table public.lead_profiles enable row level security;

create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_profile_id uuid not null references public.lead_profiles (id) on delete cascade,
  event_type text not null,
  event_data jsonb,
  actor_type text not null default 'system' check (actor_type in ('staff', 'ai', 'system')),
  actor_id uuid references public.profiles (id) on delete set null,
  occurred_at timestamptz not null default now()
);

comment on table public.lead_events is 'Bir lead uzerindeki degisiklik/olay gecmisi (zaman cizelgesi).';

create index lead_events_lead_profile_id_idx on public.lead_events (lead_profile_id);

alter table public.lead_events enable row level security;
