-- Quality score faktörleri (+/-) ve önerilen alternatif cevap

alter table public.conversation_quality_scores
  add column if not exists factors jsonb not null default '[]'::jsonb;

alter table public.conversation_quality_scores
  add column if not exists loss_reason text;

alter table public.conversation_quality_scores
  add column if not exists suggested_reply text;

comment on column public.conversation_quality_scores.factors is
  'Skoru oluşturan +/- faktörler: [{label, delta, sign}]';

comment on column public.conversation_quality_scores.suggested_reply is
  'Kayıp/zayıf konuşma için önerilen alternatif cevap.';

comment on column public.conversation_quality_scores.loss_reason is
  'Birincil kayıp nedeni (Türkçe kısa etiket).';
