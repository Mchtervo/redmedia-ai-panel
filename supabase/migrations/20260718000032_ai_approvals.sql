-- Approval Engine (docs/43_BUSINESS_RULES.md §12, docs/01 Human Approval):
-- İnsan onayı gereken AI aksiyonları tek kuyrukta toplanır.
-- Onay kaydı: istenen aksiyon, isteyen, karar veren, zaman, karar, not.

create table if not exists public.ai_approvals (
  id uuid primary key default gen_random_uuid(),
  action_type text not null check (action_type in (
    'assistant_reply',   -- şikayet/indirim/iptal/özel fiyat talebi (nötr ara cevap verildi, karar insanda)
    'knowledge_publish', -- bilgi önerisi yayını
    'playbook_activate', -- playbook aktifleştirme önerisi
    'budget_change',     -- reklam bütçe değişikliği önerisi
    'other'
  )),
  title text not null,
  -- Karar için gereken bağlam (müşteri mesajı, önerilen cevap vb.).
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

create trigger set_ai_approvals_updated_at
  before update on public.ai_approvals
  for each row execute function public.set_updated_at();

alter table public.ai_approvals enable row level security;

comment on table public.ai_approvals is
  'Approval Engine: insan onayi gereken AI aksiyonlari. AI nihai karari vermez; karar decided_by ile loglanir.';
