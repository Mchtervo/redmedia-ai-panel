-- recommendations, automation_logs: kolonlar kullanıcı tarafından belirtilmedi;
-- docs/AI.md ve docs/META.md'deki "AI yalnızca öneri üretir, insan onayı gerekir"
-- ve genel otomasyon takibi ihtiyacına göre v1 taslağı.

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  -- target_type/target_id ile campaign/ad_set/ad/lead gibi farklı tablolara
  -- kasıtlı olarak polimorfik (FK'sız) referans verir; tek bir hedef türüne
  -- kilitlenmemek için sabit foreign key eklenmedi.
  target_type text not null check (target_type in ('campaign', 'ad_set', 'ad', 'lead')),
  target_id uuid not null,
  recommendation_type text not null,
  description text not null,
  suggested_action jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'applied')),
  requires_human_approval boolean not null default true,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.recommendations is
  'AI tarafindan uretilen oneriler (kampanya/reklam/lead); insan onayi olmadan uygulanmaz.';

create index recommendations_target_idx on public.recommendations (target_type, target_id);
create index recommendations_status_idx on public.recommendations (status);

alter table public.recommendations enable row level security;

create table public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('chatplace', 'meta', 'ai', 'system')),
  action text not null,
  status text not null default 'success' check (status in ('success', 'failed', 'skipped')),
  details jsonb,
  related_contact_id uuid references public.contacts (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.automation_logs is 'Otomasyon/entegrasyon islemlerinin genel aktivite kaydi.';

create index automation_logs_source_idx on public.automation_logs (source);
create index automation_logs_related_contact_id_idx on public.automation_logs (related_contact_id);

alter table public.automation_logs enable row level security;
