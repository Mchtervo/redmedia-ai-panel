-- Uygulanan AI/personel önerileri → gerçek sonuç takibi

create table if not exists public.suggestion_applications (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  staff_message_id uuid references public.messages (id) on delete set null,
  loss_reason text,
  suggestion_source text not null default 'quality_score'
    check (suggestion_source in (
      'quality_score',
      'lost_sale',
      'follow_up_predict',
      'manual_edit'
    )),
  original_suggestion text not null,
  sent_text text not null,
  applied_by uuid references public.profiles (id) on delete set null,
  applied_at timestamptz not null default now(),
  customer_replied boolean not null default false,
  customer_replied_at timestamptz,
  led_to_deposit boolean not null default false,
  led_to_reservation boolean not null default false,
  outcome_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.suggestion_applications is
  'Düzeltme ekranından gönderilen öneriler ve rezervasyon/kapora sonucu.';

create index if not exists suggestion_applications_conversation_idx
  on public.suggestion_applications (conversation_id, applied_at desc);

create index if not exists suggestion_applications_loss_reason_idx
  on public.suggestion_applications (loss_reason, led_to_reservation);

create index if not exists suggestion_applications_outcome_idx
  on public.suggestion_applications (led_to_reservation, applied_at desc);

create trigger set_suggestion_applications_updated_at
  before update on public.suggestion_applications
  for each row execute function public.set_updated_at();

alter table public.suggestion_applications enable row level security;

create policy suggestion_applications_admin_all
  on public.suggestion_applications
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

-- Tahmin edilen sonraki müşteri yanıtı (konuşma bazlı)
alter table public.conversations
  add column if not exists predicted_reply_at timestamptz;

alter table public.conversations
  add column if not exists predicted_reply_hours numeric(8, 2);

alter table public.conversations
  add column if not exists follow_up_suggestion text;

comment on column public.conversations.predicted_reply_at is
  'Müşterinin tekrar yazması için tahmin edilen zaman.';
