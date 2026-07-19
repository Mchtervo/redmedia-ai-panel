-- Customer Intelligence (CRM Memory): müşteri başına tek profil.
-- contacts ile 1:1 (contact_id); Instagram kimliği ayrıca saklanır.

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

comment on table public.customer_profiles is
  'Musteri basina tek CRM bellegi; AI her mesajdan sonra gunceller.';

create unique index if not exists customer_profiles_instagram_id_key
  on public.customer_profiles (instagram_id)
  where instagram_id is not null;

create index if not exists customer_profiles_status_idx
  on public.customer_profiles (status);

create index if not exists customer_profiles_lead_score_idx
  on public.customer_profiles (lead_score desc);

create trigger set_customer_profiles_updated_at
  before update on public.customer_profiles
  for each row
  execute function public.set_updated_at();

alter table public.customer_profiles enable row level security;
