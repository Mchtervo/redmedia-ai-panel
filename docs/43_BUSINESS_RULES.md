# 43_BUSINESS_RULES.md

# Redmedia AI Growth OS

Version 1.0

---

# Purpose

This document defines the central business rules that must be followed across all modules of Redmedia AI Growth OS.

These rules are independent from UI implementation and must be enforced by APIs, background workers, automations and AI agents.

---

# 1. Company and Tenant Rules

- Every business record must belong to a company.
- Users may only access companies they are assigned to.
- Company data must never be mixed between tenants.
- Company-specific settings override platform defaults.
- Deleted companies must be soft-deleted before permanent removal.

---

# 2. User and Role Rules

Supported roles may include:

- Super Admin
- Company Owner
- Admin
- Manager
- Sales Representative
- Marketing Specialist
- Reservation Staff
- Finance Staff
- Support Staff
- Viewer

Rules:

- Every user must have at least one role.
- Sensitive actions require explicit permission.
- Role checks must be enforced on the server.
- Users must not approve their own restricted financial actions when dual approval is enabled.
- Permission changes must be logged.

---

# 3. CRM Rules

## Lead Lifecycle

Recommended statuses:

- New
- Contacted
- Qualified
- Proposal
- Negotiation
- Won
- Lost
- Archived

Rules:

- Every lead must have a source.
- Every lead should have an assigned owner.
- Lost leads should include a loss reason.
- Won leads should create or update a customer record.
- Duplicate leads should be merged or linked.
- Lead status changes must be written to the activity timeline.
- AI may suggest status changes but must follow approval rules.

---

# 4. Customer Rules

- Each customer must have a unique internal ID.
- Phone and email fields should be normalized.
- Duplicate detection must use configurable matching rules.
- Customer history must include messages, reservations, payments, notes and activities.
- Sensitive personal data must only be visible to authorized roles.
- Deleting a customer must follow data retention rules.

---

# 5. Reservation Rules

Recommended statuses:

- Draft
- Pending
- Confirmed
- In Progress
- Completed
- Cancelled
- No Show

Rules:

- A reservation must include a customer, service, date and responsible company.
- Conflicting reservations must be blocked or explicitly approved.
- Capacity and staff availability must be checked before confirmation.
- Reservation changes must be logged.
- Customers must receive confirmation based on notification settings.
- Cancellation reason must be saved.
- Refund rules must be evaluated before payment reversal.
- AI may prepare or suggest a reservation but may not bypass availability checks.

---

# 6. Pricing and Discount Rules

- Prices must be stored with currency.
- Taxes must be calculated using the active company configuration.
- Discounts must have a type, amount and reason.
- Percentage discounts must not exceed configured limits.
- Manual discounts above the approval threshold require manager approval.
- Final totals must be calculated on the server.
- Historical invoices and reservations must preserve the price used at the time.

---

# 7. Payment and Billing Rules

Recommended payment statuses:

- Pending
- Partially Paid
- Paid
- Failed
- Refunded
- Cancelled

Rules:

- Payment transactions must be immutable.
- Corrections should be created as new adjustment records.
- Refunds must reference the original payment.
- Failed payments must trigger retry or notification workflows.
- Billing actions must be logged.
- Financial reports must use finalized transaction records.
- AI may explain financial data but must not create irreversible transactions without permission.

---

# 8. Marketing Rules

- Every campaign must belong to a company and channel.
- Campaigns should include objective, audience, budget and date range.
- Spend limits must be enforced.
- Automated budget changes must respect approval thresholds.
- Creatives must have version history.
- Campaign performance data must be synchronized from the source platform.
- AI recommendations must clearly separate suggestions from executed changes.
- Restricted claims or misleading advertising must not be generated.

---

# 9. Meta Ads Rules

- Meta account access tokens must be encrypted.
- Campaign, ad set and ad identifiers must be stored.
- Sync jobs must be idempotent.
- Duplicate campaign creation must be prevented.
- Budget increases above the configured limit require approval.
- Pausing or deleting campaigns must require explicit authorization.
- AI may optimize within the allowed automation policy.
- All Meta changes must be recorded in the audit log.

---

# 10. Instagram and Messaging Rules

- New messages must be linked to a customer or lead when possible.
- Message threads must preserve channel and external IDs.
- Automated replies must respect business hours and automation settings.
- AI must not request unnecessary sensitive information.
- Price, payment and legal commitments may require human approval.
- Opt-out requests must be respected immediately.
- Message sending failures must be retried safely.
- Duplicate replies must be prevented.

---

# 11. AI Automation Rules

AI operating modes:

- Suggest Only
- Approval Required
- Limited Autonomy
- Full Autonomy

Rules:

- Every AI action must have a company context.
- AI must check permissions before using tools.
- High-risk actions require approval.
- AI must not invent customer, financial or reservation data.
- AI must use connected source data when available.
- Tool calls and final outcomes must be logged.
- Failed AI actions must not be silently ignored.
- AI confidence thresholds should determine escalation.
- Human override must always be available.
- Autonomous actions must follow configurable daily limits.

---

# 12. AI Approval Rules

Actions that may require approval:

- Sending price offers
- Publishing ads
- Increasing ad budgets
- Refunding payments
- Deleting records
- Sending bulk messages
- Changing reservation dates
- Creating legal or contractual commitments
- Editing critical company settings

