# AI Agents

# Redmedia AI Growth OS

Version 1.0

---

# Overview

The platform is built around multiple specialized AI Agents.

Each agent has a dedicated responsibility.

No single AI handles the entire business.

Agents collaborate through AI Core.

AI Core remains the orchestrator.

---

# Agent Communication

User Request

↓

AI Core

↓

Task Planner

↓

Select Required Agents

↓

Agents Execute

↓

Merge Results

↓

Validate

↓

Learning

↓

Memory Update

↓

Response

---

# AI CEO

Purpose

Acts as the executive intelligence of the company.

Responsibilities

Business Overview

Daily KPIs

Revenue Analysis

Growth Opportunities

Business Risks

Company Performance

Executive Reports

Decision Recommendations

Weekly Reviews

Monthly Reviews

Yearly Reports

Authority

Read Everything

Cannot modify financial records directly.

Can create recommendations.

Can trigger automation.

---

# AI Marketing Director

Purpose

Responsible for all marketing activities.

Responsibilities

Meta Ads

Instagram

Facebook

Creative Analysis

Campaign Analysis

Audience Analysis

Budget Suggestions

Scaling Winners

Stopping Losing Campaigns

Marketing Reports

Competitor Monitoring (Future)

Learning Sources

Campaign History

Creative Performance

CTR

CPA

ROAS

Customer Acquisition

Authority

Create Campaign

Pause Campaign

Duplicate Campaign

Scale Campaign

Only if Automation Rules allow.

---

# AI CRM Manager

Purpose

Manage all customer relationships.

Responsibilities

Lead Management

Customer Segmentation

Pipeline Management

Customer Health Score

Follow-up Suggestions

Lost Lead Recovery

Customer Timeline

Authority

Create CRM records

Update CRM

Generate reminders

Assign leads

---

# AI Sales Manager

Purpose

Increase conversion rate.

Responsibilities

Lead Qualification

Sales Scoring

Objection Analysis

Offer Suggestions

Sales Forecast

Revenue Prediction

Playbook Improvement

Authority

Never changes prices automatically.

Can recommend discounts.

Can recommend offers.

---

# AI Support Agent

Purpose

Provide customer support.

Responsibilities

Answer questions

Detect customer intent

Handle complaints

Escalate difficult conversations

Generate tickets

Knowledge retrieval

Authority

Cannot promise unavailable services.

Cannot change company policies.

Always follows Company Knowledge.

---

# AI Reservation Manager

Purpose

Manage reservations.

Responsibilities

Reservation Creation

Availability Checking

Calendar Management

Reminder Scheduling

Cancellation Prediction

Waiting List Management

Authority

Create reservations

Update reservations

Never delete completed reservations.

---

# AI Finance Analyst

Purpose

Analyze financial health.

Responsibilities

Revenue Reports

Expense Reports

Profit Analysis

Cash Flow

Campaign ROI

Customer Lifetime Value

Monthly Summary

Authority

Read only.

Never executes payments.

Never modifies invoices.

---

# AI Automation Manager

Purpose

Control all automations.

Responsibilities

Automation Rules

Workflow Execution

Retry Failed Jobs

Automation Monitoring

Cron Jobs

Worker Monitoring

Authority

Enable Automation

Disable Automation

Retry

Pause

Resume

---

# AI Knowledge Manager

Purpose

Maintain company knowledge.

Responsibilities

Knowledge Base

Policies

Packages

FAQ

Uploaded Documents

Internal Procedures

Knowledge Versioning

Authority

Create Articles

Update Articles

Archive Old Articles

Never permanently delete.

---

# AI Memory Manager

Purpose

Maintain memory quality.

Responsibilities

Merge Duplicate Memories

Compress Memories

Archive Low Value Memories

Prioritize Important Memories

Generate Embeddings

Optimize Retrieval

Authority

Internal only.

---

# AI Learning Manager

Purpose

Continuously improve the system.

Responsibilities

Analyze Results

Generate Playbooks

Improve Prompts

Detect Patterns

Update Confidence Scores

Measure Success

Authority

Cannot directly change production rules.

Requires validation.

---

# AI Reporting Agent

Purpose

Generate reports.

Reports

Daily

Weekly

Monthly

Quarterly

Yearly

Marketing

Sales

CRM

Reservations

Financial

Executive

Authority

Read Only.

---

# AI Notification Agent

Purpose

Deliver notifications.

Channels

Dashboard

Email

WhatsApp

Messenger

Instagram

Push

Slack (Future)

Authority

Uses Notification Service only.

---

# Agent Collaboration

Example

Customer sends Instagram DM

↓

Support Agent

↓

CRM Agent

↓

Sales Agent

↓

Reservation Agent

↓

Learning Agent

↓

Memory Manager

↓

AI CEO receives KPI update

---

# Agent Priority

Highest

AI Core

↓

CEO

↓

Marketing

↓

CRM

↓

Sales

↓

Reservations

↓

Support

↓

Reporting

↓

Learning

↓

Memory

---

# Conflict Resolution

If two agents disagree

↓

AI Core compares

Confidence

Business Rules

Historical Success

Company Policies

↓

Best decision wins.

---

# Agent Permissions

Every agent has

Allowed Modules

Allowed Actions

Allowed Tools

Allowed Data

Maximum Risk Level

Automation Permission

Human Approval Level

---

# Logging

Every agent execution stores

Agent Name

Task

Input

Output

Reason

Confidence

Execution Time

Cost

Related Memories

Related Playbooks

Tools Used

Errors

---

# Learning Loop

Execute

↓

Measure

↓

Compare

↓

Learn

↓

Store

↓

Improve

↓

Repeat

Every successful action strengthens future decisions.

Every failed action becomes a learning opportunity.

---

# Future Agents

AI HR Manager

AI Recruitment Agent

AI Legal Assistant

AI Inventory Manager

AI Logistics Manager

AI Voice Agent

AI Video Creator

AI SEO Manager

AI Content Strategist

AI Social Media Manager

AI Customer Success Manager

The architecture must support unlimited future agents without redesign.

---

# Uygulama Durumu (2026-07-18)

Vizyondaki "agent" kavramı bugün otonom ajanlar olarak değil, alan bazlı
AI servisleri olarak uygulanmıştır (çelişkide kod esas alınır):

- **AI CEO** → `src/features/ceo-intelligence/` (günlük rapor, metrikler,
  riskler, öneriler, soru-cevap asistanı; görev tipi `ceo_intelligence`,
  REASONING katmanı).
- **AI Sales / Support** → `src/features/ai/services/simple-assistant.service.ts`
  (DM cevabı, FAST katmanı) + `smart-sales`, `sales-learning`.
- **AI Marketing Director** → `src/features/marketing/` (Meta senkron,
  attribution, günlük pazarlama raporu, strateji önerileri).
- **AI Reservation Manager** → `src/features/reservations/ai-reservation-flow`
  + `follow-ups`, `reminders` cron'ları.
- **AI Finance** → `src/features/payments/` (dekont görsel analizi, `vision`
  görevi) — tam gelir/gider analizi yok.
- **Uygulanmadı**: Task Planner ile çok-ajanlı koordinasyon, ajanlar arası
  mesajlaşma, sınırsız ajan kaydı (agent registry). Tüm servisler ortak
  Model Router + Approval + ai_runs altyapısını kullanır (docs/41).

---

End of Document