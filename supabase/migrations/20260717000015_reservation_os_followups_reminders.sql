-- Reservation OS: follow-ups + reminders

create table if not exists public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  reservation_id uuid references public.reservations (id) on delete set null,
  reason text not null,
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in (
      'pending', 'queued', 'sent', 'cancelled', 'failed', 'skipped'
    )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  message_template_id text,
  ai_generated_message text,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists follow_up_tasks_scheduled_at_idx
  on public.follow_up_tasks (scheduled_at)
  where status = 'pending';
create index if not exists follow_up_tasks_contact_id_idx
  on public.follow_up_tasks (contact_id);

create trigger set_follow_up_tasks_updated_at
  before update on public.follow_up_tasks
  for each row
  execute function public.set_updated_at();

alter table public.follow_up_tasks enable row level security;

create table if not exists public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  reminder_type text not null,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'cancelled', 'failed', 'skipped')),
  channel text not null default 'admin'
    check (channel in ('admin', 'customer', 'both')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (reservation_id, reminder_type, scheduled_at)
);

create index if not exists reminder_jobs_scheduled_at_idx
  on public.reminder_jobs (scheduled_at)
  where status = 'pending';

alter table public.reminder_jobs enable row level security;
