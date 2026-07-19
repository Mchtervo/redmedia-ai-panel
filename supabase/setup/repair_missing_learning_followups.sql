-- ============================================================================
-- ONARIM: Canlıda eksik kalan migration parçaları
-- Tespit: 20260717000011 (tamamı), 20260717000015 (tamamı),
--         20260717000017 (panel_notifications, staff_audit_logs,
--         reminder_jobs.staff_member_id) canlı veritabanına uygulanmamış.
-- Bu dosya idempotenttir; birden fazla kez güvenle çalıştırılabilir.
-- Veri silen komut YOKTUR.
-- Supabase Dashboard -> SQL Editor'da tek seferde çalıştırın.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 20260717000011_conversation_learning.sql
-- ----------------------------------------------------------------------------

alter table public.knowledge_documents
  add column if not exists review_status text not null default 'approved'
    check (review_status in ('pending_review', 'approved', 'rejected')),
  add column if not exists source_type text not null default 'manual'
    check (source_type in ('manual', 'conversation_learning', 'import')),
  add column if not exists source_conversation_id uuid
    references public.conversations (id) on delete set null,
  add column if not exists faq_question text,
  add column if not exists suggested_answer text,
  add column if not exists example_good_reply text,
  add column if not exists example_bad_reply text,
  add column if not exists is_pricing_sensitive boolean not null default false,
  add column if not exists is_campaign_claim boolean not null default false,
  add column if not exists reviewed_by uuid
    references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_notes text;

comment on column public.knowledge_documents.review_status is
  'pending_review: panel onayi bekler; approved: AI cevaplarinda kullanilabilir; rejected: reddedildi.';
comment on column public.knowledge_documents.is_pricing_sensitive is
  'true ise fiyat icerigi; otomatik onaylanmaz, insan dogrulamalidir.';
comment on column public.knowledge_documents.is_campaign_claim is
  'true ise tarihi gecmis kampanya riski; otomatik aktif bilgi sayilmaz.';

create index if not exists knowledge_documents_review_status_idx
  on public.knowledge_documents (review_status);

create index if not exists knowledge_documents_category_idx
  on public.knowledge_documents (category);

create index if not exists knowledge_documents_source_conversation_id_idx
  on public.knowledge_documents (source_conversation_id);

create table if not exists public.conversation_analyses (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique
    references public.conversations (id) on delete cascade,
  customer_intent text,
  event_type text,
  event_date_text text,
  venue_type text,
  requested_services text,
  budget_or_price_question text,
  objections text,
  phone_collected boolean not null default false,
  sale_outcome text not null default 'unknown'
    check (sale_outcome in ('won', 'lost', 'open', 'unknown')),
  advancing_reply text,
  losing_reply text,
  frequent_question text,
  recommended_answer text,
  lead_score integer check (lead_score between 0 and 100),
  sale_probability integer check (sale_probability between 0 and 100),
  lead_temperature text
    check (lead_temperature in ('cold', 'warm', 'hot')),
  loss_reason text,
  next_action text,
  message_count integer not null default 0,
  last_message_at_snapshot timestamptz,
  extraction jsonb,
  learning_status text not null default 'completed'
    check (learning_status in ('pending', 'completed', 'failed', 'skipped')),
  analyzed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.conversation_analyses is
  'Konusmadan cikarilan yapilandirilmis satis ozeti; ham mesaj gecmisi degil.';

create index if not exists conversation_analyses_sale_outcome_idx
  on public.conversation_analyses (sale_outcome);

create index if not exists conversation_analyses_analyzed_at_idx
  on public.conversation_analyses (analyzed_at desc);

drop trigger if exists set_conversation_analyses_updated_at
  on public.conversation_analyses;
create trigger set_conversation_analyses_updated_at
  before update on public.conversation_analyses
  for each row
  execute function public.set_updated_at();

alter table public.conversation_analyses enable row level security;

alter table public.knowledge_documents
  add column if not exists source_analysis_id uuid
    references public.conversation_analyses (id) on delete set null;

create index if not exists knowledge_documents_source_analysis_id_idx
  on public.knowledge_documents (source_analysis_id);

alter table public.conversation_summaries
  add column if not exists lead_score integer check (lead_score between 0 and 100),
  add column if not exists sale_probability integer check (sale_probability between 0 and 100),
  add column if not exists customer_intent text,
  add column if not exists lead_temperature text
    check (lead_temperature in ('cold', 'warm', 'hot')),
  add column if not exists loss_reason text,
  add column if not exists sale_outcome text
    check (sale_outcome in ('won', 'lost', 'open', 'unknown'));

create table if not exists public.conversation_learning_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null
    check (trigger_source in (
      'manual',
      'cron',
      'conversation_closed',
      'idle_24h',
      'import'
    )),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'partial')),
  conversations_scanned integer not null default 0,
  conversations_analyzed integer not null default 0,
  knowledge_proposed integer not null default 0,
  error_message text,
  details jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.conversation_learning_runs is
  'Conversation Learning toplu islem kaydi (manuel / cron / kapanis / idle).';

create index if not exists conversation_learning_runs_started_at_idx
  on public.conversation_learning_runs (started_at desc);

alter table public.conversation_learning_runs enable row level security;

alter table public.conversations
  add column if not exists last_learned_at timestamptz;

-- ----------------------------------------------------------------------------
-- 20260717000015_reservation_os_followups_reminders.sql
-- ----------------------------------------------------------------------------

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

drop trigger if exists set_follow_up_tasks_updated_at
  on public.follow_up_tasks;
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

-- ----------------------------------------------------------------------------
-- 20260717000017_staff_management.sql — eksik kalan parçalar
-- ----------------------------------------------------------------------------

create table if not exists public.panel_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  staff_member_id uuid references public.staff_members (id) on delete set null,
  reservation_id uuid references public.reservations (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists panel_notifications_created_at_idx
  on public.panel_notifications (created_at desc);
create index if not exists panel_notifications_unread_idx
  on public.panel_notifications (created_at desc)
  where read_at is null;

alter table public.panel_notifications enable row level security;

create table if not exists public.staff_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists staff_audit_logs_created_at_idx
  on public.staff_audit_logs (created_at desc);
create index if not exists staff_audit_logs_entity_idx
  on public.staff_audit_logs (entity_type, entity_id);

alter table public.staff_audit_logs enable row level security;

alter table public.reminder_jobs
  add column if not exists staff_member_id uuid
    references public.staff_members (id) on delete cascade;

create index if not exists reminder_jobs_staff_member_idx
  on public.reminder_jobs (staff_member_id)
  where staff_member_id is not null;

-- ----------------------------------------------------------------------------
-- PostgREST şema önbelleğini yenile (PGRST205 hatalarını temizler)
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
