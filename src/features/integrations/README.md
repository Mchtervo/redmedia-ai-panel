# features/integrations

**Menü:** Integrations (`/dashboard/integrations`)

**Sahip olduğu tablo(lar):** `integrations`, `webhook_events`

**Güvenlik notu:** Bu tablolarda gerçek API anahtarı/token saklanmaz (bkz.
`.cursor/rules/02-security.mdc`); yalnızca bağlantı durumu ve hassas olmayan
metadata tutulur.

## İç yapı

```
integrations/
  types.ts                                  WebhookEvent, WebhookProvider, WebhookStatus tipleri
  repositories/webhook-events.repository.ts  webhook_events kayıt/işlendi/başarısız
```

`webhook_events` tablosunun sahibi bu feature'dır. ChatPlace webhook akışı
(`app/api/chatplace/webhook/route.ts`) bu repository'yi + conversations
ingest servisini birlikte kullanır (bkz. `docs/CHATPLACE.md`).

Henüz `integrations` tablosu (bağlantı durumu) için kod eklenmedi.
