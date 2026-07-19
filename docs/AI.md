# Yapay Zekâ (AI) Modülü

> **Durum:** Redmedia satış asistanı (OpenAI) bağlandı. Gelen mesaj +
> müşteri **CRM profili** (`customer_profiles`) + konuşma özeti + son mesajlar +
> **onaylı knowledge** prompta dahil. Conversation Learning paneli v1 hazır
> (bkz. `docs/LEARNING.md`).

## Amaç

AI modülü, müşteri konuşmalarına (ChatPlace üzerinden) destek olmak ve Meta
reklam performansı üzerinde analiz/öneri üretmek için kullanılır.

## Davranış Sözleşmesi

Aşağıdaki kurallar tüm AI özellikleri için zorunludur (bkz.
`.cursor/rules/04-ai-behavior.mdc` — bu belge ile birebir uyumludur):

1. **Fiyat uydurmaz.** Fiyat bilgisi yalnızca Supabase'deki doğrulanmış
   kaynak veriden gelir (onaylı `knowledge_documents`; pending kayıtlar
   kullanılmaz).
2. **Var olmayan hizmeti sunmaz.** Hizmet listesi kaynak veriyle sınırlıdır.
3. **İnsan onayı gerektiren durumlar:** şikâyet, indirim, iptal, özel fiyat.
   Bu durumlarda AI nihai cevabı/işlemi kendi başına yapmaz.
4. **Her cevap loglanır.** Girdi, çıktı, model, zaman damgası, ilgili
   müşteri/konuşma referansı Supabase'de tutulur (`ai_runs`).
5. **Kaynağa dayanır (grounding).** AI, Redmedia'nın işletme bilgisi
   (hizmetler, fiyatlar, politikalar) dışına çıkarak bilgi üretmez.
6. **Müşteri hafızası Supabase'de saklanır.** `customer_profiles` (CRM Memory)
   her mesajdan sonra güncellenir; AI prompta yalnızca ilgili müşteri
   CRM profili + son mesajlar + özet + onaylı knowledge gider.
   **Tüm geçmiş konuşma gönderilmez**.

## v1 — Redmedia Satış Asistanı

**Akış:** ChatPlace webhook → `ingestInboundMessage` → OpenAI (profil +
özet + son mesajlar + onaylı knowledge + gelen mesaj) → `ai_runs` +
`messages` (`sender_type=ai`) → HTTP `data.reply`.

ChatPlace tarafında `data.reply` **Yanıt eşleme** ile bir değişkene map edilir;
sonraki **Mesaj** bloğu Instagram DM'e yazar (bkz. `docs/CHATPLACE.md`).

### Satış davranışı (özet)

- Türkçe, 1–3 kısa cümle; ilk temasta tebrik → düğün/nişan → tarih → mekân.
- Şehir daima Ankara; paketler çiftin isteğine göre birlikte kurulur.
- "Yarın / haftaya / cumartesi" gibi göreceli tarihler kesin kabul edilmez;
  tam tarih istenir. Emoji yok.
- Fiyat sorulursa önce ihtiyaçları netleştir; telefon yoksa ayrıntılı fiyat /
  rezervasyon yok. Fiyat/müsaitlik/kampanya uydurma yasak.

### Kod

- `src/features/ai/prompts/simple-assistant.ts`
- `src/features/ai/services/simple-assistant.service.ts`
- `src/features/ai/repositories/ai-runs.repository.ts`
- Tetikleme: `src/features/conversations/services/chatplace-webhook.service.ts`

### Ortam değişkenleri

| Değişken | Açıklama |
|---|---|
| `OPENAI_API_KEY` | Zorunlu (sunucu tarafı) |
| `OPENAI_MODEL` | Varsayılan `gpt-4o-mini` |
| `AI_AUTO_REPLY_ENABLED` | `false` ile otomatik cevap kapatılır |
| `CRON_SECRET` | Conversation Learning cron Bearer token |

Anahtar yoksa veya auto-reply kapalıysa webhook eski gibi yalnızca ingest yapar
(`reply` dönmez).

### İnsan onayı (Approval Engine)

