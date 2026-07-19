-- ============================================================
-- Growth OS Engines kurulumu (idempotent — tekrar çalıştırılabilir)
-- Kapsam: Playbook Engine (docs/27), Approval Engine (docs/43 §12),
--         Automation Engine (docs/14, 32)
-- Migration karşılıkları:
--   20260718000031_ai_playbooks.sql
--   20260718000032_ai_approvals.sql
--   20260718000033_automation_rules.sql
-- Supabase Dashboard → SQL Editor'de çalıştırın.
-- ============================================================

-- ---------- 1) ai_playbooks (Playbook Engine, docs/27) ----------

create table if not exists public.ai_playbooks (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'sales' check (category in (
    'sales', 'marketing', 'support', 'reservation'
  )),
  title text not null,
  title_key text not null,
  trigger_context text not null,
  steps jsonb not null default '[]'::jsonb,
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

drop trigger if exists set_ai_playbooks_updated_at on public.ai_playbooks;
create trigger set_ai_playbooks_updated_at
  before update on public.ai_playbooks
  for each row execute function public.set_updated_at();

alter table public.ai_playbooks enable row level security;

comment on table public.ai_playbooks is
  'Playbook Engine: kanitlanmis surecler versiyonlu AI rehberi olarak saklanir. Aktiflestirme insan onayi gerektirir.';

-- ---------- 2) ai_approvals (Approval Engine, docs/43 §12) ----------

create table if not exists public.ai_approvals (
  id uuid primary key default gen_random_uuid(),
  action_type text not null check (action_type in (
    'assistant_reply',
    'knowledge_publish',
    'playbook_activate',
    'budget_change',
    'other'
  )),
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  confidence numeric(5, 2)
    check (confidence is null or (confidence >= 0 and confidence <= 100)),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired')),
  requested_by text not null default 'ai' check (requested_by in ('ai', 'human')),
  conversation_id uuid references public.conversations (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  ai_run_id uuid references public.ai_runs (id) on delete set null,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_approvals_pending_idx
  on public.ai_approvals (created_at desc)
  where status = 'pending';

create index if not exists ai_approvals_contact_idx
  on public.ai_approvals (contact_id)
  where contact_id is not null;

drop trigger if exists set_ai_approvals_updated_at on public.ai_approvals;
create trigger set_ai_approvals_updated_at
  before update on public.ai_approvals
  for each row execute function public.set_updated_at();

alter table public.ai_approvals enable row level security;

comment on table public.ai_approvals is
  'Approval Engine: insan onayi gereken AI aksiyonlari. AI nihai karari vermez; karar decided_by ile loglanir.';

-- ---------- 3) automation_rules + automation_runs (docs/14, 32) ----------

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  trigger_type text not null check (trigger_type in (
    'inbound_message',
    'reservation_created',
    'deposit_verified'
  )),
  conditions jsonb not null default '[]'::jsonb,
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

drop trigger if exists set_automation_rules_updated_at on public.automation_rules;
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
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists automation_runs_rule_created_idx
  on public.automation_runs (rule_id, created_at desc);

alter table public.automation_runs enable row level security;

comment on table public.automation_runs is
  'Automation Engine yurutme loglari: her kural calistirmasi kaydedilir.';

-- ---------- 4) RAG: knowledge_chunks arama (docs/29, 30) ----------
-- Migration karşılığı: 20260718000034_knowledge_rag.sql

create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count int default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity double precision
)
language sql
stable
as $$
  select
    kc.id as chunk_id,
    kc.document_id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  join public.knowledge_documents kd on kd.id = kc.document_id
  where kc.embedding is not null
    and kd.review_status = 'approved'
    and kd.is_active = true
    and kd.is_campaign_claim = false
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;

comment on function public.match_knowledge_chunks is
  'RAG: onayli ve aktif knowledge dokumanlarinin chunklarinda cosine benzerlik aramasi.';

-- ---------- Doğrulama ----------

select
  t.table_name,
  (select count(*) from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = t.table_name) as column_count
from information_schema.tables t
where t.table_schema = 'public'
  and t.table_name in (
    'ai_playbooks', 'ai_approvals', 'automation_rules', 'automation_runs'
  )
order by t.table_name;
