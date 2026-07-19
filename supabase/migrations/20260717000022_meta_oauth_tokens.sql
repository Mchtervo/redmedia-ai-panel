-- Meta OAuth token depolama (yalnızca sunucu / service role)
-- Token değerleri frontend'e asla gönderilmez.

create table if not exists public.meta_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'meta' check (provider = 'meta'),
  access_token text not null,
  token_type text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  meta_user_id text,
  meta_user_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meta_oauth_tokens_active_idx
  on public.meta_oauth_tokens (is_active, expires_at desc);

create trigger set_meta_oauth_tokens_updated_at
  before update on public.meta_oauth_tokens
  for each row execute function public.set_updated_at();

alter table public.meta_oauth_tokens enable row level security;

comment on table public.meta_oauth_tokens is
  'Meta uzun ömürlü access token. Yalnızca service role ile okunur.';
