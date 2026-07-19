-- Customer memory extensions + Redmedia AI Brain

-- ---------------------------------------------------------------------------
-- customer_profiles: zengin müşteri hafızası
-- ---------------------------------------------------------------------------
alter table public.customer_profiles
  add column if not exists memory_summary text,
  add column if not exists negotiation_tendency text,
  add column if not exists price_sensitivity text,
  add column if not exists rejected_services text[] not null default '{}',
  add column if not exists preferred_packages text[] not null default '{}',
  add column if not exists budget_range text,
  add column if not exists decision_speed text,
  add column if not exists prior_quote_received boolean not null default false,
  add column if not exists prior_reservation boolean not null default false,
  add column if not exists prior_cancellation boolean not null default false,
  add column if not exists interested_campaigns text[] not null default '{}',
  add column if not exists mentioned_dates text[] not null default '{}',
  add column if not exists preferred_style text,
  add column if not exists communication_tone text,
  add column if not exists uses_emoji boolean,
  add column if not exists formality text,
  add column if not exists frequent_questions text[] not null default '{}',
  add column if not exists customer_type text,
  add column if not exists customer_type_confidence numeric(4, 3),
  add column if not exists ai_notes text,
  add column if not exists memory_updated_at timestamptz;

comment on column public.customer_profiles.memory_summary is
  'Gecmis DM ozeti; ham gecmis yerine prompta gider.';

-- ---------------------------------------------------------------------------
-- knowledge_candidates (AI Brain onay kuyrugu)
-- ---------------------------------------------------------------------------
create table if not exists public.knowledge_candidates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'general',
  proposed_rule text not null,
  evidence_summary text,
  source_conversation_ids uuid[] not null default '{}',
  confidence_score numeric(4, 3) not null default 0.5
    check (confidence_score >= 0 and confidence_score <= 1),
  evidence_count integer not null default 1 check (evidence_count >= 0),
  source_count integer not null default 1 check (source_count >= 0),
  expected_impact text,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'archived', 'test_mode')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  knowledge_document_id uuid references public.knowledge_documents (id) on delete set null,
  valid_from timestamptz,
  valid_until timestamptz,
  last_validated_at timestamptz,
  last_observed_at timestamptz not null default now(),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_candidates_status_idx
  on public.knowledge_candidates (status, created_at desc);
create index if not exists knowledge_candidates_category_idx
  on public.knowledge_candidates (category);

create trigger set_knowledge_candidates_updated_at
  before update on public.knowledge_candidates
  for each row
  execute function public.set_updated_at();

alter table public.knowledge_candidates enable row level security;

-- ---------------------------------------------------------------------------
-- sales_learnings (onaylanmis satis ogrrenimleri)
-- ---------------------------------------------------------------------------
create table if not exists public.sales_learnings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  learning_type text not null default 'pattern',
  content text not null,
  customer_type text,
  confidence_score numeric(4, 3) not null default 0.5,
  evidence_count integer not null default 1,
  source_count integer not null default 1,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  last_validated_at timestamptz,
  last_observed_at timestamptz not null default now(),
  active boolean not null default true,
  knowledge_candidate_id uuid references public.knowledge_candidates (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_learnings_active_idx
  on public.sales_learnings (active, last_observed_at desc)
  where active = true;

create trigger set_sales_learnings_updated_at
  before update on public.sales_learnings
  for each row
  execute function public.set_updated_at();

alter table public.sales_learnings enable row level security;

-- ---------------------------------------------------------------------------
-- admin_ai_corrections
-- ---------------------------------------------------------------------------
create table if not exists public.admin_ai_corrections (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  ai_message_id uuid references public.messages (id) on delete set null,
  staff_message_id uuid references public.messages (id) on delete set null,
  ai_text text not null,
  staff_text text not null,
  reason text,
  customer_type text,
  led_to_sale boolean,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists admin_ai_corrections_created_at_idx
  on public.admin_ai_corrections (created_at desc);

alter table public.admin_ai_corrections enable row level security;

-- ---------------------------------------------------------------------------
-- conversation_outcomes (konusma sonuclari)
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_outcomes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  outcome text not null
    check (outcome in (
      'sale', 'draft_created', 'deposit_requested', 'deposit_sent',
      'customer_abandoned', 'no_reply', 'admin_took_over',
      'admin_corrected_ai', 'positive', 'negative', 'unknown'
    )),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  unique (conversation_id, outcome)
);

create index if not exists conversation_outcomes_outcome_idx
  on public.conversation_outcomes (outcome, recorded_at desc);

alter table public.conversation_outcomes enable row level security;
