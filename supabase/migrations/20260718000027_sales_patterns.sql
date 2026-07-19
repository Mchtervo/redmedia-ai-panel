-- AI Sales Learning Engine: Learning Engine kalıp hafızası.
-- Gecelik analizden çıkarılan satış kalıpları (açılış, fiyat anlatımı, güven,
-- itiraz cevabı, kapanış, kayıp sebebi). Kayıtlar silinmez; çelişkide daha
-- başarılı örnek sayacı yüksek olan tercih edilir (Continuous Memory).

create table if not exists public.sales_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_type text not null check (pattern_type in (
    'opening',            -- başarılı açılış cümlesi
    'price_explanation',  -- başarılı fiyat anlatımı
    'trust_building',     -- güven oluşturma yöntemi
    'objection_response', -- itiraz cevabı
    'closing',            -- rezervasyon kapatma cümlesi
    'failure',            -- başarısız konuşma kalıbı
    'leave_reason'        -- müşterinin ayrılma sebebi
  )),
  pattern_text text not null,
  -- Aynı kalıbın tekrarları birleştirilir (normalize edilmiş anahtar).
  pattern_key text not null,
  context_note text,
  won_count integer not null default 0,
  lost_count integer not null default 0,
  seen_count integer not null default 0,
  success_rate numeric(5, 2)
    check (success_rate is null or (success_rate >= 0 and success_rate <= 100)),
  confidence numeric(5, 2) not null default 30
    check (confidence >= 0 and confidence <= 100),
  status text not null default 'active'
    check (status in ('active', 'superseded')),
  superseded_by uuid references public.sales_patterns (id) on delete set null,
  source_conversation_ids uuid[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sales_patterns_type_key_uidx
  on public.sales_patterns (pattern_type, pattern_key);

create index if not exists sales_patterns_type_success_idx
  on public.sales_patterns (pattern_type, success_rate desc nulls last);

create index if not exists sales_patterns_status_idx
  on public.sales_patterns (status);

create trigger set_sales_patterns_updated_at
  before update on public.sales_patterns
  for each row execute function public.set_updated_at();

alter table public.sales_patterns enable row level security;

comment on table public.sales_patterns is
  'AI Sales Learning Engine kalip hafizasi. Kalip silinmez; celiskide basari orani yuksek olan aktif kalir.';
