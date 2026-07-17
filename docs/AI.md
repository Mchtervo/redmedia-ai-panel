# Yapay Zekâ (AI) Modülü

> **Durum:** Redmedia satış asistanı (OpenAI) bağlandı. Gelen mesaj +
> müşteri profili + son konuşma özeti prompta dahil. RAG / knowledge
> henüz yok.

## Amaç

AI modülü, müşteri konuşmalarına (ChatPlace üzerinden) destek olmak ve Meta
reklam performansı üzerinde analiz/öneri üretmek için kullanılır.

## Davranış Sözleşmesi

Aşağıdaki kurallar tüm AI özellikleri için zorunludur (bkz.
`.cursor/rules/04-ai-behavior.mdc` — bu belge ile birebir uyumludur):

1. **Fiyat uydurmaz.** Fiyat bilgisi yalnızca Supabase'deki doğrulanmış
   kaynak veriden gelir (v1'de kaynak bağlı değil; prompt fiyat uydurmayı yasaklar).
2. **Var olmayan hizmeti sunmaz.** Hizmet listesi kaynak veriyle sınırlıdır.
3. **İnsan onayı gerektiren durumlar:** şikâyet, indirim, iptal, özel fiyat.
   Bu durumlarda AI nihai cevabı/işlemi kendi başına yapmaz.
4. **Her cevap loglanır.** Girdi, çıktı, model, zaman damgası, ilgili
   müşteri/konuşma referansı Supabase'de tutulur (`ai_runs`).
5. **Kaynağa dayanır (grounding).** AI, Redmedia'nın işletme bilgisi
   (hizmetler, fiyatlar, politikalar) dışına çıkarak bilgi üretmez.
6. **Müşteri hafızası Supabase'de saklanır.** Geçici/bellek-içi bir çözüm
   kullanılmaz. AI, `contacts` + son `messages` kayıtlarını bağlam olarak okur.

## v1 — Redmedia Satış Asistanı

**Akış:** ChatPlace webhook → `ingestInboundMessage` → OpenAI (profil +
konuşma özeti + gelen mesaj) → `ai_runs` + `messages` (`sender_type=ai`) →
HTTP `data.reply`.

ChatPlace tarafında `data.reply` **Yanıt eşleme** ile bir değişkene map edilir;
sonraki **Mesaj** bloğu Instagram DM'e yazar (bkz. `docs/CHATPLACE.md`).

### Satış davranışı (özet)

- Türkçe, 1–3 kısa cümle; ilk temasta tebrik → düğün/nişan → tarih → mekân.
- Şehir daima Ankara; paketler çiftin isteğine göre birlikte kurulur.
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

Anahtar yoksa veya auto-reply kapalıysa webhook eski gibi yalnızca ingest yapar
(`reply` dönmez).

### İnsan onayı (v1 basit)

Anahtar kelime ile `requires_human_approval` işaretlenir (şikâyet/indirim/iptal/
özel fiyat). Prompt da bu durumlarda ekibe yönlendirme ister. Tam karar katmanı
ve personel atama otomasyonu sonraki fazda.

## AI'nin Devreye Girdiği Nokta

1. Mesaj `messages` tablosuna yazıldıktan sonra (duplicate değilse).
2. OpenAI cevap üretir; `ai_runs` loglanır.
3. Cevap `messages`'a `sender_type=ai` olarak yazılır.
4. Aynı metin webhook HTTP cevabında `data.reply` olarak ChatPlace'e döner.

## `ai_runs`

- Yazma: `features/ai/repositories/ai-runs.repository.ts`
- Okuma: konuşma detayında `listAiRunsForConversation` (Inbox AI Geçmişi)

## Kapsam Dışı (v1 — sonraki faz)

- RAG / `knowledge_documents` / `knowledge_chunks` grounding
- Kalıcı konuşma özeti tablosu (`conversation_summaries`) üretimi
- Gelişmiş sınıflandırma ve otomatik personel atama
- Meta reklam analizi AI
- Panelden personel mesajının ChatPlace'e gönderilmesi
