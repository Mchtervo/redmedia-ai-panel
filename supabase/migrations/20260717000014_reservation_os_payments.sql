-- Reservation OS: payment accounts + receipts

create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  account_holder_name text not null,
  iban text not null,
  currency text not null default 'TRY',
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payment_accounts is
  'Admin girisli IBAN bilgileri; AI yalnizca varsayilan aktif hesabi kullanir.';

create unique index if not exists payment_accounts_single_default_idx
  on public.payment_accounts (is_default)
  where is_default = true and active = true;

create trigger set_payment_accounts_updated_at
  before update on public.payment_accounts
  for each row
  execute function public.set_updated_at();

alter table public.payment_accounts enable row level security;

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  file_url text not null,
  file_hash text,
  original_filename text,
  uploaded_via text not null default 'admin_panel'
    check (uploaded_via in ('admin_panel', 'instagram', 'chatplace', 'website')),
  extracted_text text,
  detected_bank text,
  detected_sender_name text,
  detected_recipient_name text,
  detected_iban text,
  detected_amount numeric(12, 2),
  detected_currency text,
  detected_transaction_date date,
  detected_reference text,
  confidence_score numeric(4, 3),
  validation_result text,
  validation_reasons jsonb not null default '[]'::jsonb,
  manipulation_signals jsonb not null default '[]'::jsonb,
  receipt_verified boolean not null default false,
  payment_confirmed boolean not null default false,
  status text not null default 'uploaded'
    check (status in (
      'uploaded', 'analyzing', 'needs_review', 'verified', 'rejected'
    )),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_receipts_reservation_id_idx
  on public.payment_receipts (reservation_id);
create index if not exists payment_receipts_status_idx
  on public.payment_receipts (status);
create unique index if not exists payment_receipts_reference_unique_idx
  on public.payment_receipts (detected_reference)
  where detected_reference is not null;
create unique index if not exists payment_receipts_file_hash_unique_idx
  on public.payment_receipts (file_hash)
  where file_hash is not null;

alter table public.payment_receipts enable row level security;
