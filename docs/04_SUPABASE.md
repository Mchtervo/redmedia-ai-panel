# Supabase Architecture

# Redmedia AI Growth OS

Version 1.0

---

# Overview

Supabase is the backend platform powering Redmedia AI Growth OS.

It provides:

- Authentication
- PostgreSQL Database
- Realtime
- Edge Functions
- Object Storage
- Row Level Security
- Database Triggers
- Cron Jobs
- RPC Functions

Supabase is the single source of truth for all business data.

---

# Technology Stack

Backend Database

PostgreSQL

Authentication

Supabase Auth

Storage

Supabase Storage

Realtime

Supabase Realtime

Background Tasks

Edge Functions

Database Extensions

pgvector

pg_cron

uuid-ossp

pgcrypto

---

# Authentication

Supported Providers

Email / Password

Google

Microsoft

Apple (Future)

Magic Link (Optional)

Phone Login (Future)

---

# Authentication Flow

User Login

↓

JWT Created

↓

User Loaded

↓

Company Loaded

↓

Role Loaded

↓

Permissions Loaded

↓

Dashboard Opens

---

# Multi Tenant

Every user belongs to one company.

Every company has isolated data.

Every table contains:

company_id UUID

All queries must automatically filter by company_id.

No cross-company access is allowed.

---

# Row Level Security (RLS)

RLS must be enabled on every business table.

Example Policy

User may only read rows where:

company_id = auth.company_id

User may only update records inside their company.

Admin can manage all company data.

Employees only access permitted modules.

---

# Roles

Super Admin

Platform Owner

Company Owner

Admin

Manager

Marketing

Sales

Support

Employee

Viewer

Each role has granular permissions.

---

# Storage Buckets

avatars

Company logos

documents

contracts

invoices

albums

marketing-images

marketing-videos

customer-files

ai-generated

temporary

Each bucket has separate permissions.

---

# File Rules

Images

jpg

png

webp

Videos

mp4

mov

Documents

pdf

docx

xlsx

Maximum upload size is configurable.

---

# Edge Functions

Edge Functions should handle:

Meta Webhooks

Instagram Webhooks

Messenger Webhooks

AI Processing

Payment Webhooks

OCR Processing

Image Processing

Video Processing

Notification Dispatch

Scheduled Jobs

Heavy API integrations

Never expose secrets to frontend.

---

# Database Triggers

Automatic triggers

Customer Created

↓

Create CRM Timeline

Reservation Created

↓

Generate Notification

Campaign Created

↓

Generate AI Analysis Task

Conversation Finished

↓

Generate Learning Task

Payment Completed

↓

Update Reports

AI Decision Created

↓

Store AI Memory

---

# Cron Jobs

Every 5 Minutes

Sync Meta Ads

Every 10 Minutes

Sync Instagram

Every 15 Minutes

Sync Messenger

Every Hour

Generate KPI Snapshots

Every Night

Memory Optimization

Generate Playbooks

Archive Logs

Refresh Statistics

Cleanup Temporary Files

---

# Realtime

Realtime Events

New Customer

New Lead

Reservation Update

Campaign Status

New Message

AI Finished

Notification

Dashboard Updates

Users should never refresh manually.

---

# PostgreSQL Extensions

uuid-ossp

UUID generation

pgvector

AI embeddings

pg_cron

Scheduled jobs

pgcrypto

Encryption

---

# Vector Database

AI uses pgvector.

Stores

Knowledge Embeddings

Conversation Embeddings

Playbook Embeddings

Company Documents

Marketing Knowledge

Semantic Search

Long-Term Memory

---

# Backup Strategy

Daily Database Backup

Hourly WAL Backup

Weekly Full Snapshot

Monthly Archive

Automatic Restore Testing

Backup Encryption Required

---

# Disaster Recovery

Automatic backups

Multiple restore points

Rollback support

Database migration history

Zero data loss target

---

# API Security

Never expose Service Role Key.

Frontend only uses:

Anon Key

Server uses:

Service Role Key

Edge Functions only.

---

# Environment Variables

NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY

OPENAI_API_KEY

META_APP_ID

META_APP_SECRET

INSTAGRAM_APP_SECRET

RESEND_API_KEY

SENTRY_DSN

All secrets remain server-side.

---

# Database Rules

UUID everywhere.

Soft Delete only.

Audit Logs mandatory.

Indexes on Foreign Keys.

Indexes on company_id.

Indexes on created_at.

Use JSONB only when schema is dynamic.

Avoid duplicated data.

Normalize whenever possible.

---

# Migration Strategy

Every schema update must be versioned.

Migration files stored in Git.

Never edit production schema manually.

All changes pass through migration scripts.

Rollback scripts required.

---

# Monitoring

Track:

Database Size

Connections

Slow Queries

Edge Function Errors

Storage Usage

Realtime Connections

Cron Failures

Webhook Failures

API Errors

AI Queue Size

---

# Performance Rules

Always paginate lists.

Never use SELECT *.

Use indexes.

Cache expensive queries.

Limit realtime subscriptions.

Batch updates when possible.

Avoid N+1 queries.

---

# Future Scalability

Architecture must support:

10 Companies

100 Companies

1,000 Companies

10,000 Companies

Without structural redesign.

---

End of Document