Anahtar kelime ile `requires_human_approval` işaretlenir (şikâyet/indirim/iptal/
özel fiyat). Prompt da bu durumlarda ekibe yönlendirme ister. Ek olarak
(docs/43 §12): işaretlenen talep `ai_approvals` tablosuna **pending** kayıt
olarak düşer, panel bildirimi oluşur ve karar `/dashboard/approvals`
ekranında insana bırakılır. Confidence eşikleri `src/lib/ai/confidence.ts`
içindedir (otomatik / öneri / onay gerekli / asla).

### Model Router (docs/41)

Tüm OpenAI çağrıları `src/lib/ai/openai-client.ts` üzerinden yapılır; görev
tipine göre model seçilir (`src/lib/ai/model-router.ts`):

| Görev | Tier | Env |
|---|---|---|
| DM cevabı, sınıflandırma | fast | `OPENAI_MODEL_FAST` |
| Konuşma analizi/extraction | balanced | `OPENAI_MODEL_BALANCED` |
| CEO/strateji/playbook | reasoning | `OPENAI_MODEL_REASONING` |
| Dekont görsel analizi | vision | `OPENAI_MODEL_VISION` |

Env boşsa `OPENAI_MODEL` kullanılır; birincil model hata verirse fallback
model ile tekrar denenir ve `ai_runs.model` gerçek kullanılan modeli tutar.

### Playbook Engine (docs/27)

Kazanan konuşmalardan haftalık cron ile `ai_playbooks` taslakları üretilir;
insan aktifleştirmeden AI promptuna girmez. Panel: `/dashboard/ai-brain`
(Sales Learning dashboard'unda "Playbook'lar" bölümü).

### Automation Engine (docs/14, 32)

`automation_rules` (trigger → condition → action) kuralları
`inbound_message`, `reservation_created`, `deposit_verified` olaylarında
çalışır; aksiyonlar panel bildirimi ve onay talebi ile sınırlıdır (AI bütçe/
durum değiştiremez). Her çalıştırma `automation_runs`'a loglanır. Panel:
`/dashboard/automations`.

## Conversation Learning

Detay: `docs/LEARNING.md`. Özet:

- Konuşma kapanınca veya 24s idle / cron / manuel / import → extraction
- `conversation_analyses` + özet + lead skoru
- Knowledge `pending_review` → panelden Onayla/Reddet/Düzenle
- AI yalnızca `review_status=approved` + `is_active` + kampanya iddiası olmayan
  kayıtları kullanır

Panel: `/dashboard/ai` (AI Öğrenme)

## AI'nin Devreye Girdiği Nokta

1. Mesaj `messages` tablosuna yazıldıktan sonra (duplicate değilse).
2. OpenAI cevap üretir; `ai_runs` loglanır.
3. Cevap `messages`'a `sender_type=ai` olarak yazılır.
4. Aynı metin webhook HTTP cevabında `data.reply` olarak ChatPlace'e döner.

## `ai_runs`

- Yazma: `features/ai/repositories/ai-runs.repository.ts`
- Okuma: konuşma detayında `listAiRunsForConversation` (Inbox AI Geçmişi)

## RAG (docs/29, 30)

- Onaylanan `knowledge_documents`, `knowledge_chunks`'a parçalanıp
  embedding'lenir (`src/features/knowledge/services/rag.service.ts`;
  model: `OPENAI_MODEL_EMBEDDING`, varsayılan `text-embedding-3-small`).
- İndeksleme: onay anında + `conversation-learning` cron'unda backfill.
- Arama: `match_knowledge_chunks` SQL fonksiyonu (cosine, yalnızca
  approved + aktif + kampanya iddiası olmayan dokümanlar).
- Asistan cevap üretirken önce RAG araması yapar; indeks boşsa güncellik
  sıralı onaylı doküman listesine düşer (davranış geriye uyumlu).
- Migration: `20260718000034_knowledge_rag.sql` (canlıya
  `supabase/setup/growth_os_engines.sql` ile uygulanır).

## Kapsam Dışı (sonraki faz)

- Meta reklam analizi AI
- Panelden personel mesajının ChatPlace'e gönderilmesi
