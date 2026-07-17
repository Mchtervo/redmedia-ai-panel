-- Ortak eklentiler ve yardımcı fonksiyonlar.
-- Bu migration, sonraki tüm migration'ların bağımlı olduğu temel altyapıyı kurar.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- updated_at kolonunu her UPDATE işleminde otomatik olarak şimdiki zamana ayarlar.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'updated_at kolonunu her guncellemede otomatik olarak simdiki zamana ayarlar.';
