-- Staff management: members, roles, unavailability, reservation assignments

create table if not exists public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.staff_roles is 'Personel gorev rolleri (ana cekim, fotografci, drone vb.).';

alter table public.staff_roles enable row level security;

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  profile_photo_url text,
  active boolean not null default true,
  notes text,
  default_start_time time,
  default_end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff_members is 'Panelden yonetilen cekim personeli.';

create index if not exists staff_members_active_idx on public.staff_members (active);

create trigger set_staff_members_updated_at
  before update on public.staff_members
  for each row
  execute function public.set_updated_at();

alter table public.staff_members enable row level security;

create table if not exists public.staff_member_roles (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members (id) on delete cascade,
  staff_role_id uuid not null references public.staff_roles (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (staff_member_id, staff_role_id)
);

create index if not exists staff_member_roles_member_idx
  on public.staff_member_roles (staff_member_id);
create index if not exists staff_member_roles_role_idx
  on public.staff_member_roles (staff_role_id);

alter table public.staff_member_roles enable row level security;

create table if not exists public.staff_unavailability (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  type text not null default 'manual_block'
    check (type in ('day_off', 'leave', 'sick', 'personal', 'manual_block')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index if not exists staff_unavailability_member_idx
  on public.staff_unavailability (staff_member_id);
create index if not exists staff_unavailability_range_idx
  on public.staff_unavailability (start_at, end_at);

create trigger set_staff_unavailability_updated_at
  before update on public.staff_unavailability
  for each row
  execute function public.set_updated_at();

alter table public.staff_unavailability enable row level security;

create table if not exists public.reservation_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  reservation_item_id uuid references public.reservation_items (id) on delete set null,
  staff_member_id uuid not null references public.staff_members (id) on delete restrict,
  assigned_role text not null,
  assignment_status text not null default 'assigned'
    check (assignment_status in (
      'proposed', 'assigned', 'accepted', 'declined', 'completed', 'cancelled'
    )),
  assigned_by uuid references public.profiles (id) on delete set null,
  notes text,
  override_conflict boolean not null default false,
  override_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reservation_staff_assignments_reservation_idx
  on public.reservation_staff_assignments (reservation_id);
create index if not exists reservation_staff_assignments_staff_idx
  on public.reservation_staff_assignments (staff_member_id);
create index if not exists reservation_staff_assignments_status_idx
  on public.reservation_staff_assignments (assignment_status);

create trigger set_reservation_staff_assignments_updated_at
  before update on public.reservation_staff_assignments
  for each row
  execute function public.set_updated_at();

alter table public.reservation_staff_assignments enable row level security;

-- services.required_role_slug optional override (nullable; logic can infer)
alter table public.services
  add column if not exists required_role_slug text;

-- Panel bildirimleri (personel atama vb.; ileride personel paneli icin)
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

-- Personel islem audit log
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

-- Staff reminders: reminder_jobs'a personel baglantisi
alter table public.reminder_jobs
  add column if not exists staff_member_id uuid
    references public.staff_members (id) on delete cascade;

create index if not exists reminder_jobs_staff_member_idx
  on public.reminder_jobs (staff_member_id)
  where staff_member_id is not null;

-- Seed roles
insert into public.staff_roles (id, name, slug, description) values
  ('e5000001-0001-4000-8000-000000000001', 'Ana Çekim Sorumlusu', 'main_operator', 'Foto+video/drone/klip içeren ana çekimler'),
  ('e5000001-0001-4000-8000-000000000002', 'Etkinlik Fotoğrafçısı', 'event_photographer', 'Nikâh/nişan/kına yalnız fotoğraf'),
  ('e5000001-0001-4000-8000-000000000003', 'Düğün Salonu Fotoğrafçısı', 'wedding_venue_photographer', 'Salon yalnız fotoğraf'),
  ('e5000001-0001-4000-8000-000000000004', 'Omuz Kamera Operatörü', 'shoulder_camera_operator', 'Omuz kamera'),
  ('e5000001-0001-4000-8000-000000000005', 'Video Operatörü', 'video_operator', 'Video çekimleri'),
  ('e5000001-0001-4000-8000-000000000006', 'Drone Operatörü', 'drone_operator', 'Drone çekimleri'),
  ('e5000001-0001-4000-8000-000000000007', 'Yardımcı Personel', 'assistant', 'Yardımcı personel')
on conflict (slug) do nothing;
