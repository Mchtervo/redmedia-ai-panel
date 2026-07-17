-- ai_runs: kullanıcı tarafından belirtilen tanımla birebir oluşturuldu (+ ilişki/insan onayı kolonları).
-- ai_feedback: kolonlar kullanıcı tarafından belirtilmedi; personelin AI cevabını
-- değerlendirmesi ihtiyacına göre v1 taslağı.

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  task_type text not null,
  conversation_id uuid references public.conversations (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric(10, 4),
  result jsonb,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  requires_human_approval boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.ai_runs is 'Her yapay zeka (OpenAI) model calismasinin kaydi.';

create index ai_runs_conversation_id_idx on public.ai_runs (conversation_id);
create index ai_runs_contact_id_idx on public.ai_runs (contact_id);

alter table public.ai_runs enable row level security;

create table public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references public.ai_runs (id) on delete cascade,
  feedback_type text not null check (feedback_type in ('positive', 'negative', 'correction')),
  comment text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.ai_feedback is 'Personelin bir AI cevabina (ai_runs) verdigi geri bildirim.';

create index ai_feedback_ai_run_id_idx on public.ai_feedback (ai_run_id);

alter table public.ai_feedback enable row level security;
