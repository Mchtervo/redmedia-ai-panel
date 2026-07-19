# Prompt Engine

# Redmedia AI Growth OS

Version 1.0

---

# Purpose

Generate dynamic, safe and context-aware prompts for every AI task.

---

# Architecture

User Request

↓

Context Builder

↓

Memory Retrieval

↓

Knowledge Retrieval

↓

Tool Selection

↓

Prompt Assembly

↓

Model Selection

↓

Validation

↓

Execution

---

# Prompt Components

- System Instructions
- Company Context
- User Context
- Memory
- Knowledge
- Available Tools
- Output Format
- Guardrails

---

# Context Builder

Collects

- Company Data
- Customer Data
- CRM
- Reservations
- Marketing
- Previous Conversations

---

# Model Routing

Choose model based on

- Cost
- Latency
- Complexity
- Context Length
- Accuracy

---

# Safety

- Prompt Injection Protection
- Sensitive Data Filtering
- Company Isolation
- Output Validation

---

# Versioning

Every prompt stores

- Version
- Author
- Performance
- Success Rate
- Cost

---

# Uygulama Durumu (2026-07-18)

- **Uygulandı**: Model seçimi Model Router iledir (docs/41); prompt'lar
  bağlamla (CRM profili, konuşma özeti, onaylı bilgi, satış öğrenme
  hafızası, rezervasyon taslağı) dinamik kurulur — örn.
  `src/features/ai/prompts/simple-assistant.ts` +
  `buildAssistantUserPrompt`. Guardrail'ler prompt içinde ve kod
  seviyesindedir (fiyat uydurma yasağı, insan onayı tetikleyicileri).
- **Uygulanmadı**: Merkezi prompt kayıt/versiyonlama deposu, prompt başına
  performans/succes-rate ölçümü, otomatik prompt injection filtresi.
  Prompt'lar modül sabitlerinde tutulur ve kod incelemesiyle değişir.

# Success Criteria

Every prompt should be optimized for quality, consistency, speed and cost.

---

End of Document
