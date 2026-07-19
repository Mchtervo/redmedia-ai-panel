# API Architecture

# Redmedia AI Growth OS

Version 1.0

---

# Purpose

Defines the communication standards between frontend, backend, AI services and third-party integrations.

---

# API Principles

- REST First
- Modular
- Versioned
- Secure
- Documented
- Scalable

---

# API Versioning

/v1

/v2

Future versions remain backward compatible whenever possible.

---

# Authentication

- JWT
- Refresh Tokens
- OAuth2
- API Keys
- Service Tokens

---

# Core Modules

- Authentication API
- CRM API
- Reservation API
- Marketing API
- AI API
- Automation API
- Notification API
- Analytics API

---

# Response Format

Success

{
  "success": true,
  "data": {},
  "meta": {}
}

Error

{
  "success": false,
  "error": {
    "code": "...",
    "message": "..."
  }
}

---

# Security

- HTTPS Only
- Rate Limiting
- Input Validation
- Audit Logs
- Company Isolation
- RLS Enforcement

---

# Documentation

Every endpoint must include

- Description
- Parameters
- Request Example
- Response Example
- Error Codes
- Permission Requirements

---

# Uygulama Durumu (2026-07-18)

- **Uygulandı**: Zarf formatı `src/types/api.ts` (`ApiResponse<T>`) tüm
  route handler'larda kullanılır. Rate limiting webhook'ta
  (`src/server/rate-limit/`). Zod ile girdi doğrulama. Cron uçları Bearer
  `CRON_SECRET` ile korunur. RLS tüm kullanıcı verisi tablolarında aktif.
- **Farklı**: `/v1` sürümlemesi yok — Next.js App Router route handler'ları
  (`src/app/api/**`) kullanılır; dış tüketici olmadığı için sürümleme
  ertelendi. Kimlik doğrulama Supabase Auth (JWT) iledir; ayrı API key /
  OAuth2 sunucusu yok. Company isolation yok (tek işletme).

# Success Criteria

The API should remain stable, fast, secure and easy to integrate while supporting AI-first workflows.

---

End of Document
