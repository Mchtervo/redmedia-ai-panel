# features/conversations

**Menü:** Inbox (`/dashboard/inbox`)

**Sahip olduğu tablo(lar):** `conversations`, `messages`, `conversation_summaries`

**İlgili dokümantasyon:** `docs/CHATPLACE.md`

## İç yapı

```
conversations/
  types.ts
  validators/
    list-conversations-query.ts     arama/durum/sayfa parametreleri (Zod)
    send-message.ts                 personel mesaj formu şeması
    ingest-inbound-message.ts       gelecekteki webhook girdi şeması
  repositories/
    conversations.repository.ts     liste, detay, bul-veya-oluştur, durum, atama, last_message_at
    messages.repository.ts          mesaj listesi, tekrar kontrolü, inbound/outbound insert
  services/
    conversations.service.ts        ingestInboundMessage, sendStaffMessage, updateConversationStatus, assignConversation
  actions/
    conversation-actions.ts         Server Action'lar (panelden tetiklenen mutasyonlar)
  components/
    conversation-{status-badge,list-item,list,filters,search-input}.tsx
    inbox-shell.tsx, empty-conversation-panel.tsx
    message-{bubble,thread}.tsx, reply-box.tsx
    conversation-{header,actions-bar}.tsx
```

Rotalar: `src/app/dashboard/inbox/{page,loading,error}.tsx`,
`src/app/dashboard/inbox/[id]/{page,loading,not-found}.tsx`.

Development-only seed: `scripts/seed-conversations.ts` (`npm run seed:conversations`).

**v1 kasıtlı sınırlamalar** (bkz. `docs/CHATPLACE.md`): ChatPlace'e gerçek
API çağrısı yapılmaz (`sendStaffMessage` yalnızca `messages` tablosuna
yazar); gerçek webhook Route Handler'ı henüz yok; `ai_runs` yalnızca
salt-okuma (OpenAI bağlanmadı).
