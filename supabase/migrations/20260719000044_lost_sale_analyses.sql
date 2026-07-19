-- Lost Sale Analyzer sonuçları (kayıp konuşma + alternatif senaryo).
create table if not exists public.lost_sale_analyses (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations (id) on delete set null,
  primary_reason text not null,
  reasons text[] not null default '{}',
  why_lost text,
  first_mistake_turn_index integer,
  alternative_conversation text,
  reservation_lift_pct numeric not null default 0,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.lost_sale_analyses is
  'Kayıp satış analizleri: neden + alternatif konuşma + rezervasyon lift tahmini.';

create index if not exists lost_sale_analyses_created_at_idx
  on public.lost_sale_analyses (created_at desc);

create index if not exists lost_sale_analyses_conversation_id_idx
  on public.lost_sale_analyses (conversation_id);

create index if not exists lost_sale_analyses_primary_reason_idx
  on public.lost_sale_analyses (primary_reason);

alter table public.lost_sale_analyses enable row level security;

create policy lost_sale_analyses_admin_all
  on public.lost_sale_analyses
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
