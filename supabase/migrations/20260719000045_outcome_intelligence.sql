-- Outcome Intelligence: Conversation Recorder + A/B + Human Feedback pattern tipi

-- 1) Konuşma sonu etiket (Recorder + Outcome Tracker)
create table if not exists public.conversation_outcome_tags (
  conversation_id uuid primary key
    references public.conversations (id) on delete cascade,
  reservation boolean not null default false,
  deposit boolean not null default false,
  customer_lost boolean not null default false,
  lost_reason text,
  conversation_length integer not null default 0,
  customer_type text,
  confidence numeric(4,3),
  customer_replied boolean not null default false,
  price_mentioned boolean not null default false,
  price_accepted boolean,
  reply_variant text check (reply_variant in ('A', 'B')),
  ab_experiment_key text,
  recommendation text,
  tag jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.conversation_outcome_tags is
  'Gerçek konuşma sonucu: rezervasyon/kapora/kayıp + KPI + A/B varyantı.';

create index if not exists conversation_outcome_tags_lost_reason_idx
  on public.conversation_outcome_tags (lost_reason)
  where customer_lost = true;

create index if not exists conversation_outcome_tags_variant_idx
  on public.conversation_outcome_tags (ab_experiment_key, reply_variant);

create trigger set_conversation_outcome_tags_updated_at
  before update on public.conversation_outcome_tags
  for each row execute function public.set_updated_at();

alter table public.conversation_outcome_tags enable row level security;

create policy conversation_outcome_tags_admin_all
  on public.conversation_outcome_tags
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.is_active = true
    )
  );

-- 2) DM cevap A/B ataması (konuşma başına sabit)
create table if not exists public.reply_ab_assignments (
  conversation_id uuid primary key
    references public.conversations (id) on delete cascade,
  experiment_key text not null default 'dm_reply_v1',
  variant text not null check (variant in ('A', 'B')),
  assigned_at timestamptz not null default now()
);

comment on table public.reply_ab_assignments is
  'DM satış cevabı A/B: aynı müşteri tipinde rezervasyon oranı karşılaştırması.';

alter table public.reply_ab_assignments enable row level security;

create policy reply_ab_assignments_admin_all
  on public.reply_ab_assignments
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.is_active = true
    )
  );

-- 3) Human Feedback pattern tipi
alter table public.sales_patterns
  drop constraint if exists sales_patterns_pattern_type_check;

alter table public.sales_patterns
  add constraint sales_patterns_pattern_type_check
  check (pattern_type in (
    'opening',
    'price_explanation',
    'trust_building',
    'objection_response',
    'closing',
    'failure',
    'leave_reason',
    'human_feedback'
  ));
