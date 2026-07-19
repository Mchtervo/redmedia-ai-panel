-- Meta Instagram Scoped ID (IGSID) — ChatPlace clientId'den ayrı tutulur.
-- DM gönderimi Graph Messaging API ile bu ID üzerinden yapılır.

alter table public.contacts
  add column if not exists meta_igsid text;

comment on column public.contacts.meta_igsid is
  'Meta Instagram Scoped User ID (numeric). ChatPlace contact.id ile karıştırılmaz.';

create unique index if not exists contacts_meta_igsid_key
  on public.contacts (meta_igsid)
  where meta_igsid is not null;
