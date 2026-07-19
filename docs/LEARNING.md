# Conversation Learning

## Amaç

Eski müşteri konuşmalarından Redmedia satış dilini, SSS, itirazları ve
başarılı/başarısız cevap kalıplarını çıkarmak. Ham konuşma metni asla
satış asistanı system promptuna basılmaz.

## Veri kaynakları

1. **Supabase** `conversations` + `messages` (webhook ile biriken kayıtlar)
2. **JSON import** — ChatPlace'in kamuya açık history REST API'si yoktur;
   panel `/dashboard/ai` üzerinden export JSON içe aktarır (dedup:
   `external_conversation_id` + `external_message_id`)

## Akış

```
konuşma (kapalı / 24s idle / manuel / import)
  → PII maskele
  → OpenAI structured extraction
  → conversation_analyses + conversation_summaries + lead_profiles
  → knowledge_documents (review_status=pending_review)
  → personel Onayla / Reddet / Düzenle
  → yalnızca approved + is_active AI cevap bağlamına girer
```

## Güvenlik

- Telefon / e-posta / handle maskelenir (`maskPii`)
- Fiyat içeren öneriler `is_pricing_sensitive=true` — otomatik doğru sayılmaz
- Kampanya iddiaları `is_campaign_claim=true` — AI bağlamına alınmaz
- Personel cevabı güvenilmez işaretliyse knowledge önerilmez
- Cron: `Authorization: Bearer CRON_SECRET`

## Endpoint

- `GET /api/cron/conversation-learning` (saatlik, `vercel.json`)

## Kod

- `src/features/learning/`
- `src/features/knowledge/repositories/knowledge-documents.repository.ts`
- Migration: `supabase/migrations/20260717000011_conversation_learning.sql`
