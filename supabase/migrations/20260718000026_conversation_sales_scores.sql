-- AI Sales Learning Engine: Conversation Scoring.
-- Her analiz edilen konuşmaya 0-100 arası satış kalitesi puanları eklenir
-- (satış kalitesi, empati, hız, ikna, rezervasyona yakınlık) + eksikler.

alter table public.conversation_analyses
  add column if not exists score_sales_quality integer
    check (score_sales_quality is null or score_sales_quality between 0 and 100),
  add column if not exists score_empathy integer
    check (score_empathy is null or score_empathy between 0 and 100),
  add column if not exists score_speed integer
    check (score_speed is null or score_speed between 0 and 100),
  add column if not exists score_persuasion integer
    check (score_persuasion is null or score_persuasion between 0 and 100),
  add column if not exists score_closing integer
    check (score_closing is null or score_closing between 0 and 100),
  add column if not exists score_notes text,
  add column if not exists first_customer_question text,
  add column if not exists first_reply_given text,
  add column if not exists drop_off_point text,
  add column if not exists reservation_created boolean not null default false,
  add column if not exists deposit_received boolean not null default false,
  add column if not exists is_best_conversation boolean not null default false;

comment on column public.conversation_analyses.score_notes is
  'Konusmanin eksikleri / gelistirilecek yonler (Turkce, kisa maddeler).';
comment on column public.conversation_analyses.drop_off_point is
  'Musterinin vazgectigi / konusmanin koptugu nokta.';
comment on column public.conversation_analyses.is_best_conversation is
  'Best Conversation Library adayi; ornek satis konusmasi.';

create index if not exists conversation_analyses_best_idx
  on public.conversation_analyses (is_best_conversation)
  where is_best_conversation = true;

create index if not exists conversation_analyses_sales_quality_idx
  on public.conversation_analyses (score_sales_quality desc nulls last);
