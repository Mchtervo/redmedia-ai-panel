-- knowledge_documents: kullanıcı tarafından belirtilen tanımla birebir oluşturuldu.
-- knowledge_chunks: kolonlar kullanıcı tarafından belirtilmedi; AI grounding (RAG) için
-- parçalanmış/embedding'lenmiş içerik saklama ihtiyacına göre v1 taslağı.

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  content text not null,
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.knowledge_documents is 'Redmedia hizmet/politika bilgisi (AI grounding kaynagi).';

create trigger set_knowledge_documents_updated_at
  before update on public.knowledge_documents
  for each row
  execute function public.set_updated_at();

alter table public.knowledge_documents enable row level security;

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

comment on table public.knowledge_chunks is
  'knowledge_documents''in AI aramasi (RAG) icin parcalanmis ve embedding''lenmis halleri.';

create index knowledge_chunks_document_id_idx on public.knowledge_chunks (document_id);

alter table public.knowledge_chunks enable row level security;
