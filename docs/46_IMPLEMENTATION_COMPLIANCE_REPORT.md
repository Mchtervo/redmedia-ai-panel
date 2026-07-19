# 46 — Doküman-Kod Uyum Denetimi Raporu

Denetim tarihi: 2026-07-18 · Kapsam: docs/01–43 (tamamı okundu)

Genel bağlam: Numaralı dokümanlar çok kiracılı (multi-tenant), çalışan/kuyruk
mimarili, çok ajanlı bir "Growth OS" SaaS'ı tarif eder; gerçek kod ise tek
kiracılı (hiçbir tabloda `company_id` yok), tek admin kullanıcılı,
cron + server action tabanlı bir Redmedia panelidir. Bu fark birçok dokümanın
durumunu belirler. Hiçbir doküman, karşılık gelen üretim kodu doğrulanmadan
"Uygulandı" olarak işaretlenmemiştir.

Not: 05, 06, 07, 16, 20, 28, 29, 31, 34, 41, 42, 43 numaralı dokümanlara
2026-07-18'de gerçek uygulamayı anlatan "Uygulama Durumu" bölümleri eklendi
(41 tamamen yeniden yazıldı). Aşağıdaki durumlar **kodun** doküman vizyonuna
göre durumudur.

| No | Doküman | Durum | Gerekçe |
|----|---------|-------|---------|
| 01 | PROJECT_VISION | Kısmen uygulandı | İnsan onayı eşikleri (90/70/50) `src/lib/ai/confidence.ts`'te birebir kodlanmış; playbook (`src/features/playbooks`), onay kuyruğu (`src/features/approvals`) ve öğrenme (`src/features/learning`) mevcut. Otonom "AI çalışan" vizyonu yok; AI yalnızca öneri üretir. |
| 02 | SYSTEM_ARCHITECTURE | Kısmen uygulandı | Modüler servis katmanı `src/features/*` olarak var; ancak event bus, kuyruk, worker, Edge Function, Realtime yok — uzun işler `src/app/api/cron/*` route'larıyla çalışır. Dokümandaki güven eşikleri (95/80/60) koddaki 90/70/50 ile çelişir. |
| 03 | DATABASE | Güncel değil | Gerçek şema (34+ migration) dokümandakinden farklı: `companies/users/roles/permissions/billing/files` tabloları yok, `customers` yerine `contacts`; hiçbir tabloda `company_id` yok (tek kiracı). Soft delete/audit alan standartları uygulanmamış. |
| 04 | SUPABASE | Kısmen uygulandı | Supabase Postgres + Auth + pgvector ve tüm tablolarda RLS kullanılıyor; service role yalnızca sunucuda (`src/server/supabase/admin.ts`). Multi-tenant RLS, Storage, Edge Function ve pg_cron yok. |
| 05 | AI_CORE | Kısmen uygulandı | Merkezî AI katmanı `src/lib/ai/` (model-router, openai-client, confidence) + `ai_runs` loglaması var; grounding kaynak veriyle yapılır. Context Builder→Reasoning→Tool Router zinciri ve ajan koordinasyonu yok; dokümandaki eşikler (95/85/70/50) kodla çelişir. |
| 06 | AI_AGENTS | Kısmen uygulandı | AI CEO (`src/features/ceo-intelligence`), satış asistanı (`src/features/ai`), pazarlama analiz servisleri fiilen birer "ajan" görevi görür; ajan çerçevesi, ajanlar arası iletişim, Finance/Knowledge/Memory Manager ajanları yok. |
| 07 | MEMORY_ENGINE | Kısmen uygulandı | Müşteri hafızası (`customer_profiles`), konuşma özetleri, `sales_learnings`, `marketing_learnings`, `company_personality_traits` var. Kısa vadeli/çalışma hafızası, önem skoru, hafıza sıkıştırma ve hafıza embedding'leri yok. |
| 08 | LEARNING_ENGINE | Kısmen uygulandı | Konuşma öğrenmesi (`src/features/learning` + cron), satış öğrenmesi (`sales_patterns`, `ai_mistakes`, `ai_weekly_reports`) ve playbook üretimi uygulanmış. Prompt A/B öğrenmesi, otomatik güven ayarı ve trend tespiti yok. |
| 09 | MARKETING_AI | Kısmen uygulandı | Metrikler, stratejiler, deneyler, öğrenmeler ve tam attribution zinciri (`customer_attributions`, `attribution_funnel_events`) + günlük pazarlama raporu var. Kreatif skorlama ve bütçe otomasyonu yok (kural gereği bilinçli olarak öneri seviyesinde). |
| 10 | META_ADS_ENGINE | Kısmen uygulandı | Meta OAuth, kampanya/adset/ad/insight senkronu, CAPI servisi ve `meta-sync` cron'u var. Yazma yönü (kampanya oluşturma/bütçe değiştirme), A/B test, lead form senkronu yok; token'lar dokümanın aksine şifrelenmeden saklanıyor. |
| 11 | INSTAGRAM_ENGINE | Kısmen uygulandı | Instagram medya + insight senkronu ve DM'lerin ChatPlace üzerinden CRM'e akışı var. Yorum/story senkronu, viral skor, hashtag zekâsı yok. |
| 12 | CRM_ENGINE | Kısmen uygulandı | `contacts`, müşteri profili, yaşam döngüsü/fırsat skoru/etiket/zaman çizelgesi (`src/features/smart-sales`), lead profilleri ve takip kadansı uygulanmış. Segmentler, duplicate birleştirme, görev yönetimi ve rol bazlı CRM yetkileri yok. |
| 13 | RESERVATION_ENGINE | Uygulandı | Rezervasyon OS geniş biçimde kodlanmış: `src/features/reservations` (AI rezervasyon akışı dahil), müsaitlik/çakışma kontrolü, fiyatlama, kapora/dekont, hatırlatma cron'u ve ekip ataması. Alakasız rezervasyon türleri bilinçli kapsam dışı. |
| 14 | AUTOMATION_ENGINE | Kısmen uygulandı | Trigger–koşul–aksiyon motoru var (`src/features/automations`); ancak sınırlı tetikleyici/aksiyon seti. E-posta/SMS/WhatsApp aksiyonları, zamanlayıcı, branch/wait, retry yok. |
| 15 | NOTIFICATION_ENGINE | Kısmen uygulandı | Yalnızca panel içi bildirim var (`panel_notifications`, okundu takibi dahil). E-posta, SMS, WhatsApp, push, şablon ve tercih yönetimi yok. |
| 16 | API_ARCHITECTURE | Kısmen uygulandı | Standart cevap zarfı (`success/data/error`) tüm route'larda; webhook'ta rate limit var. API versiyonlama (/v1), OAuth2/API key ve API dokümantasyonu yok. |
| 17 | SECURITY | Kısmen uygulandı | RLS her tabloda, service role yalnızca sunucuda, webhook imza doğrulaması ve rate limiting mevcut; env doğrulama + NEXT_PUBLIC sır tespiti eklendi (`src/lib/env.ts`). RBAC, MFA, Meta token şifreleme ve genel audit log yok. |
| 18 | ADMIN_PANEL | Kısmen uygulandı | `src/app/dashboard/*` altında 30+ sayfa var. Şirket/kullanıcı/rol/plan/faturalama yönetimi ve sistem izleme ekranları yok. |
| 19 | UI_UX | Kısmen uygulandı | Tailwind tabanlı tasarım sistemi, gruplu sidebar + komut paleti, grafikler, KPI kartları mevcut (UI/UX v2). Dark mode/tema seçimi ve kanban görünümü yok. |
| 20 | DEPLOYMENT | Uygulanmadı | CI/CD yapılandırması yok (`.github/workflows` yok); staging/prod ayrımı, Redis, CDN, izleme altyapısı yok. Yalnızca cron tanımları var; startup env doğrulaması 2026-07-18'de eklendi. |
| 21 | AUTHENTICATION | Kısmen uygulandı | Supabase Auth e-posta/şifre girişi var; tek admin kullanıcı modeli. Magic link, OAuth, MFA, şifre politikası, giriş audit'i yok. |
| 22 | PERMISSION_SYSTEM | Uygulanmadı | RBAC/izin matrisi yok; `profiles.role` kullanılmayan bir kolon. (Ekip rol ataması yetki sistemi değildir.) |
| 23 | FILE_STORAGE | Uygulanmadı | Supabase Storage entegrasyonu, bucket, imzalı URL yok; dekontlar yalnızca URL referansı olarak işlenir. |
| 24 | BILLING | Uygulanmadı | SaaS aboneliği/fatura/plan tabloları ve Stripe/iyzico entegrasyonu yok. `src/features/payments` müşteri kapora/dekont takibidir. |
| 25 | ANALYTICS | Kısmen uygulandı | Analytics sayfası, grafik bileşenleri, CEO ve pazarlama metrikleri var. Forecasting, cohort, anomali tespiti yok. |
| 26 | REPORTING | Kısmen uygulandı | Günlük CEO raporu, günlük pazarlama raporu ve haftalık AI raporu üretiliyor. PDF/Excel dışa aktarma ve e-posta teslimi yok. |
| 27 | PLAYBOOK_ENGINE | Uygulandı | `ai_playbooks` migration'ı dokümandaki yapıyı karşılıyor (trigger_context, steps, decision_rules, versiyon, draft→active yaşam döngüsü); üretim `playbook-generator.service.ts`, aktivasyon insan onaylı. |
| 28 | PROMPT_ENGINE | Kısmen uygulandı | Prompt'lar modül bazında dosyalarda; model seçimi router üzerinden. Merkezî prompt motoru, versiyonlama/performans takibi ve injection koruması yok. |
| 29 | RAG_ENGINE | Kısmen uygulandı | Çekirdek RAG çalışıyor: chunking + overlap, embedding, `match_knowledge_chunks` RPC; yalnızca onaylı dokümanlar kullanılır. Query rewriting, hybrid search, reranking, citation yok. |
| 30 | VECTOR_SEARCH | Kısmen uygulandı | pgvector + `knowledge_chunks.embedding` + benzerlik RPC'si uygulanmış. Embedding kaynağı yalnızca knowledge dokümanları; metadata filtreleri ve cache yok. |
| 31 | AI_TOOLS | Uygulanmadı | LLM tool-calling / tool registry yok; AI, araç çağırmak yerine önceden derlenen bağlamla tek atışlık cevap üretir. (Deterministik servis katmanı + ChatPlace MCP istemcisi vardır — docs/31 Uygulama Durumu.) |
| 32 | WORKFLOW_ENGINE | Uygulanmadı | Ayrı bir workflow motoru (branch/wait/approval adımları, versiyonlama, trace ID) yok; yalnızca basit trigger–koşul–aksiyon kuralları var. |
| 33 | WEBHOOK_SYSTEM | Uygulanmadı | Doküman dışa giden (outbound) webhook teslimatını tarif eder; kodda yalnızca gelen webhook işleme var (`/api/chatplace/webhook`, `webhook_events`). |
| 34 | INTEGRATIONS | Kısmen uygulandı | Meta (OAuth + senkron), ChatPlace (webhook + MCP salt okuma senkronu — docs/44) ve OpenAI bağlı. WhatsApp, Stripe/iyzico, Google, Slack, Anthropic/Gemini yok. |
| 35 | TESTING | Kısmen uygulandı | Modül bazında birim testleri var (14 test süiti, 124 test — env/router/chatplace dahil). E2E, CI'da otomatik test, coverage hedefi yok. |
| 36 | DEVELOPMENT_GUIDELINES | Kısmen uygulandı | Yığın (Next.js, strict TS, Supabase, Tailwind) ve feature-first yapı birebir uygulanıyor. shadcn/ui kullanılmıyor; branch akışına dair kanıt yok. |
| 37 | CODING_STANDARDS | Uygulandı | Strict TypeScript, ESLint, feature-first düzen, testlerin feature yanında konumu, tutarlı adlandırma doğrulanabilir durumda. |
| 38 | ERROR_HANDLING | Kısmen uygulandı | Standart hata zarfı, ham hata sızdırmama ve kısa loglama uygulanmış; AI hata normalizasyonu eklendi (`AiProviderError`, `ChatPlaceMcpError`). Correlation ID, merkezi sınıflandırma, alert yok. |
| 39 | MONITORING | Kısmen uygulandı | `/api/health`, `marketing_sync_logs`, `automation_runs`/`learning_runs`, `ai_runs` (model/token/maliyet) var. Metrik, alert, sistem sağlığı dashboard'u yok. |
| 40 | ROADMAP | Kısmen uygulandı | Faz 1 büyük ölçüde tamam; Faz 2'den analitik/raporlama/hafıza/öğrenme kısmen var, billing yok; Faz 3–4 (multi-company, izinler, marketplace, mobil) yok. |
| 41 | AI_MODEL_ROUTER | Uygulandı (doküman 2026-07-18'de v2 olarak yeniden yazıldı) | Kod: görev→katman→env tabanlı model seçimi + doğrulama + fallback + maliyet tahmini (`src/lib/ai/model-router.ts`). Eski dokümandaki GPT-5/o3/Whisper/ElevenLabs/Claude/Gemini çoklu sağlayıcı kurgusu kodda yok; doküman gerçek mimariye göre güncellendi. |
| 42 | AI_SYSTEM_MASTER_SPEC | Kısmen uygulandı | Router (env-tabanlı) tam; ajanlar servis olarak kısmi; tool registry yok; memory kısmi; maliyet izleme `ai_runs.estimated_cost` ile var, caching yok. Doküman sonuna gerçek durum tablosu eklendi. |
| 43 | BUSINESS_RULES | Kısmen uygulandı | §12 onay kuralları birebir uygulanmış (`ai_approvals`); AI loglama (`ai_runs`), hassas taleplerde insan onayı, sunucu tarafı fiyat hesabı ve rezervasyon değişiklik logu var. Tenant/rol/izin kuralları, genel audit log, veri saklama kuralları ve token şifreleme uygulanmamış. |

**Özet dağılım:** 4 Uygulandı · 26 Kısmen uygulandı · 7 Uygulanmadı ·
1 Güncel değil (03) · (41 bugün güncellendi; birçok "Kısmen" satırında ayrıca
çelişki notu var).

---

## En büyük doküman–kod çelişkileri

1. **Multi-tenant vs. tek kiracı** — docs/02/03/04/07/22/43 her tabloda
   `company_id` ve şirket izolasyonu şart koşar; migration'ların hiçbirinde
   `company_id` yok. Uygulama bilinçli olarak tek işletme (Redmedia) için
   yazılmıştır; dokümanlar genel SaaS'ı tarif eder.
2. **Güven eşikleri üç dokümanda üç farklı** — docs/01 (90/70/50),
   docs/02 (95/80/60), docs/05 (95/85/70/50) birbiriyle çelişir; kod
   docs/01'i uygular (`src/lib/ai/confidence.ts`).
3. **Model kataloğu** — docs/41/42 eski sürümü GPT-5, o3, ElevenLabs,
   Claude, Gemini gibi çoklu sağlayıcı öngörüyordu; kod yalnızca OpenAI ve
   env ile yapılandırılan katmanları kullanır. docs/41 buna göre yeniden
   yazıldı.
4. **Meta token şifreleme** — docs/10 ve docs/43 §9 "access token'lar
   şifrelenmeli" der; `meta_oauth_tokens` düz metin saklanır (RLS + yalnız
   service role erişimi ile korunur). Açık teknik borç.
5. **Meta Ads yazma yetkisi** — docs/10 otomatik ölçekleme/bütçe değişikliği
   tarif eder; kod, proje kuralı (`04-ai-behavior.mdc`) gereği bilinçli
   olarak salt okuma + öneri/onay modelindedir.
6. **Rol/izin sistemi** — docs/03/04/17/22 kapsamlı RBAC tanımlar; kodda
   yalnızca kullanılmayan bir `profiles.role` kolonu vardır.
7. **Webhook yönü** — docs/33 dışa giden webhook teslimatını anlatır;
   kodda yalnızca gelen webhook işleme vardır.
8. **Kuyruk/worker mimarisi** — docs/02/04 worker, event bus ve pg_cron
   öngörür; kod hosting cron route'ları ile çalışır. Ayrıca `meta-sync` ve
   `ceo-daily-report` route'ları mevcut olduğu halde cron zamanlayıcı
   yapılandırmasında tanımlı değildir — kurulum gerekir (bkz. TODO.md).
