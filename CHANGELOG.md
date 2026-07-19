# Changelog

## 2026-07-18 — AI yapılandırma + environment + ChatPlace MCP denetimi

Sır değerleri bu dosyaya asla yazılmaz; yalnızca değişken adları geçer.

### Environment denetimi ve doğrulama

- `src/lib/env.ts`: Zod tabanlı environment doğrulama modülü — zorunlu
  Supabase değişkenleri eksikse startup'ta net hata; `NEXT_PUBLIC_` öneki
  ile sır sızdırma tespiti; deprecated değişken uyarıları.
- `src/instrumentation.ts`: Next.js instrumentation hook ile startup
  doğrulaması bağlandı.
- `.env.example` yeniden yazıldı: yeni router değişkenleri
  (`OPENAI_MODEL_FAST/DEFAULT/REASONING/COMPLEX/EMBEDDING`), ChatPlace MCP
  (`CHATPLACE_API_KEY`, `CHATPLACE_MCP_URL`), deprecated bölümü
  (`OPENAI_MODEL`, `OPENAI_MODEL_BALANCED`, `OPENAI_MODEL_VISION`).
- ChatPlace webhook değişkenleri (`CHATPLACE_WEBHOOK_SECRET/TOKEN`)
  **opsiyonel** olarak netleştirildi: yalnız inbound webhook için gerekir,
  MCP salt okuma senkronu için gerekmez; startup'ı bozmaz.

### AI Model Router v2 (docs/41)

- Katmanlar yeniden adlandırıldı: `fast / default / reasoning / complex`
  (+ embedding); görev listesi kullanıcı matrisine göre genişletildi
  (dm_reply, comment_reply, classification, tagging, ... ,
  ceo_intelligence, marketing_strategy, security_analysis vb.).
- Model adları env'den okunur, biçim olarak doğrulanır; geçersiz ad
  yok sayılır ve dev'de uyarı basılır (sessiz varsayım yok).
- Fallback zinciri: katman → DEFAULT → sabit güvenli varsayılan;
  COMPLEX → REASONING → DEFAULT. Deprecated `OPENAI_MODEL(_BALANCED/_VISION)`
  geçiş dönemi boyunca fallback olarak okunur, dev'de uyarı üretir.
- `openai-client.ts`: SDK seviyesinde 60 sn timeout + 2 retry; hata
  normalizasyonu (`AiProviderError`: auth/rate_limit/timeout/bad_request);
  auth hatasında fallback denenmez; tahmini maliyet hesabı.
- `insertAiRun` artık `estimated_cost`'u model+token'dan otomatik hesaplar.
- Görev bazlı routing servislerde: CEO asistanı `ceo_intelligence`,
  playbook üretici `sales_strategy` görevine taşındı. Hiçbir feature
  servisi doğrudan `new OpenAI()` çağırmaz (tek istisna: paylaşılan client).

### ChatPlace MCP entegrasyonu (docs/44) — salt okuma

- `src/server/chatplace/mcp-client.ts`: JSON-RPC 2.0 / Streamable HTTP
  istemcisi — Bearer auth, oturum yönetimi, timeout, 429/5xx retry,
  SSE ayrıştırma, hata normalizasyonu; Authorization asla loglanmaz.
- Araç keşfi: 50 araç bulundu (`npm run chatplace:report`).
- `chatplace-sync.service.ts`: idempotent backfill + artımlı senkron —
  `chats_list` (keyset sayfalama) → `chats_get` → `chats_messages`;
  contact/conversation bul-veya-oluştur; orijinal zaman damgası, yön
  (client→inbound/customer, bot→outbound/ai), dış id'ler ve kaynak kanal
  korunur; çift kayıt önleme (dış id + içerik/zaman benzerlik penceresi);
  müşteri zaman çizelgesine senkron özeti; `marketing_sync_logs`'a log.
- Yeni cron: `GET /api/cron/chatplace-sync` (Bearer `CRON_SECRET`,
  `?mode=backfill` destekli). Manuel backfill: `npm run chatplace:backfill`.
- Doğrulama: 5 chat testinde 120 mesaj içe alındı; ikinci çalıştırma
  0 içe aktarma / 122 atlama (tam idempotent).
- Yazma yok: mesaj gönderme / ChatPlace kaydı değiştirme uygulanmadı.

### Dokümantasyon

- Yeni: `docs/44_CHATPLACE_MCP_INTEGRATION.md`,
  `docs/45_ENVIRONMENT_CONFIGURATION.md`,
  `docs/46_IMPLEMENTATION_COMPLIANCE_REPORT.md`.
- Güncellenen: 05, 06, 07, 16, 20, 28, 29, 31, 34, 41 (yeniden yazıldı),
  42, 43 — her birine gerçek uygulamayı anlatan "Uygulama Durumu" bölümü.

### Testler

- Yeni: `test:env` (10), `test:router` (14), `test:chatplace` (18).
- Tüm süitler: 124 test / 0 hata; `tsc`, `eslint`, `next build` temiz.

