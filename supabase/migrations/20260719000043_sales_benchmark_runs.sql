-- Sales Benchmark sürüm kayıtları (Lab / CI regression).
create table if not exists public.sales_benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  benchmark_version text not null,
  git_commit text,
  prompt_version text not null,
  model text,
  average_score numeric not null,
  pass_rate numeric not null,
  hard_fail_count integer not null default 0,
  scenario_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.sales_benchmark_runs is
  'Asistan Lab satış benchmark koşu özetleri (regression).';

create index if not exists sales_benchmark_runs_created_at_idx
  on public.sales_benchmark_runs (created_at desc);

alter table public.sales_benchmark_runs enable row level security;

create policy sales_benchmark_runs_admin_all
  on public.sales_benchmark_runs
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
