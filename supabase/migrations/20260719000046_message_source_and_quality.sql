-- messages.source enum + conversation quality scores + funnel helpers

-- 1) Mesaj kaynağı (asla null olmaz)
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'message_source' and n.nspname = 'public'
  ) then
    create type public.message_source as enum (
      'chatplace_mcp',
      'chatplace_webhook',
      'meta_delivery',
      'manual_test',
      'seed',
      'lab',
      'import',
      'migration',
      'legacy',
      'unknown'
    );
  end if;
end $$;

alter table public.messages
  add column if not exists source public.message_source;

-- Backfill: raw_payload + external id kalıpları
update public.messages m
set source = case
  when coalesce(m.raw_payload->>'source', '') = 'chatplace_mcp' then 'chatplace_mcp'::public.message_source
  when coalesce(m.raw_payload->>'source', '') in ('chatplace_webhook', 'webhook') then 'chatplace_webhook'::public.message_source
  when coalesce(m.raw_payload->>'delivery', '') = 'meta_messaging' then 'meta_delivery'::public.message_source
  when m.raw_payload ? 'event'
    and coalesce(m.raw_payload->>'event', '') like 'message.%'
    then 'chatplace_webhook'::public.message_source
  when exists (
    select 1 from public.conversations c
    where c.id = m.conversation_id
      and c.external_conversation_id is not null
      and (
        c.external_conversation_id ilike 'seed-%'
        or c.external_conversation_id ilike 'seed_conv%'
      )
  ) then 'seed'::public.message_source
  when exists (
    select 1 from public.conversations c
    where c.id = m.conversation_id
      and c.external_conversation_id is not null
      and (
        c.external_conversation_id ilike 'ai-test%'
        or c.external_conversation_id ilike 'ai-dup%'
        or c.external_conversation_id ilike 'prod-token%'
        or c.external_conversation_id ilike 'c-c%'
        or c.external_conversation_id like '{{%'
        or c.external_conversation_id ilike '%test%'
      )
  ) then 'manual_test'::public.message_source
  when m.raw_payload is null then 'legacy'::public.message_source
  else 'unknown'::public.message_source
end
where m.source is null;

-- Kalanlar
update public.messages
set source = 'unknown'::public.message_source
where source is null;

alter table public.messages
  alter column source set default 'unknown'::public.message_source;

alter table public.messages
  alter column source set not null;

comment on column public.messages.source is
  'Mesajın geliş/yazım kanalı. Null olamaz.';

create index if not exists messages_source_idx
  on public.messages (source);

-- raw_payload.source ile senkron (okuma kolaylığı)
update public.messages
set raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object('source', source::text)
where raw_payload is null
   or raw_payload->>'source' is distinct from source::text;

-- 2) Conversation Quality Score
create table if not exists public.conversation_quality_scores (
  conversation_id uuid primary key
    references public.conversations (id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  grade text not null,
  primary_issue text,
  issues text[] not null default '{}',
  summary text,
  scored_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.conversation_quality_scores is
  'Konuşma kalite skoru 0-100; en kötü 20 listesi için.';

create index if not exists conversation_quality_scores_score_idx
  on public.conversation_quality_scores (score asc, scored_at desc);

create trigger set_conversation_quality_scores_updated_at
  before update on public.conversation_quality_scores
  for each row execute function public.set_updated_at();

alter table public.conversation_quality_scores enable row level security;

create policy conversation_quality_scores_admin_all
  on public.conversation_quality_scores
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
