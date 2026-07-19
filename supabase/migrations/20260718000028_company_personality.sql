-- AI Sales Learning Engine: Company Personality.
-- AI'nin zamanla öğrendiği Redmedia iletişim kimliği: nasıl konuşuyoruz,
-- fiyatı nasıl veriyoruz, telefonu ne zaman istiyoruz, hangi kelimeleri
-- kullanıyoruz, güveni nasıl veriyoruz. Kalıcı AI Memory.

create table if not exists public.company_personality_traits (
  id uuid primary key default gen_random_uuid(),
  trait_type text not null check (trait_type in (
    'tone',              -- nasıl konuşuyoruz
    'pricing_style',     -- nasıl fiyat veriyoruz
    'phone_timing',      -- telefonu ne zaman istiyoruz
    'service_offering',  -- hangi hizmetleri öneriyoruz
    'vocabulary',        -- hangi kelimeleri kullanıyoruz
    'trust_style'        -- müşteriye nasıl güven veriyoruz
  )),
  trait_text text not null,
  trait_key text not null,
  evidence_count integer not null default 1,
  confidence numeric(5, 2) not null default 30
    check (confidence >= 0 and confidence <= 100),
  status text not null default 'active'
    check (status in ('active', 'superseded')),
  source_conversation_ids uuid[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists company_personality_traits_type_key_uidx
  on public.company_personality_traits (trait_type, trait_key);

create index if not exists company_personality_traits_type_idx
  on public.company_personality_traits (trait_type, confidence desc);

create trigger set_company_personality_traits_updated_at
  before update on public.company_personality_traits
  for each row execute function public.set_updated_at();

alter table public.company_personality_traits enable row level security;

comment on table public.company_personality_traits is
  'Redmedia sirket kisiligi — AI Memory. Konusma analizlerinden ogrenilir, kalicidir.';
