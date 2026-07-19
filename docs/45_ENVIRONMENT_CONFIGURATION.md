# 45 — Environment Yapılandırması

Sürüm 1.0 · Son güncelleme: 2026-07-18

Bu doküman yalnızca değişken **adlarını** içerir; gerçek değerler asla
dokümana, rapora veya git'e yazılmaz. Gerçek değerlerin tek yeri
`.env.local`'dir (`.gitignore` ile `.env*` hariç `.env.example` korunur).

---

## Doğrulama

- Modül: `src/lib/env.ts` (Zod şeması + güvenlik denetimleri).
- Startup: `src/instrumentation.ts` → `assertServerEnv()` — zorunlu değişken
  eksik/geçersizse sunucu **net bir hata ile başlamaz**.
- `NEXT_PUBLIC_` öneki taşıyan ve adında SECRET/API_KEY/TOKEN/SERVICE_ROLE
  geçen dolu değişkenler **hata** sayılır (sır istemciye açılamaz).
- Deprecated değişkenler development'ta uyarı üretir, hata üretmez.
- Testler: `npm run test:env`.

## Zorunlu değişkenler (uygulama bunlarsız başlamaz)

| Değişken | Açıklama |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL'i (istemciye açık, sır değil) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (istemciye açık, RLS ile korunur) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yalnız sunucu; asla istemciye/loga gitmez |

## OpenAI / AI Model Router (opsiyonel — boşsa AI özellikleri kapanır)

| Değişken | Katman / Görevler |
| --- | --- |
| `OPENAI_API_KEY` | Tüm AI özellikleri için gerekli |
| `OPENAI_MODEL_FAST` | Kısa DM/yorum cevabı, sınıflandırma, etiket, bildirim metni, kısa özet |
| `OPENAI_MODEL_DEFAULT` | CRM, rezervasyon, müşteri özeti, standart satış cevabı, e-posta taslağı, akış kararları, görsel (dekont) analizi |
| `OPENAI_MODEL_REASONING` | CEO Intelligence, pazarlama/satış stratejisi, kampanya analizi, çok adımlı öneriler |
| `OPENAI_MODEL_COMPLEX` | Derin teknik analiz (mimari, veritabanı, güvenlik, migrasyon planlama) |
| `OPENAI_MODEL_EMBEDDING` | RAG, bilgi parçaları, anlamsal arama (varsayılan `text-embedding-3-small`) |
| `AI_AUTO_REPLY_ENABLED` | `true` ise gelen DM'lere otomatik AI cevabı |

Fallback zinciri (bkz. `src/lib/ai/model-router.ts`):

```
FAST      → DEFAULT → sabit güvenli varsayılan (gpt-4o-mini)
DEFAULT   → (deprecated: BALANCED → OPENAI_MODEL) → sabit varsayılan
REASONING → DEFAULT → sabit varsayılan
COMPLEX   → REASONING → DEFAULT → sabit varsayılan
```

Model adları biçim olarak doğrulanır; geçersiz ad **yok sayılır** ve güvenli
varsayılana düşülür (sessiz varsayım yok, dev'de uyarı basılır). Çağrı
seviyesinde birincil model hata verirse fallback modeli bir kez denenir;
SDK seviyesinde 60 sn timeout + 2 retry uygulanır.

## Deprecated (geçiş dönemi; kod hâlâ okur, dev'de uyarı verir)

| Eski | Yenisi |
| --- | --- |
| `OPENAI_MODEL` | `OPENAI_MODEL_DEFAULT` |
| `OPENAI_MODEL_BALANCED` | `OPENAI_MODEL_DEFAULT` |
| `OPENAI_MODEL_VISION` | Görsel görevler DEFAULT katmanını kullanır; tanımlıysa override edilir |

Tüm servisler yeni değişkenlere taşındıktan ve `.env.local` güncellendikten
sonra bu üçü koddan kaldırılabilir.

## ChatPlace

| Değişken | Zorunluluk | Açıklama |
| --- | --- | --- |
| `CHATPLACE_API_KEY` | MCP senkronu için | Bearer token (docs/44) |
| `CHATPLACE_MCP_URL` | MCP senkronu için | `https://mcp.chatplace.io/mcp` |
| `CHATPLACE_WEBHOOK_SECRET` | Opsiyonel | Yalnız inbound webhook HMAC |
| `CHATPLACE_WEBHOOK_TOKEN` | Opsiyonel | Yalnız inbound webhook statik token |

## Cron

| Değişken | Açıklama |
| --- | --- |
| `CRON_SECRET` | Tüm `/api/cron/*` uçları `Authorization: Bearer` ile doğrular; yoksa uçlar 503 döner (fail-closed) |

Cron uçları: `ceo-daily-report`, `marketing-daily-report`, `meta-sync`,
`conversation-learning`, `follow-ups`, `reminders`, `ai-weekly-report`,
`chatplace-sync`.

## Meta / Marketing

| Değişken | Açıklama |
| --- | --- |
| `META_APP_ID`, `META_APP_SECRET` | OAuth uygulaması |
| `META_BUSINESS_ID`, `META_AD_ACCOUNT_ID`, `META_PAGE_ID`, `META_INSTAGRAM_ACCOUNT_ID`, `META_PIXEL_ID` | Varlık kimlikleri |
| `META_CAPI_ACCESS_TOKEN`, `META_CAPI_TEST_EVENT_CODE`, `META_CAPI_EVENT_SOURCE_URL` | Conversions API |
| `META_GRAPH_API_VERSION` | Varsayılan sürümü override eder |
| `META_OAUTH_REDIRECT_URI`, `META_OAUTH_STATE_SECRET` | OAuth akışı |
| `SITE_URL` | CAPI event_source_url fallback |

**`META_ACCESS_TOKEN` kullanılmaz** — erişim token'ı OAuth ile
`meta_oauth_tokens` tablosunda tutulur.

## Diğer

| Değişken | Açıklama |
| --- | --- |
| `AUTO_CONFIRM_HIGH_CONFIDENCE_RECEIPTS` | Dekont yüksek güven otomatik onayı (varsayılan kapalı) |

## Güvenlik kuralları

1. Sır değerleri yalnız `.env.local` (yerel) / hosting env ayarları (prod).
2. `NEXT_PUBLIC_` önekli değişkenlere asla sır yazılmaz — `env.ts` bunu
   startup hatasına çevirir.
3. Loglara/raporlara/dokümana yalnız değişken **adı** yazılır.
4. Service role / OpenAI / Meta / ChatPlace anahtarları yalnız Server
   Component, Route Handler, Server Action ve `src/server/**` içinde okunur.

## Denetim sonucu (2026-07-18)

- Kodda kullanılan ama `.env.example`'da eksik olan değişkenler eklendi.
- `.env.example`'daki `OPENAI_MODEL`, `OPENAI_MODEL_BALANCED`,
  `OPENAI_MODEL_VISION` deprecated olarak işaretlendi.
- `.env.local` ile kod arasında ad çakışması kalmadı
  (`OPENAI_MODEL_DEFAULT/COMPLEX` artık kod tarafından okunuyor).
- `OPENAI_MODEL_ROUTER_ENABLED` hiçbir kodda kullanılmıyor —
  `.env.local`'den silinebilir (router her zaman etkin).
- `NEXT_PUBLIC_` ile sızdırılmış sır bulunamadı.
- `.gitignore` `.env*` dosyalarını kapsıyor (`.env.example` hariç) — doğru.
