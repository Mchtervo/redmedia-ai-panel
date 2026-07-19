# 41 — AI Model Router

Sürüm 2.0 · Durum: **Uygulandı** · Son güncelleme: 2026-07-18

Kod: `src/lib/ai/model-router.ts` + `src/lib/ai/openai-client.ts`
Testler: `npm run test:router`

---

## Amaç

Her AI görevi tek bir global modele gitmez; maliyet/kalite profiline göre
bir katmana (tier) eşlenir ve model adları environment üzerinden
yapılandırılır. Modüller OpenAI'ye **yalnızca** `openai-client.ts`
üzerinden çıkar; hiçbir feature servisi doğrudan `new OpenAI()` çağırmaz.

## Katmanlar ve environment değişkenleri

| Katman | Env değişkeni | Görevler |
| --- | --- | --- |
| FAST | `OPENAI_MODEL_FAST` | `dm_reply`, `comment_reply`, `classification`, `tagging`, `notification_copy`, `short_summary` |
| DEFAULT | `OPENAI_MODEL_DEFAULT` | `extraction`, `crm_assist`, `reservation_assist`, `customer_summary`, `email_draft`, `workflow_decision`, `vision` |
| REASONING | `OPENAI_MODEL_REASONING` | `reasoning`, `ceo_intelligence`, `marketing_strategy`, `campaign_analysis`, `sales_strategy`, `recommendation` |
| COMPLEX | `OPENAI_MODEL_COMPLEX` | `architecture_analysis`, `database_analysis`, `security_analysis`, `migration_planning` |
| EMBEDDING | `OPENAI_MODEL_EMBEDDING` | RAG, bilgi parçaları, anlamsal arama (`createEmbeddings`) |

Model adı **sabit kodlanmaz**; hangi OpenAI modelinin kullanılacağı tamamen
environment ile belirlenir. Yapılandırma boşsa sabit güvenli varsayılan
(`gpt-4o-mini`) kullanılır.

## Fallback kuralları

1. **Yapılandırma fallback'i**: katman env'i boşsa → DEFAULT katmanı →
   (deprecated `OPENAI_MODEL_BALANCED` → `OPENAI_MODEL`) → sabit varsayılan.
   COMPLEX boşsa önce REASONING'e düşer.
2. **Çalışma zamanı fallback'i**: birincil model hata verirse fallback modeli
   (katman modeli ≠ default ise default katmanı, aynıysa sabit varsayılan)
   bir kez denenir. Auth hatasında fallback denenmez.
3. **Model adı doğrulaması**: biçimi geçersiz adlar yok sayılır ve dev'de
   uyarı basılır — sessiz varsayım yapılmaz.

## Dayanıklılık ve gözlemlenebilirlik

- SDK seviyesinde 60 sn timeout + 2 otomatik retry.
- Hata normalizasyonu: `AiProviderError` (`auth`, `rate_limit`, `timeout`,
  `bad_request`, `provider`) — sır/ham hata istemciye sızmaz.
- **ai_runs entegrasyonu**: her AI çağrısı `ai_runs` tablosuna görev tipi,
  kullanılan model, token sayıları ve **tahmini maliyet** ile loglanır
  (`insertAiRun` maliyeti `estimateCostUsd` ile tek noktada hesaplar).
  Log kaydı olmadan üretilen cevap müşteriye gönderilmez.
- **Confidence + onay**: güven eşikleri `src/lib/ai/confidence.ts`
  (90+ otomatik, 70+ öneri, 50+ insan onayı, <50 asla); şikâyet/indirim/
  iptal/özel fiyat talepleri `requires_human_approval=true` ile Approval
  Engine kuyruğuna düşer.

## Bilinçli kapsam sınırları (vizyon dokümanından farklar)

- GPT Image, Whisper, ElevenLabs, Claude, Gemini entegrasyonları **yok**;
  tek sağlayıcı OpenAI'dir. İhtiyaç doğarsa ayrı karar gerektirir.
- "Intent Detection → Tool Selection" otonom ajan döngüsü yok; görev tipi
  çağıran servis tarafından bildirilir (deterministik routing).
- Deprecated değişkenler (`OPENAI_MODEL`, `OPENAI_MODEL_BALANCED`,
  `OPENAI_MODEL_VISION`) geçiş dönemi boyunca fallback olarak okunur ve
  dev'de uyarı üretir (bkz. docs/45).
