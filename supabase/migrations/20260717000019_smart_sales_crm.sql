-- Smart sales: lifecycle, opportunity, admin notes, timeline, satisfaction

alter table public.customer_profiles
  add column if not exists lifecycle_stage text not null default 'new_customer'
    check (lifecycle_stage in (
      'new_customer',
      'gathering_info',
      'price_given',
      'negotiating',
      'awaiting_reservation',
      'awaiting_deposit',
      'awaiting_receipt',
      'reservation_confirmed',
      'shoot_completed',
      'delivery',
      'completed',
      'cancelled',
      'passive'
    )),
  add column if not exists opportunity_score integer not null default 0
    check (opportunity_score between 0 and 100),
  add column if not exists admin_notes text,
  add column if not exists last_outbound_at timestamptz,
  add column if not exists satisfaction_flow_status text
    check (satisfaction_flow_status is null or satisfaction_flow_status in (
      'pending', 'thanks_sent', 'review_asked', 'referral_asked', 'done', 'skipped'
    ));

create index if not exists customer_profiles_lifecycle_stage_idx
  on public.customer_profiles (lifecycle_stage);
create index if not exists customer_profiles_opportunity_score_idx
  on public.customer_profiles (opportunity_score desc);

-- Müşteri zaman çizgisi olayları
create table if not exists public.customer_timeline_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  reservation_id uuid references public.reservations (id) on delete set null,
  event_type text not null,
  title text not null,
  body text,
  actor_type text not null default 'system'
    check (actor_type in ('system', 'ai', 'staff', 'customer')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists customer_timeline_events_contact_idx
  on public.customer_timeline_events (contact_id, occurred_at desc);

alter table public.customer_timeline_events enable row level security;

-- Admin notları (yalnızca ekip; AI prompt'ta gizli kullanım)
create table if not exists public.customer_admin_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_admin_notes_contact_idx
  on public.customer_admin_notes (contact_id, created_at desc);

create trigger set_customer_admin_notes_updated_at
  before update on public.customer_admin_notes
  for each row
  execute function public.set_updated_at();

alter table public.customer_admin_notes enable row level security;

-- Memnuniyet / referans görevleri
create table if not exists public.satisfaction_tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  reservation_id uuid references public.reservations (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  step text not null
    check (step in ('thanks', 'review', 'google', 'instagram_tag', 'referral')),
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'sent', 'cancelled', 'skipped')),
  message_template text,
  created_at timestamptz not null default now(),
  unique (reservation_id, step)
);

create index if not exists satisfaction_tasks_scheduled_idx
  on public.satisfaction_tasks (scheduled_at)
  where status = 'pending';

alter table public.satisfaction_tasks enable row level security;
