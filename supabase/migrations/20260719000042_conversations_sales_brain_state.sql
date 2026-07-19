-- Konuşma bazlı Satış Beyni state (funnel + memory + persona/emotion).
alter table public.conversations
  add column if not exists sales_brain_state jsonb;

comment on column public.conversations.sales_brain_state is
  'Satış Beyni snapshot: state, persona, emotion, memory, decisionPct vb.';
