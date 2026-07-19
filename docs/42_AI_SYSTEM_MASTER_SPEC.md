# AI_SYSTEM_MASTER_SPEC.md
# Redmedia AI Growth OS
Version 1.0

---

# Purpose

This document defines the complete AI architecture of the platform in a single specification.

## 1. AI Model Router
- Automatic model selection
- Cost optimization
- Fallback strategy
- Tool routing
- Memory integration

## 2. AI Agents

### AI CEO
- Strategic decisions
- KPI monitoring
- Business recommendations

### AI Marketing Director
- Campaign optimization
- Creative recommendations
- Budget allocation

### AI Sales Manager
- Lead scoring
- Sales pipeline optimization
- Follow-up recommendations

### AI Reservation Manager
- Reservation automation
- Calendar management
- Customer reminders

### AI Support Agent
- DM and email replies
- FAQ handling
- Ticket routing

### AI Finance
- Revenue analysis
- Expense tracking
- Profit reporting

## 3. Tool Registry

Integrated tools:
- Meta Ads API
- Instagram Graph API
- WhatsApp
- Gmail
- Google Calendar
- Stripe
- Supabase
- Redis
- Internal CRM
- Analytics Engine
- Reservation Engine

Rules:
- Select the minimum required tool.
- Validate permissions before execution.
- Log every tool call.

## 4. Memory Engine

Stores:
- Customer history
- CRM records
- Conversations
- Campaign history
- Successful playbooks
- Reservations
- Business knowledge

Pipeline:
Retrieve -> RAG -> Execute -> Save -> Re-embed

## 5. Cost Optimization

Priority:
1. GPT-5 Nano
2. GPT-5 Mini
3. GPT-5
4. o3

Escalate only when complexity requires.

Use:
- Prompt caching
- Response caching
- Embedding reuse
- Batch processing

## 6. Monitoring

Track:
- Token usage
- Cost
- Latency
- Tool failures
- Success rate
- AI accuracy
- User satisfaction

## 7. Workflow

User Request
↓
Intent Detection
↓
Permission Check
↓
Memory Retrieval
↓
Model Selection
↓
Tool Selection
↓
Execution
↓
Validation
↓
Response
↓
Memory Update
↓
Analytics

## Long-term Goal

Build an autonomous AI Business Operating System capable of managing CRM, marketing, reservations, reporting, customer communication and business intelligence through specialized AI agents coordinated by a central AI Router.

---

## Uygulama Durumu (2026-07-18)

| Bölüm | Durum | Gerçek uygulama |
| --- | --- | --- |
| 1. Model Router | Uygulandı | `src/lib/ai/model-router.ts` — FAST/DEFAULT/REASONING/COMPLEX/EMBEDDING katmanları, env tabanlı (`OPENAI_MODEL_*`), doğrulama + fallback + maliyet tahmini (docs/41). GPT-5/o3 gibi model adları sabit kodlanmaz; env ile atanır. |
| 2. AI Agents | Kısmen | Alan bazlı AI servisleri (CEO, satış asistanı, pazarlama, rezervasyon, dekont analizi); otonom ajan koordinasyonu yok (docs/06). |
| 3. Tool Registry | Farklı | LLM tool-calling yerine deterministik servis katmanı; ChatPlace MCP salt okuma istemcisi eklendi (docs/44). Stripe/Redis/Gmail vb. yok. |
| 4. Memory Engine | Kısmen | Supabase tabanlı kalıcı hafıza + pgvector RAG (docs/07, docs/29); kısa/uzun bellek ayrımı ve re-embed döngüsü yok. |
| 5. Cost Optimization | Kısmen | Katman bazlı model seçimi + `ai_runs.estimated_cost`; prompt/response cache yok. |
| 6. Monitoring | Kısmen | `ai_runs` (model, token, maliyet, durum, onay) + panel raporları; latency/satisfaction ölçümü yok. |
| 7. Workflow | Farklı | Görev tipi çağıran servis tarafından bildirilir; Intent Detection → Tool Selection otonom döngüsü yok. |
