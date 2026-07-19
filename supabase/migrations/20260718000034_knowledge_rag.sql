-- RAG Engine (docs/29, docs/30): onaylı knowledge_documents içeriği
-- knowledge_chunks üzerinde embedding ile aranır. Yalnızca
-- approved + is_active + kampanya iddiası olmayan dokümanlar döner
-- (04-ai-behavior grounding kuralı).

create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count int default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity double precision
)
language sql
stable
as $$
  select
    kc.id as chunk_id,
    kc.document_id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  join public.knowledge_documents kd on kd.id = kc.document_id
  where kc.embedding is not null
    and kd.review_status = 'approved'
    and kd.is_active = true
    and kd.is_campaign_claim = false
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;

comment on function public.match_knowledge_chunks is
  'RAG: onayli ve aktif knowledge dokumanlarinin chunklarinda cosine benzerlik aramasi.';
