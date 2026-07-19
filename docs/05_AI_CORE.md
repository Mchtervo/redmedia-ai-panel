# AI Core Architecture

# Redmedia AI Growth OS

Version 1.0

---

# Purpose

AI Core is the central intelligence of the platform.

No module should communicate directly with an LLM.

Every AI request must pass through AI Core.

AI Core is responsible for:

- Context Building
- Prompt Management
- Memory Retrieval
- Knowledge Retrieval
- Tool Calling
- Reasoning
- Decision Making
- Response Generation
- Learning
- Logging

---

# AI Pipeline

User / Automation

↓

AI Core

↓

Context Builder

↓

Memory Engine

↓

Knowledge Engine

↓

Playbook Engine

↓

Prompt Engine

↓

Reasoning Engine

↓

Tool Router

↓

LLM

↓

Validation

↓

Confidence Engine

↓

Decision Engine

↓

Response

↓

Learning Engine

↓

Memory Update

---

# AI Principles

AI never guesses.

AI always explains.

AI always logs.

AI always learns.

AI always remembers.

AI always follows company rules.

AI never skips validation.

---

# AI Brain

The AI Brain is the orchestrator.

Responsibilities

Reasoning

Decision Making

Task Planning

Agent Coordination

Context Selection

Learning

Optimization

---

# Context Builder

Every request builds a dynamic context.

Sources

Current User

Current Company

Customer

CRM

Reservations

Campaigns

Conversations

Knowledge Base

Playbooks

Long Memory

Short Memory

Settings

Permissions

Automation Rules

Current Time

Current Date

Language

Location

---

# Context Priority

1 Company Rules

2 Active Customer

3 Current Conversation

4 Playbooks

5 Long Memory

6 Knowledge Base

7 Recent Events

8 AI Settings

---

# Prompt Engine

Prompt Engine creates the final prompt.

Sections

System Prompt

Company Rules

User Context

Customer Context

Business Context

Retrieved Memories

Relevant Playbooks

Knowledge Articles

Conversation History

Expected Output Format

Validation Rules

---

# Prompt Rules

Never duplicate context.

Remove irrelevant memories.

Limit token usage.

Prefer recent business data.

Always include company rules.

---

# Knowledge Engine

Knowledge Sources

Company Knowledge

FAQ

Services

Pricing

Packages

Policies

Internal Documents

Uploaded Files

AI Generated Articles

Everything is searchable.

---

# Retrieval (RAG)

Uses pgvector.

Embedding Sources

Documents

Playbooks

Messages

Reservations

Campaigns

Reports

Conversations

Semantic search retrieves only relevant information.

---

# Memory Engine

Memory Types

Short-Term

Long-Term

Business Memory

Conversation Memory

Marketing Memory

Sales Memory

Support Memory

Operational Memory

---

# Short-Term Memory

Stores

Current conversation

Recent customer actions

Temporary reasoning

Automatically expires.

---

# Long-Term Memory

Stores

Winning campaigns

Winning conversations

Successful reservations

Business decisions

AI experiences

Never automatically removed.

---

# Playbook Engine

When AI detects repeated success

↓

Generate Playbook

↓

Validate

↓

Save

↓

Reuse

↓

Improve

Playbooks are versioned.

---

# Reasoning Engine

Before responding AI evaluates

Intent

Business Goal

Customer Goal

Company Rules

Risk

Previous Experiences

Available Tools

Confidence

Only then proceeds.

---

# Decision Engine

Every decision includes

Decision

Reason

Confidence

Evidence

Expected Outcome

Related Memories

Related Playbooks

Alternative Options

---

# Confidence Engine

95-100

Automatic

85-94

Automatic if enabled

70-84

Recommend

50-69

Manual Approval

Below 50

Reject

---

# Tool Router

AI may use tools only when required.

Examples

CRM

Reservations

Meta Ads

Instagram

Messenger

Notifications

Reports

Storage

OCR

Calendar

Email

Every tool call is logged.

---

# Agent Communication

AI Agents never bypass AI Core.

Communication Flow

AI CEO

↓

AI Core

↓

Marketing Agent

↓

CRM Agent

↓

Support Agent

↓

Reservation Agent

↓

Reporting Agent

All communication passes through AI Core.

---

# Response Validator

Every response is validated.

Checks

Business Rules

Formatting

Permissions

Safety

Missing Data

Hallucination Risk

Confidence

---

# Learning Engine

After every completed task

↓

Analyze outcome

↓

Compare expectation

↓

Store result

↓

Update memory

↓

Improve playbook

↓

Improve future prompts

---

# Explainability

Every AI action stores

Prompt Version

Model

Temperature

Reason

Confidence

Context Used

Retrieved Memories

Retrieved Knowledge

Execution Time

Cost

---

# AI Cost Optimization

Reduce unnecessary prompts.

Reuse cached context.

Reuse embeddings.

Avoid duplicate retrieval.

Compress conversation history.

Only retrieve relevant memories.

---

# AI Models

Fast Model

Simple tasks

Classification

Tagging

Intent Detection

---

Reasoning Model

Complex planning

Decision making

Business analysis

Automation planning

---

Vision Model

OCR

Image Analysis

Creative Analysis

Album Analysis

Marketing Assets

---

# AI Safety

AI cannot

Delete business data automatically

Send payments

Modify billing

Remove users

Access another company

Ignore company rules

Leak customer data

---

# AI Logging

Every AI execution stores

Task

Prompt

Response

Model

Latency

Cost

Confidence

Result

Error

User

Company

---

# Uygulama Durumu (2026-07-18)

Bu doküman vizyon spesifikasyonudur; gerçek uygulama aşağıdaki gibidir
(çelişkide kod esas alınır):

- **Uygulandı**: Modüller LLM'e doğrudan gitmez — tek çıkış
  `src/lib/ai/openai-client.ts` (+ `model-router.ts`, docs/41). Her çağrı
  `ai_runs`'a model/token/tahmini maliyet ile loglanır. Confidence Engine
  `src/lib/ai/confidence.ts` (90/70/50 eşikleri — bu dokümandaki 95/85/70/50
  merdiveninin sadeleştirilmiş hali). Grounding: fiyat/hizmet yalnız
  Supabase kaynağından (docs/43 §12, `.cursor/rules/04`). RAG pgvector ile
  `src/features/knowledge/services/rag.service.ts`. Playbook Engine
  `src/features/playbooks/`. Öğrenme hattı `src/features/learning/` +
  `sales-learning`.
- **Kısmen**: Prompt yönetimi modül bazlı sabitlerdedir (örn.
  `src/features/ai/prompts/`); merkezi versiyonlu Prompt Engine yok.
  Bağlam kurma her serviste açık kodludur (Context Builder soyutlaması yok).
- **Uygulanmadı**: Otonom Tool Router / agent koordinasyon döngüsü,
  kısa/uzun bellek ayrımıyla otomatik süresi dolan bellek, çok kiracılı
  (company) izolasyon (uygulama tek işletme içindir).

# Success Criteria

The AI Core should become smarter every day.

Every interaction must improve future interactions.

Every successful decision becomes reusable knowledge.

Every mistake becomes a learning opportunity.

The AI system should continuously evolve into an increasingly autonomous business operating system.

---

End of Document