## 2026-07-18 — UI/UX Yeniden Tasarımı (v2 arayüz)

Panelin tamamı modern, premium, AI-first bir tasarım diline taşındı.
İş mantığı, API route'ları ve veritabanı davranışı değiştirilmedi.

### Tasarım sistemi

- `src/app/globals.css`: yeni renk token'ları — koyu mavi-tonlu nötr zemin,
  Redmedia kızıl (crimson) marka aksanı, anlamsal renkler
  (`--success`, `--warning`, `--info`), chart paleti (`--chart-1..5`),
  `animate-rise` giriş animasyonu, `scrollbar-thin`,
  `prefers-reduced-motion` desteği.
- Yeni paylaşılan bileşenler:
  - `src/components/dashboard/page-header.tsx` — eyebrow + başlık + aksiyonlar
  - `src/components/dashboard/kpi-card.tsx` — KPI kartı (trend oku + sparkline)
  - `src/components/dashboard/section-card.tsx` — bölüm kartı
  - `src/components/dashboard/status-badge.tsx` — anlamsal durum rozeti
  - `src/components/dashboard/empty-state.tsx` — aksiyonlu boş durum (geliştirildi)
- Chart kütüphanesi: `recharts` eklendi. Yeniden kullanılabilir bileşenler:
  - `src/components/charts/trend-chart.tsx` (line / area / bar)
  - `src/components/charts/donut-chart.tsx`
  - `src/components/charts/funnel-chart.tsx` (SSR uyumlu)
  - `src/components/charts/sparkline.tsx` (SSR uyumlu SVG)
  - Ortak tooltip ve tema: `chart-tooltip.tsx`, `chart-theme.ts`

### Uygulama shell'i

- Sidebar 7 mantıksal gruba ayrıldı (Genel Bakış, Satış, Rezervasyon,
  Pazarlama, Yapay Zekâ, Operasyon, Ayarlar); gruplar daraltılabilir ve
  durum localStorage'da saklanır (`src/lib/navigation.ts`,
  `app-sidebar.tsx`).
- Komut paleti eklendi: Ctrl/Cmd+K ile tüm sayfalarda arama + klavye
  navigasyonu (`command-palette.tsx`).
- Topbar yenilendi: yapışkan/yarı saydam; onay kuyruğu ve okunmamış
  bildirim rozetleri canlı sayıyla gösterilir (`app-header.tsx`,
  `dashboard/layout.tsx`).

### Sayfa yeniden tasarımları (gerçek veri, sahte metrik yok)

- **Ana dashboard** (`/dashboard`): ciro trendi, yeni lead grafiği,
  rezervasyon trendi, dönüşüm hunisi, onay kuyruğu / otomasyon sağlığı /
  AI kullanım / bildirim özet kartları, AI model-maliyet tablosu, son
  aktivite zaman çizelgesi. Veri kaynağı:
  `src/features/overview/services/overview.service.ts` (salt okuma).
- **CEO Intelligence** (`/dashboard/ceo`): yönetici komuta merkezi —
  yönetici özeti, KPI'lar, satış/rezervasyon/pazarlama sağlık kartları,
  risk merkezi, öneriler, günlük aksiyonlar, sıcak fırsatlar, paket talep
  dağılımı (donut), rapor arşivi.
- **AI Marketing Director** (`/dashboard/marketing`): KPI kartları,
  günlük harcama ve mesaj/lead trend grafikleri, en iyi / zayıf performans
  listeleri (ROAS-CTR rozetli), yenilenen alt sekme navigasyonu.
  Yeni salt okuma sorgu: `listMarketingDailySeries`.
- **Onay Kuyruğu** (`/dashboard/approvals`): öncelik ve risk rozetleri
  (gerçek alanlardan türetilir), güven skoru çubuğu, kanıt blokları,
  aksiyon tipi filtreleri, toplu onay/red, son kararlar listesi.
- **Otomasyonlar** (`/dashboard/automations`): görsel Tetikleyici → Koşul →
  Aksiyon kural oluşturucu + hazır şablonlar, kural bazlı başarı oranı,
  KPI kartları, durum rozetli çalıştırma geçmişi.
- **Bildirimler** (`/dashboard/notifications`): okunmamış/kategori
  filtreleri, kategori rozetleri, ilişkili kayıt bağlantıları,
  tek/tümünü okundu işaretleme.
- **Intelligence Brief kartı**: güven çubuğu + Türkçe kanıt etiketi ile
  yenilendi (tüm ekranlarda aynı bileşen kullanılıyor).
- Kalan tüm sayfalar yeni layout genişlik/padding sistemine uyarlandı
  (çift padding kaldırıldı); `<html lang="tr">` yapıldı.

### Kalite kontrol

- `npm run build` ✅ · `npm run lint` ✅ · `npx tsc --noEmit` ✅
- Test paketleri: webhooks, ai, reservations, automations, rag ✅
