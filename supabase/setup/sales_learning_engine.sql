-- AI Sales Learning Engine kurulumu (idempotent).
-- Migration 000025-000030 iceriginin tamami. Supabase SQL Editor'da calistirin.

-- 20260718000025_conversations_whatsapp_channel.sql
-- ---------------------------------------------------------------------------

alter table public.conversations
  drop constraint if exists conversations_channel_check;

alter table public.conversations
  add constraint conversations_channel_check
  check (channel in ('instagram', 'facebook', 'whatsapp'));

-- ---------------------------------------------------------------------------
-- 20260718000026_conversation_sales_scores.sql
-- ---------------------------------------------------------------------------

alter table public.conversation_analyses
  add column if not exists score_sales_quality integer
    check (score_sales_quality is null or score_sales_quality between 0 and 100),
  add column if not exists score_empathy integer
    check (score_empathy is null or score_empathy between 0 and 100),
  add column if not exists score_speed integer
    check (score_speed is null or score_speed between 0 and 100),
  add column if not exists score_persuasion integer
    check (score_persuasion is null or score_persuasion between 0 and 100),
  add column if not exists score_closing integer
    check (score_closing is null or score_closing between 0 and 100),
  add column if not exists score_notes text,
  add column if not exists first_customer_question text,
  add column if not exists first_reply_given text,
  add column if not exists drop_off_point text,
  add column if not exists reservation_created boolean not null default false,
  add column if not exists deposit_received boolean not null default false,
  add column if not exists is_best_conversation boolean not null default false;

create index if not exists conversation_analyses_best_idx
  on public.conversation_analyses (is_best_conversation)
  where is_best_conversation = true;

create index if not exists conversation_analyses_sales_quality_idx
  on public.conversation_analyses (score_sales_quality desc nulls last);

-- ---------------------------------------------------------------------------
-- 20260718000027_sales_patterns.sql
-- ---------------------------------------------------------------------------

create table if not exists public.sales_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_type text not null check (pattern_type in (
    'opening',
    'price_explanation',
    'trust_building',
    'objection_response',
    'closing',
    'failure',
    'leave_reason'
  )),
  pattern_text text not null,
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

create or replace trigger set_sales_patterns_updated_at
  before update on public.sales_patterns
  for each row execute function public.set_updated_at();

alter table public.sales_patterns enable row level security;

-- ---------------------------------------------------------------------------
-- 20260718000028_company_personality.sql
-- ---------------------------------------------------------------------------

create table if not exists public.company_personality_traits (
  id uuid primary key default gen_random_uuid(),
  trait_type text not null check (trait_type in (
    'tone',
    'pricing_style',
    'phone_timing',
    'service_offering',
    'vocabulary',
    'trust_style'
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

create or replace trigger set_company_personality_traits_updated_at
  before update on public.company_personality_traits
  for each row execute function public.set_updated_at();

alter table public.company_personality_traits enable row level security;

-- ---------------------------------------------------------------------------
-- 20260718000029_ai_mistakes.sql
-- ---------------------------------------------------------------------------

create table if not exists public.ai_mistakes (
  id uuid primary key default gen_random_uuid(),
  mistake_type text not null check (mistake_type in (
    'premature_detail_question',
    'premature_phone_request',
    'wrong_information',
    'missed_buying_signal',
    'repeated_question',
    'tone_mismatch',
    'other'
  )),
  trigger_context text not null,
  wrong_reply text,
  correct_approach text not null,
  mistake_key text not null,
  occurrence_count integer not null default 1,
  is_resolved boolean not null default false,
  resolved_note text,
  source_conversation_id uuid
    references public.conversations (id) on delete set null,
  source_ai_run_id uuid
    references public.ai_runs (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_mistakes_key_uidx
  on public.ai_mistakes (mistake_key);

create index if not exists ai_mistakes_active_idx
  on public.ai_mistakes (is_resolved, last_seen_at desc);

create or replace trigger set_ai_mistakes_updated_at
  before update on public.ai_mistakes
  for each row execute function public.set_updated_at();

alter table public.ai_mistakes enable row level security;

-- ---------------------------------------------------------------------------
-- 20260718000030_ai_weekly_reports.sql
-- ---------------------------------------------------------------------------

create table if not exists public.ai_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  week_end date not null,
  summary_md text not null,
  learned_items jsonb not null default '[]'::jsonb,
  mistakes_made jsonb not null default '[]'::jsonb,
  mistakes_fixed jsonb not null default '[]'::jsonb,
  new_techniques jsonb not null default '[]'::jsonb,
  best_replies jsonb not null default '[]'::jsonb,
  worst_replies jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  data_sufficiency text not null default 'partial'
    check (data_sufficiency in ('sufficient', 'partial', 'insufficient')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_weekly_reports_week_idx
  on public.ai_weekly_reports (week_start desc);

create or replace trigger set_ai_weekly_reports_updated_at
  before update on public.ai_weekly_reports
  for each row execute function public.set_updated_at();

alter table public.ai_weekly_reports enable row level security;

notify pgrst, 'reload schema';