Approval records must include:

- Requested action
- Requesting agent or user
- Approver
- Time
- Decision
- Optional reason

---

# 13. Workflow and Automation Rules

- Every workflow must have a trigger.
- Workflow execution must be idempotent.
- Failed steps must follow retry rules.
- Maximum retry counts must be configurable.
- Workflows must prevent infinite loops.
- Every execution must have a trace ID.
- Manual re-run must be supported for authorized users.
- Critical workflows must support fallback actions.
- Disabled workflows must not accept new executions.

---

# 14. Notification Rules

Supported channels may include:

- In-app
- Email
- SMS
- WhatsApp
- Push Notification

Rules:

- Users must be able to configure non-critical notification preferences.
- Critical security notifications cannot be disabled.
- Duplicate notifications should be grouped or suppressed.
- Notification failures should be logged.
- Scheduled notifications must respect timezone.
- Customer notifications must respect consent and opt-out settings.

---

# 15. Data Ownership Rules

- Company data belongs to the relevant company.
- Platform operators may only access customer data for authorized support or system operations.
- Exported data must respect permissions.
- Cross-company reporting must only be available to authorized platform roles.
- Data transfers must be logged when legally or operationally required.

---

# 16. Data Retention and Deletion Rules

- Soft deletion should be used for recoverable business records.
- Permanent deletion must require elevated permission.
- Audit logs should be retained according to policy.
- Financial records must follow legal retention requirements.
- Personal data deletion requests must be processed without deleting records that must legally remain.
- Backups must follow the same retention policy.

---

# 17. File Rules

- Every file must have an owner and company.
- File type and size must be validated.
- Private files must use signed access URLs.
- Malware scanning should be used where possible.
- Deleted files must follow retention rules.
- Files connected to invoices, reservations or contracts must preserve version history where required.

---

# 18. Reporting Rules

- Reports must use company timezone.
- Financial reports must use finalized values.
- Dashboard metrics must define their calculation method.
- Historical reports must not change because of later configuration changes.
- AI-generated insights must identify the data period used.
- Missing or delayed source data must be shown clearly.

---

# 19. Audit Log Rules

The following actions must be logged:

- Login and failed login
- Permission changes
- Financial actions
- Reservation changes
- AI tool calls
- Campaign changes
- Data exports
- Record deletion
- Integration connection changes
- System configuration changes

Audit logs must include:

- User or agent
- Company
- Action
- Entity
- Before and after data when applicable
- Timestamp
- IP or request metadata when available
- Correlation ID

---

# 20. Integration Rules

- Credentials must be encrypted.
- Token refresh must be handled automatically where supported.
- Webhook signatures must be verified.
- External events must be processed idempotently.
- API rate limits must be respected.
- Integration failures must trigger alerts.
- Disconnected integrations must stop dependent automations safely.
- External IDs must be stored for synchronization.

---

# 21. Error and Recovery Rules

- User-facing errors must be understandable.
- Sensitive system details must not be exposed.
- Recoverable errors should retry automatically.
- Irreversible operations must not retry blindly.
- Partial failures must be recorded.
- Critical failures must alert administrators.
- Every background job must have a final status.

---

# 22. Security Rules

- Authentication is required for private resources.
- Authorization must be checked server-side.
- Secrets must never be stored in frontend code.
- Sensitive values must be encrypted.
- Rate limiting must protect public endpoints.
- Suspicious activity must be logged.
- Session expiration must be configurable.
- Multi-factor authentication should be available for privileged accounts.

---

# 23. Business Rule Priority

When rules conflict, use this priority:

1. Legal and security requirements
2. Company-specific mandatory rules
3. Financial and permission rules
4. Module business rules
5. Automation preferences
6. User interface preferences

---

# 24. Rule Configuration

Rules should be configurable where appropriate:

- Approval limits
- Discount limits
- Automation mode
- Messaging hours
- Notification channels
- Reservation capacity
- Cancellation policy
- Data retention period
- AI confidence threshold
- Daily autonomous action limits

Critical security rules must not be disabled by normal company users.

---

# 25. Success Criteria

The system is compliant with this specification when:

- Business decisions are enforced consistently across UI, API and workers.
- AI agents cannot bypass permissions or approval limits.
- Financial and reservation actions are auditable.
- Automations are safe, idempotent and recoverable.
- Company data remains isolated.
- Users can understand why important actions occurred.

---

# Uygulama Durumu (2026-07-18)

- **Uygulandı**: AI fiyat uyduramaz (fiyatlar yalnız Supabase kataloğundan —
  `src/features/pricing/`); şikâyet/indirim/iptal/özel fiyat talepleri
  insan onayına düşer (Approval Engine, `requires_human_approval`);
  her AI cevabı `ai_runs`'a loglanır; rezervasyon/dekont akışı onay
  kurallarına bağlıdır; otomasyonlar idempotent tekrar korumalıdır;
  webhook doğrulaması fail-closed'dur. Confidence eşikleri
  `src/lib/ai/confidence.ts` ile uygulanır.
- **Uygulanmadı / kapsam dışı**: Çok kiracılılık (§1) ve rol/izin matrisi
  (§2) — uygulama tek işletme, tek yönetici modelidir (bilinçli karar);
  dual approval, veri saklama süresi otomasyonu, company settings
  override mekanizması yok.

---

End of Document
