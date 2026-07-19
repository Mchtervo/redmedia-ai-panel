import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  createEmbeddings,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";

type TypedSupabaseClient = SupabaseClient<Database>;

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

/**
 * Metni yaklaşık CHUNK_SIZE karakterlik, hafif örtüşen parçalara böler.
 * Cümle ortasından kesmemek için son boşlukta geri kırpar.
 */
export function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= CHUNK_SIZE) return [trimmed];

  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    let end = Math.min(start + CHUNK_SIZE, trimmed.length);
    if (end < trimmed.length) {
      const lastSpace = trimmed.lastIndexOf(" ", end);
      if (lastSpace > start + CHUNK_SIZE / 2) {
        end = lastSpace;
      }
    }
    chunks.push(trimmed.slice(start, end).trim());
    if (end >= trimmed.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * RAG Engine (docs/29): bir knowledge dokümanını parçalar, embedding üretir
 * ve knowledge_chunks'a yazar (eski chunk'lar silinir). Embedding yoksa
 * sessizce atlar; AI cevap akışı embedding olmadan da çalışır (fallback).
 */
export async function indexKnowledgeDocument(
  supabase: TypedSupabaseClient,
  documentId: string
): Promise<{ indexed: boolean; chunkCount: number }> {
  if (!isOpenAiConfigured()) {
    return { indexed: false, chunkCount: 0 };
  }

  const { data: doc, error: docError } = await supabase
    .from("knowledge_documents")
    .select("id, title, content")
    .eq("id", documentId)
    .maybeSingle();
  if (docError) throw docError;
  if (!doc) return { indexed: false, chunkCount: 0 };

  const chunks = chunkText(`${doc.title}\n\n${doc.content}`);
  if (chunks.length === 0) return { indexed: false, chunkCount: 0 };

  const embeddings = await createEmbeddings(chunks);

  const { error: deleteError } = await supabase
    .from("knowledge_chunks")
    .delete()
    .eq("document_id", documentId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("knowledge_chunks").insert(
    chunks.map((content, index) => ({
      document_id: documentId,
      chunk_index: index,
      content,
      token_count: Math.ceil(content.length / 4),
      embedding: JSON.stringify(embeddings[index]),
    }))
  );
  if (insertError) throw insertError;

  return { indexed: true, chunkCount: chunks.length };
}

export type RagKnowledgeHit = {
  documentId: string;
  category: string | null;
  title: string;
  content: string;
  similarity: number;
};

/**
 * Müşteri mesajına en yakın onaylı knowledge parçalarını döner (docs/29).
 * Embedding/chunk yoksa boş liste döner; çağıran taraf tarih sıralı
 * listeye (listApprovedKnowledgeForReply) geri düşer.
 */
export async function searchKnowledgeForReply(
  supabase: TypedSupabaseClient,
  query: string,
  limit = 8
): Promise<RagKnowledgeHit[]> {
  if (!isOpenAiConfigured()) return [];
  const trimmed = query.trim();
  if (!trimmed) return [];

  const [embedding] = await createEmbeddings([trimmed.slice(0, 2000)]);
  if (!embedding) return [];

  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: JSON.stringify(embedding),
    match_count: limit,
  });
  if (error) throw error;
  const hits = data ?? [];
  if (hits.length === 0) return [];

  const documentIds = [...new Set(hits.map((hit) => hit.document_id))];
  const { data: docs, error: docsError } = await supabase
    .from("knowledge_documents")
    .select("id, title, category")
    .in("id", documentIds);
  if (docsError) throw docsError;

  const docById = new Map((docs ?? []).map((doc) => [doc.id, doc]));
  return hits.map((hit) => {
    const doc = docById.get(hit.document_id);
    return {
      documentId: hit.document_id,
      category: doc?.category ?? null,
      title: doc?.title ?? "Bilgi",
      content: hit.content,
      similarity: hit.similarity,
    };
  });
}

/**
 * Chunk'ı olmayan onaylı dokümanları toplu indeksler (backfill).
 * Cron içinden best-effort çağrılır.
 */
export async function backfillKnowledgeIndex(
  supabase: TypedSupabaseClient,
  maxDocuments = 10
): Promise<{ indexedDocuments: number }> {
  if (!isOpenAiConfigured()) return { indexedDocuments: 0 };

  const { data: approvedDocs, error } = await supabase
    .from("knowledge_documents")
    .select("id")
    .eq("review_status", "approved")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const docIds = (approvedDocs ?? []).map((doc) => doc.id);
  if (docIds.length === 0) return { indexedDocuments: 0 };

  const { data: chunkRows, error: chunkError } = await supabase
    .from("knowledge_chunks")
    .select("document_id")
    .in("document_id", docIds);
  if (chunkError) throw chunkError;

  const indexedIds = new Set((chunkRows ?? []).map((row) => row.document_id));
  const missing = docIds.filter((id) => !indexedIds.has(id));

  let indexedDocuments = 0;
  for (const documentId of missing.slice(0, maxDocuments)) {
    try {
      const result = await indexKnowledgeDocument(supabase, documentId);
      if (result.indexed) indexedDocuments += 1;
    } catch (indexError) {
      console.error(
        "[rag] doküman indeksleme hatası:",
        indexError instanceof Error ? indexError.message : "bilinmeyen"
      );
    }
  }

  return { indexedDocuments };
}
