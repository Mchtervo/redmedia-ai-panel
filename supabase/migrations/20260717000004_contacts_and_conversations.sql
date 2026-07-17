-- contacts, conversations, messages, conversation_summaries
-- Kolonlar kullanıcı tarafından belirtilen tanımla birebir oluşturuldu.

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  instagram_user_id text,
  username text,
  full_name text,
  phone text,
  email text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz,
  status text not null default 'active' check (status in ('active', 'archived', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contacts is 'Bir Instagram/Facebook kullanicisini (musteriyi) temsil eder.';

create unique index contacts_instagram_user_id_key
  on public.contacts (instagram_user_id)
  where instagram_user_id is not null;

create trigger set_contacts_updated_at
  before update on public.contacts
  for each row
  execute function public.set_updated_at();

alter table public.contacts enable row level security;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  channel text not null check (channel in ('instagram', 'facebook')),
  external_conversation_id text,
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  assigned_to uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.conversations is 'Musteri ile yurutulen gorusme (ChatPlace uzerinden).';

create index conversations_contact_id_idx on public.conversations (contact_id);

create unique index conversations_channel_external_id_key
  on public.conversations (channel, external_conversation_id)
  where external_conversation_id is not null;

create trigger set_conversations_updated_at
  before update on public.conversations
  for each row
  execute function public.set_updated_at();

alter table public.conversations enable row level security;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  external_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('customer', 'ai', 'staff', 'system')),
  message_type text not null default 'text'
    check (message_type in ('text', 'image', 'video', 'audio', 'file', 'template')),
  content text,
  created_at timestamptz not null default now(),
  raw_payload jsonb
);

comment on table public.messages is 'Konusma icindeki tum mesajlar.';

create index messages_conversation_id_idx on public.messages (conversation_id);

create unique index messages_conversation_external_id_key
  on public.messages (conversation_id, external_message_id)
  where external_message_id is not null;

alter table public.messages enable row level security;

create table public.conversation_summaries (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  summary text,
  customer_needs text,
  objections text,
  important_dates jsonb,
  budget text,
  next_action text,
  updated_at timestamptz not null default now()
);

comment on table public.conversation_summaries is 'Uzun konusmanin AI tarafindan uretilen kisa hafizasi.';

create trigger set_conversation_summaries_updated_at
  before update on public.conversation_summaries
  for each row
  execute function public.set_updated_at();

alter table public.conversation_summaries enable row level security;
