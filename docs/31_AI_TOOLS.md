# AI Tools

# Redmedia AI Growth OS

Version 1.0

---

# Purpose

The AI Tools layer allows AI Agents to interact with internal modules and external services.

---

# Tool Categories

## Internal

- CRM
- Reservations
- Marketing
- Billing
- Analytics
- Reporting
- File Storage
- Knowledge Base
- Playbooks

## External

- Meta Ads API
- Instagram Graph API
- WhatsApp
- Email
- SMS
- Google Calendar
- Stripe
- iyzico
- Webhooks

---

# Tool Lifecycle

Request

↓

Permission Check

↓

Validation

↓

Execution

↓

Result

↓

Logging

↓

Learning

---

# Tool Selection

AI chooses tools based on

- User Intent
- Available Context
- Permissions
- Cost
- Confidence

---

# Safety Rules

- Company Isolation
- Role Validation
- Input Validation
- Output Validation
- Audit Logging

---

# Monitoring

- Tool Usage
- Latency
- Success Rate
- Error Rate
- AI Confidence

---

# Uygulama Durumu (2026-07-18)

- **Uygulandı (deterministik servisler olarak)**: CRM, rezervasyon,
  pazarlama (Meta Graph API + OAuth), bilgi tabanı, playbook, bildirim,
  onay kuyruğu, otomasyon motoru; ChatPlace MCP salt okuma istemcisi
  (`src/server/chatplace/mcp-client.ts`, docs/44).
- **Farklı**: LLM'in kendi seçtiği "tool calling" yok — hangi servisin
  çağrılacağı kod tarafından belirlenir (deterministik akış). AI, reklam
  bütçesi/durumu değiştiremez; yalnız analiz ve öneri üretir, uygulamalar
  Approval Engine onayından geçer (docs/43 §12).
- **Uygulanmadı**: WhatsApp, SMS, Google Calendar, Stripe/iyzico,
  dosya depolama araçları.

# Success Criteria

Every AI tool must be secure, observable and reusable.

---

End of Document
