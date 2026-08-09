-- Meta Ads Autopilot audit log + UI kill-switch (business_settings JSON anahtarı da kullanılır).

create table public.ad_action_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('campaign', 'ad_set', 'ad')),
  entity_id uuid,
  meta_entity_id text not null,
  action text not null check (
    action in (
      'pause',
      'activate',
      'budget_increase',
      'budget_decrease',
      'noop',
      'dry_run'
    )
  ),
  before_value jsonb,
  after_value jsonb,
  reason text not null,
  score text check (score in ('good', 'ok', 'bad')),
  dry_run boolean not null default true,
  success boolean not null default false,
  error_code text,
  created_at timestamptz not null default now()
);

comment on table public.ad_action_logs is
  'Meta Ads Autopilot / manuel yazma denetim kaydi. Hassas token yok.';

create index ad_action_logs_created_at_idx
  on public.ad_action_logs (created_at desc);

create index ad_action_logs_meta_entity_id_idx
  on public.ad_action_logs (meta_entity_id);

alter table public.ad_action_logs enable row level security;

-- Panel okuma: authenticated
create policy ad_action_logs_select_authenticated
  on public.ad_action_logs
  for select
  to authenticated
  using (true);

-- Yazma yalnızca service role (RLS bypass). Authenticated insert yok.
