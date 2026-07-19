-- AI Sales Learning Engine: Self Improvement.
-- AI'nin kendi hatalarının kaydı: yanlış cevap kalıbı + doğru yaklaşım.
-- Aktif hatalar her cevap üretiminde "yapma" kuralı olarak prompt'a girer;
-- böylece aynı hata ikinci kez yapılmaz.

create table if not exists public.ai_mistakes (
  id uuid primary key default gen_random_uuid(),
  mistake_type text not null check (mistake_type in (
    'premature_detail_question', -- yardım etmeden detay sorma (örn. fiyat sorusuna "nerede olacak?")
    'premature_phone_request',   -- en başta telefon isteme
    'wrong_information',         -- yanlış/uydurma bilgi
    'missed_buying_signal',      -- satın alma sinyalini kaçırma
    'repeated_question',         -- cevaplanmış soruyu tekrar sorma
    'tone_mismatch',             -- yanlış ton / robotik cevap
    'other'
  )),
  trigger_context text not null,      -- hatayı tetikleyen durum (örn. müşteri fiyat sordu)
  wrong_reply text,                   -- verilen yanlış cevap (maskelenmiş)
  correct_approach text not null,     -- doğru yaklaşım / kural
  mistake_key text not null,          -- tekrarları birleştirme anahtarı
  occurrence_count integer not null default 1,
  is_resolved boolean not null default false,
  resolved_note text,
  source_conversation_id uuid
    references public.conversations (id) on delete set null,
  source_ai_run_id uuid
    references public.ai_runs (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_mistakes_key_uidx
  on public.ai_mistakes (mistake_key);

create index if not exists ai_mistakes_active_idx
  on public.ai_mistakes (is_resolved, last_seen_at desc);

create trigger set_ai_mistakes_updated_at
  before update on public.ai_mistakes
  for each row execute function public.set_updated_at();

alter table public.ai_mistakes enable row level security;

comment on table public.ai_mistakes is
  'AI hata hafizasi. Aktif hatalar cevap uretiminde negatif kural olarak kullanilir; ayni hata tekrarlanmaz.';
