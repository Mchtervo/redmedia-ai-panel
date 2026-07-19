# System Architecture

# Redmedia AI Growth OS

Version 1.0

---

# Overview

Redmedia AI is designed as a modular AI-first SaaS platform.

Every module is independent.

Every module communicates through Events.

Every module continuously shares knowledge with the AI Brain.

Nothing should communicate directly if an event-driven approach is possible.

---

# High Level Architecture

                    Web Application
                           │
        ───────────────────┼───────────────────
                           │
                     API Gateway
                           │
        ───────────────────┼───────────────────
                           │
          Authentication & Authorization
                           │
        ───────────────────┼───────────────────
                           │
                Business Services Layer
                           │
────────────────────────────────────────────────────

CRM Service

Reservation Service

Marketing Service

Meta Ads Service

Instagram Service

Messenger Service

Company Knowledge

Automation Engine

Reporting Service

Notification Service

Learning Engine

Memory Engine

AI Brain

────────────────────────────────────────────────────

Each service owns its own logic.

No business logic should exist inside UI components.

---

# Frontend

Technology

Next.js

React

TypeScript

TailwindCSS

Shadcn UI

React Query

Zustand

Framer Motion

---

# Backend

Supabase

PostgreSQL

Edge Functions

Storage

Realtime

Cron Jobs

Authentication

RLS Policies

---

# AI Layer

The AI Layer is independent from business modules.

Modules never generate AI logic themselves.

Everything is routed through AI Core.

---

AI Core

↓

Prompt Engine

↓

Memory Engine

↓

Knowledge Engine

↓

Reasoning Engine

↓

Decision Engine

↓

Response Generator

---

# AI Brain

The AI Brain is responsible for

Learning

Reasoning

Memory

Decision Making

Recommendations

Playbooks

Confidence

Risk Analysis

---

# AI Agents

AI CEO

Responsible for

Business overview

Daily reports

Company growth

KPIs

Risk monitoring

Suggestions

---

AI Marketing Director

Responsible for

Campaign analysis

Creative analysis

Audience analysis

Scaling

Budget optimization

Campaign generation

---

AI Sales Manager

Responsible for

Lead qualification

Pipeline optimization

Sales prediction

Objection handling

Sales playbooks

---

AI CRM Manager

Responsible for

Lead organization

Segmentation

Customer lifecycle

Follow-up planning

Customer health score

---

AI Support Agent

Responsible for

Customer conversations

Automatic replies

Intent detection

Escalation

Ticket creation

---

AI Reservation Manager

Responsible for

Availability

Reservation flow

Reminder automation

Cancellation prediction

---

# Event Driven Architecture

Every important action creates an Event.

Example

Customer Created

↓

Customer Updated

↓

Reservation Created

↓

Reservation Confirmed

↓

Payment Received

↓

Campaign Started

↓

Campaign Finished

↓

Conversation Completed

↓

Playbook Created

↓

Memory Updated

↓

Learning Completed

---

# Event Bus

All services publish events.

All services subscribe to events.

No hard dependency should exist between services.

---

Example

Instagram receives DM

↓

Event Created

↓

CRM receives

↓

Memory receives

↓

Learning receives

↓

AI analyzes

↓

Dashboard updates

---

# Queue System

Long operations never run synchronously.

Examples

Image Analysis

Video Analysis

Campaign Analysis

AI Learning

Large Reports

OCR

Transcriptions

Meta Sync

Instagram Sync

Nightly Learning

All should execute through workers.

---

# Worker Architecture

Dedicated workers

AI Worker

Marketing Worker

CRM Worker

Media Worker

Reporting Worker

Webhook Worker

Notification Worker

Scheduler Worker

Workers should scale independently.

---

# Scheduler

Runs automatically.

Examples

Every 5 Minutes

Sync Meta Ads

Every 15 Minutes

Sync Instagram

Every Hour

Generate Insights

Every Night

Optimize Memory

Generate New Playbooks

Compress Memories

Archive Old Logs

Update Statistics

---

# Memory Layer

Short Term Memory

Stores

Recent conversations

Recent campaigns

Recent customer actions

Expires automatically.

---

Long Term Memory

Stores

Business knowledge

Winning campaigns

Winning conversations

Successful reservations

Playbooks

AI experiences

Never deleted automatically.

---

# Company Knowledge

Static knowledge

Company information

Pricing

Packages

Services

FAQs

Policies

Business Rules

Always available to AI.

---

# Playbook Engine

Whenever AI discovers a successful pattern

↓

Generate Playbook

↓

Validate

↓

Store

↓

Reuse

↓

Improve

---

# Confidence Engine

Every AI output has confidence.

95+

Automatic

80+

Automatic if enabled

60+

Needs approval

Below

Never execute

---

# Risk Engine

Before executing

AI checks

Budget Risk

Customer Risk

Security Risk

Business Risk

Permission

Confidence

History

Only then execute.

---

# Notification System

Email

Push

WhatsApp

Instagram

Messenger

Dashboard

Slack

Future integrations must use Notification Service.

---

# Logging

Every important action must generate logs.

Every AI decision must generate logs.

Every automation must generate logs.

Every API request must generate logs.

---

# Monitoring

System Health

Workers

Queues

Memory Usage

API Usage

AI Cost

Meta API Status

Instagram Status

Webhook Status

Cron Jobs

Realtime Connections

---

# Scalability

Every service must be deployable independently.

Every worker must scale independently.

Every AI agent must run independently.

System must support thousands of companies without architecture changes.

---

End of Document