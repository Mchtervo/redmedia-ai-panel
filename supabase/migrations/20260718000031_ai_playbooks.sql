-- Playbook Engine (docs/27_PLAYBOOK_ENGINE.md):
-- Kanıtlanmış iş süreçlerini (kazandıran konuşma akışları) yeniden
-- kullanılabilir, versiyonlu AI rehberlerine dönüştürür.
-- Yaşam döngüsü: draft → review → active → archived (insan onayı ile).

create table if not exists public.ai_playbooks (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'sales' check (category in (
    'sales',        -- satış konuşma akışı
    'marketing',    -- kampanya/içerik stratejisi
    'support',      -- destek/şikayet akışı
    'reservation'   -- rezervasyon kapatma akışı
  )),
  title text not null,
  -- Aynı playbook'un tekrar üretimini engelleyen normalize anahtar.
  title_key text not null,
  -- Ne zaman kullanılacağı (tetikleyici durum).
  trigger_context text not null,
  -- Adımlar: metin dizisi (JSONB array of string).
  steps jsonb not null default '[]'::jsonb,
  -- Karar kuralları: "şu olursa şunu yap" metin dizisi.
  decision_rules jsonb not null default '[]'::jsonb,
  expected_outcome text,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'active', 'archived')),
  version integer not null default 1,
  confidence numeric(5, 2) not null default 40
    check (confidence >= 0 and confidence <= 100),
  usage_count integer not null default 0,
  source_conversation_ids uuid[] not null default '{}',
  source_note text,
  created_by text not null default 'ai' check (created_by in ('ai', 'human')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_playbooks_category_title_key_uidx
  on public.ai_playbooks (category, title_key);

create index if not exists ai_playbooks_status_idx
  on public.ai_playbooks (status);

create trigger set_ai_playbooks_updated_at
  before update on public.ai_playbooks
  for each row execute function public.set_updated_at();

alter table public.ai_playbooks enable row level security;

comment on table public.ai_playbooks is
  'Playbook Engine: kanitlanmis surecler versiyonlu AI rehberi olarak saklanir. Aktiflestirme insan onayi gerektirir.';
