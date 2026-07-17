-- profiles: Redmedia personeli / panel kullanıcıları.
-- business_settings: Redmedia işletme ayarları (AI grounding ve genel panel ayarları).
--
-- Not: Bu tablolar için henüz personel yetkilendirme akışı (Aşama 2) kurulmadığı
-- için kasıtlı olarak hiçbir RLS policy eklenmedi. RLS aktif ve varsayılan
-- olarak anon/authenticated rolleri için erişim reddedilir; uygulama şu an
-- yalnızca sunucu tarafında service role ile erişir. Personel yetkilendirmesi
-- kurulduğunda buraya rol bazlı policy'ler eklenecektir.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Redmedia personeli / panel kullanicilari (Supabase Auth kullanicisiyla birebir eslesir).';

create unique index profiles_email_key
  on public.profiles (email)
  where email is not null;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- business_settings: kolonlar kullanıcı tarafından belirtilmedi, docs/AI.md ve
-- docs/PROJECT.md'deki "kaynak işletme bilgisi" ihtiyacına göre v1 taslağı.
create table public.business_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'Redmedia',
  timezone text not null default 'Europe/Istanbul',
  default_currency text not null default 'TRY',
  contact_email text,
  contact_phone text,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.business_settings is
  'Redmedia isletme ayarlari (AI grounding ve genel panel ayarlari icin).';

create trigger set_business_settings_updated_at
  before update on public.business_settings
  for each row
  execute function public.set_updated_at();

alter table public.business_settings enable row level security;
