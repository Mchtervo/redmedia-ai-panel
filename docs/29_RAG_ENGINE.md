# RAG Engine

# Redmedia AI Growth OS

Version 1.0

---

# Purpose

The Retrieval-Augmented Generation (RAG) Engine enriches AI responses with trusted business knowledge instead of relying only on model memory.

---

# Pipeline

User Request

↓

Intent Detection

↓

Query Rewriting

↓

Embedding

↓

Hybrid Search

↓

Reranking

↓

Context Assembly

↓

LLM Response

↓

Citation

---

# Knowledge Sources

- CRM
- Reservations
- Playbooks
- Company Documents
- Marketing Assets
- FAQs
- Policies
- AI Memory

---

# Retrieval

- Semantic Search
- Keyword Search
- Hybrid Search
- Metadata Filters
- Company Isolation

---

# Chunking

- Semantic Chunking
- Sliding Window
- Overlap
- Document Metadata
- Source Tracking

---

# Reranking

Factors

- Similarity
- Importance
- Freshness
- Confidence
- Business Priority

---

# Hallucination Protection

- Source Validation
- Confidence Threshold
- Missing Context Detection
- Human Escalation

---

# Uygulama Durumu (2026-07-18)

- **Uygulandı**: `src/features/knowledge/services/rag.service.ts` —
  belge parçalama (chunking), embedding üretimi
  (`OPENAI_MODEL_EMBEDDING`, varsayılan `text-embedding-3-small`,
  1536 boyut), pgvector benzerlik araması (`knowledge_chunks`), asistan
  cevabına onaylı bilgi enjeksiyonu. Embedding çağrıları merkezi
  `createEmbeddings` üzerinden yapılır (docs/41).
- **Uygulanmadı**: Query rewriting, hibrit (keyword+vektör) arama,
  reranking, kaynak atıfları (citation). Kaynaklar şimdilik yalnız
  bilgi dokümanlarıdır; mesaj/rezervasyon/kampanya embed edilmez.

# Success Criteria

Every AI answer should be grounded in verified company knowledge.

---

End of Document
