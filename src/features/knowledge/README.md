# features/knowledge

**Menü:** Knowledge (`/dashboard/knowledge`) — genel bilgi bankası (placeholder)

**Sahip olduğu tablo(lar):** `knowledge_documents`, `knowledge_chunks`

**Not:** Conversation Learning onay akışı `knowledge_documents` üzerinde
çalışır; repository:
`repositories/knowledge-documents.repository.ts`.
Panel inceleme UI'sı `/dashboard/ai` (AI Öğrenme) altındadır.

`knowledge_chunks.embedding` vektör RAG sonraki fazdır; v1'de onaylı
dokümanlar güncellik sırasıyla satış asistanına bound edilir.
