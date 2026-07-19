# Integrations

# Redmedia AI Growth OS

Version 1.0

---

# Purpose

Manage all third-party integrations from a unified architecture.

---

# Categories

## Marketing

- Meta Ads
- Instagram
- Google Ads
- TikTok Ads

## Communication

- WhatsApp
- Email
- SMS

## Payments

- Stripe
- iyzico
- PayTR

## Productivity

- Google Calendar
- Google Drive
- Slack
- Discord

## AI

- OpenAI
- Anthropic
- Gemini

---

# Integration Lifecycle

Connect

↓

Authenticate

↓

Validate

↓

Sync

↓

Monitor

↓

Reconnect

---

# Monitoring

- Status
- Sync Health
- Last Sync
- Errors
- API Usage

---

# Uygulama Durumu (2026-07-18)

Gerçekte bağlı entegrasyonlar:

- **Meta (Ads + Instagram)**: OAuth (`/api/meta/oauth/*`), token'lar
  `meta_oauth_tokens` tablosunda; senkron servisleri
  `src/features/marketing/services/meta/`; günlük cron `/api/cron/meta-sync`;
  sonuçlar `marketing_sync_logs`'a yazılır.
- **ChatPlace**: (1) inbound webhook `/api/chatplace/webhook` (HMAC veya
  statik token, fail-closed); (2) MCP salt okuma senkronizasyonu
  (`https://mcp.chatplace.io/mcp`, Bearer `CHATPLACE_API_KEY`) — mimari,
  araç listesi ve sınırlamalar için bkz. **docs/44**.
- **OpenAI**: tek sağlayıcı; Model Router üzerinden (docs/41, docs/45).
- **Uygulanmadı**: Google Ads, TikTok, WhatsApp, e-posta/SMS, Stripe/iyzico/
  PayTR, Google Calendar/Drive, Slack/Discord, Anthropic/Gemini.

# Success Criteria

Every integration should be modular, fault-tolerant and independently maintainable.

---

End of Document
