-- Reservation OS core: catalog, plateaus, teams, settings, expand reservations,
-- reservation_items (schedule fields), reservation_changes.

-- ---------------------------------------------------------------------------
-- reservation_settings
-- ---------------------------------------------------------------------------
create table if not exists public.reservation_settings (
  id uuid primary key default gen_random_uuid(),
  default_deposit_amount numeric(12, 2) not null default 1000,
  default_currency text not null default 'TRY',
  default_travel_minutes integer not null default 60,
  auto_confirm_high_confidence_receipts boolean not null default false,
  timezone text not null default 'Europe/Istanbul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reservation_settings is
  'Rezervasyon OS genel ayarlari (kapora, yol suresi, auto-confirm).';

create trigger set_reservation_settings_updated_at
  before update on public.reservation_settings
  for each row
  execute function public.set_updated_at();

alter table public.reservation_settings enable row level security;

insert into public.reservation_settings (default_deposit_amount)
select 1000
where not exists (select 1 from public.reservation_settings);

-- ---------------------------------------------------------------------------
-- service_categories / services / service_campaigns
-- ---------------------------------------------------------------------------
create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_service_categories_updated_at
  before update on public.service_categories
  for each row
  execute function public.set_updated_at();

alter table public.service_categories enable row level security;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories (id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  base_price numeric(12, 2) not null check (base_price >= 0),
  currency text not null default 'TRY',
  service_type text not null default 'standard',
  default_duration_minutes integer not null default 120 check (default_duration_minutes >= 0),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists services_category_id_idx on public.services (category_id);
create index if not exists services_active_idx on public.services (active);

create trigger set_services_updated_at
  before update on public.services
  for each row
  execute function public.set_updated_at();

alter table public.services enable row level security;

create table if not exists public.service_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  campaign_type text not null default 'bundle'
    check (campaign_type in ('bundle', 'fixed_price', 'percentage', 'free_item')),
  discount_type text not null default 'fixed'
    check (discount_type in ('fixed', 'percentage', 'set_price', 'free')),
  discount_value numeric(12, 2) not null default 0,
  required_service_ids uuid[] not null default '{}',
  rewarded_service_id uuid references public.services (id) on delete set null,
  start_date date,
  end_date date,
  active boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_campaigns_active_idx on public.service_campaigns (active);

create trigger set_service_campaigns_updated_at
  before update on public.service_campaigns
  for each row
  execute function public.set_updated_at();

alter table public.service_campaigns enable row level security;

-- ---------------------------------------------------------------------------
-- plateaus / teams
-- ---------------------------------------------------------------------------
create table if not exists public.plateaus (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  address text,
  city text not null default 'Ankara',
  district text,
  active boolean not null default true,
  capacity integer,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_plateaus_updated_at
  before update on public.plateaus
  for each row
  execute function public.set_updated_at();

alter table public.plateaus enable row level security;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_teams_updated_at
  before update on public.teams
  for each row
  execute function public.set_updated_at();

alter table public.teams enable row level security;

-- ---------------------------------------------------------------------------
-- Expand reservations (drop old status check, add columns)
-- ---------------------------------------------------------------------------
alter table public.reservations drop constraint if exists reservations_status_check;

alter table public.reservations
  add column if not exists conversation_id uuid references public.conversations (id) on delete set null,
  add column if not exists customer_profile_id uuid references public.customer_profiles (id) on delete set null,
  add column if not exists customer_full_name text,
  add column if not exists customer_phone text,
  add column if not exists event_type text,
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists venue_type text,
  add column if not exists venue_name text,
  add column if not exists selected_plato_id uuid references public.plateaus (id) on delete set null,
  add column if not exists city text not null default 'Ankara',
  add column if not exists district text,
  add column if not exists selected_service_ids uuid[] not null default '{}',
  add column if not exists package_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists extra_services jsonb not null default '[]'::jsonb,
  add column if not exists subtotal numeric(12, 2) not null default 0,
  add column if not exists discount_amount numeric(12, 2) not null default 0,
  add column if not exists total_price numeric(12, 2) not null default 0,
  add column if not exists deposit_amount numeric(12, 2) not null default 1000,
  add column if not exists deposit_status text not null default 'not_requested',
  add column if not exists deposit_verified_at timestamptz,
  add column if not exists deposit_verified_by uuid references public.profiles (id) on delete set null,
  add column if not exists remaining_amount numeric(12, 2) not null default 0,
  add column if not exists remaining_payment_status text not null default 'unpaid',
  add column if not exists remaining_payment_due_at timestamptz,
  add column if not exists source text not null default 'manual',
  add column if not exists assigned_team_id uuid references public.teams (id) on delete set null,
  add column if not exists internal_notes text,
  add column if not exists customer_notes text,
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists time_status text not null default 'unknown',
  add column if not exists location_status text not null default 'unknown',
  add column if not exists needs_time_followup boolean not null default false,
  add column if not exists needs_location_followup boolean not null default false,
  add column if not exists conflict_override boolean not null default false,
  add column if not exists conflict_override_reason text,
  add column if not exists scheduled_start_at timestamptz,
  add column if not exists scheduled_end_at timestamptz,
  add column if not exists effective_busy_start_at timestamptz,
  add column if not exists effective_busy_end_at timestamptz;

-- Migrate legacy status values then apply new check
update public.reservations set status = 'inquiry' where status = 'pending';

alter table public.reservations
  alter column status set default 'draft';

alter table public.reservations
  add constraint reservations_status_check
  check (status in (
    'draft', 'inquiry', 'availability_check', 'pending_customer',
    'deposit_pending', 'payment_review', 'confirmed', 'completed',
    'cancelled', 'lost', 'shoot_completed'
  ));

alter table public.reservations
  drop constraint if exists reservations_deposit_status_check;
alter table public.reservations
  add constraint reservations_deposit_status_check
  check (deposit_status in (
    'not_requested', 'requested', 'receipt_uploaded', 'under_review',
    'verified', 'rejected', 'refunded'
  ));

alter table public.reservations
  drop constraint if exists reservations_remaining_payment_status_check;
alter table public.reservations
  add constraint reservations_remaining_payment_status_check
  check (remaining_payment_status in ('unpaid', 'partial', 'paid'));

alter table public.reservations
  drop constraint if exists reservations_source_check;
alter table public.reservations
  add constraint reservations_source_check
  check (source in ('manual', 'instagram_ai', 'admin_panel', 'website'));

alter table public.reservations
  drop constraint if exists reservations_time_status_check;
alter table public.reservations
  add constraint reservations_time_status_check
  check (time_status in ('unknown', 'approximate', 'confirmed'));

alter table public.reservations
  drop constraint if exists reservations_location_status_check;
alter table public.reservations
  add constraint reservations_location_status_check
  check (location_status in ('unknown', 'approximate', 'confirmed'));

create index if not exists reservations_event_date_idx on public.reservations (event_date);
create index if not exists reservations_status_idx on public.reservations (status);
create index if not exists reservations_selected_plato_id_idx on public.reservations (selected_plato_id);
create index if not exists reservations_assigned_team_id_idx on public.reservations (assigned_team_id);
create index if not exists reservations_effective_busy_idx
  on public.reservations (effective_busy_start_at, effective_busy_end_at);

-- ---------------------------------------------------------------------------
-- reservation_items
-- ---------------------------------------------------------------------------
create table if not exists public.reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  service_name_snapshot text not null,
  unit_price numeric(12, 2) not null default 0,
  quantity integer not null default 1 check (quantity > 0),
  discount_amount numeric(12, 2) not null default 0,
  final_price numeric(12, 2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  service_duration_minutes integer,
  travel_before_minutes integer not null default 0,
  preparation_before_minutes integer not null default 0,
  travel_after_minutes integer not null default 0,
  effective_busy_start_at timestamptz,
  effective_busy_end_at timestamptz,
  location_id uuid references public.plateaus (id) on delete set null,
  location_text text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  location_status text not null default 'unknown'
    check (location_status in ('unknown', 'approximate', 'confirmed')),
  time_status text not null default 'unknown'
    check (time_status in ('unknown', 'approximate', 'confirmed')),
  travel_time_source text not null default 'default'
    check (travel_time_source in ('default', 'manual', 'maps_api')),
  manual_travel_minutes integer,
  calculated_travel_minutes integer,
  route_distance_km numeric(10, 2),
  route_checked_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reservation_items_reservation_id_idx
  on public.reservation_items (reservation_id);

create trigger set_reservation_items_updated_at
  before update on public.reservation_items
  for each row
  execute function public.set_updated_at();

alter table public.reservation_items enable row level security;

-- ---------------------------------------------------------------------------
-- reservation_changes
-- ---------------------------------------------------------------------------
create table if not exists public.reservation_changes (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  changed_by_type text not null default 'system'
    check (changed_by_type in ('staff', 'ai', 'system', 'customer')),
  changed_by_id uuid,
  field_name text not null,
  old_value jsonb,
  new_value jsonb,
  reason text,
  requires_admin_approval boolean not null default false,
  approval_status text not null default 'applied'
    check (approval_status in ('pending', 'approved', 'rejected', 'applied')),
  created_at timestamptz not null default now()
);

create index if not exists reservation_changes_reservation_id_idx
  on public.reservation_changes (reservation_id);

alter table public.reservation_changes enable row level security;
