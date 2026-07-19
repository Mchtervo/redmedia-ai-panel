# Deployment

# Redmedia AI Growth OS

Version 1.0

---

# Purpose

Define deployment strategy for development, staging and production.

---

# Environments

Development

Staging

Production

---

# Infrastructure

Frontend

Next.js

Backend

Supabase

Edge Functions

Redis

Storage

CDN

---

# CI/CD

GitHub

Automatic Build

Tests

Deploy

Rollback

---

# Monitoring

Logs

Metrics

Errors

Performance

Uptime

---

# Backup

Daily Database Backup

Storage Backup

Configuration Backup

---

# Disaster Recovery

Restore Database

Restore Storage

Rollback Deployment

---

# Security

HTTPS

Secrets Management

Environment Variables

Firewall

---

# Uygulama Durumu (2026-07-18)

- **Mevcut**: Next.js (App Router) + Supabase; environment doğrulaması
  startup'ta `src/instrumentation.ts` → `src/lib/env.ts` (zorunlu değişken
  eksikse süreç başlamaz — docs/45). Sırlar yalnız `.env.local` / hosting
  env ayarlarında; `.env*` git'e gitmez.
- **Cron işleri** (hosting zamanlayıcısına bağlanmalı, Bearer `CRON_SECRET`):
  `/api/cron/ceo-daily-report`, `/api/cron/marketing-daily-report`,
  `/api/cron/meta-sync`, `/api/cron/conversation-learning`,
  `/api/cron/follow-ups`, `/api/cron/reminders`, `/api/cron/ai-weekly-report`,
  `/api/cron/chatplace-sync` (artımlı ChatPlace senkronu — docs/44).
- **Uygulanmadı**: Redis, Edge Functions, ayrı staging ortamı, otomatik
  yedekleme yapılandırması (Supabase yönetilen yedekleri kullanılır).

# Success Criteria

Deployments should be automated, repeatable and recoverable with minimal downtime.

---

End of Document
