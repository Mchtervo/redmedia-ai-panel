# Mimari

## Mimari Karar: Hybrid Architecture (Feature-Based + Layered)

Proje **Hybrid Architecture** ile kurulur: iş alanları (`features/*`) dikey
dilimlere (vertical slices) ayrılır, güvenlik-kritik ve cross-cutting altyapı
(`server/`, `types/`, `lib/`) yatay paylaşılan çekirdekte kalır.

**Neden Hybrid:**
- Saf **Layered** (her şey teknik katmana göre gruplanır) 12 panel domaini
  (Inbox, Customers, Leads, Reservations, AI, Ads, Analytics, Knowledge,
  Integrations, Team, Settings) ve 25 tabloda navigasyonu zorlaştırır; bir
  özellik eklemek birçok üst klasöre dokunmayı gerektirir.
- Saf **Feature-Based** (paylaşılan katman yok) risklidir: `contacts` gibi
  çok referanslı varlıklar ve Supabase service-role gibi güvenlik-kritik kod
  her feature'da tekrarlanır/tutarsızlaşır.
- **Hybrid**: her feature bağımsız büyür (kendi UI/action/repository/service'i
  ile), güvenlik ve paylaşılan tipler tek bir yerde kalır.

## Genel Yaklaşım

- Next.js **App Router** kullanılır.
- Varsayılan bileşen tipi **Server Component**'tir; `"use client"` yalnızca
  gerçekten gerekli olduğunda (state, effect, tarayıcı API'si, event handler)
  eklenir.
- `src/app/` **yalnızca routing + sayfa kompozisyonu** içerir; iş mantığı
  `features/*` içinde yaşar, `app/**/page.tsx` onu çağırır.
- Kod, henüz istenmeyen özellik/entegrasyon için önceden dolu iskelet
  oluşturmaz (bkz. `.cursor/rules/00-project.mdc`) — boş feature klasörleri
  yalnızca amaçlarını açıklayan bir `README.md` içerir.

## Klasör Yapısı

```
src/
  app/                     # Routing + sayfa kompozisyonu (iş mantığı yok)
    login/                 # page.tsx, login-form.tsx
    dashboard/
      layout.tsx           # auth kontrolü + Sidebar/Header sarmalayıcı
      page.tsx
      inbox/ customers/ leads/ reservations/ ai/ ads/
      analytics/ knowledge/ integrations/ team/ settings/
    api/                   # Route Handler'lar (webhook, dış entegrasyon) — henüz yok
    layout.tsx, page.tsx, globals.css

  features/                # Dikey dilimler — her biri bir panel menüsüne karşılık gelir
    auth/                  # login'e özel doğrulama (menüde yok)
    contacts/              # Customers — paylaşılan çekirdek varlık (bkz. altı)
    conversations/         # Inbox
    leads/
    reservations/
    ai/
    ads/
    analytics/             # kendi tablosu yok, salt-okuma agregasyon
    knowledge/
    integrations/
    team/
    settings/
    # Her feature'ın standart iç yapısı (ilk gerçek kod eklendiğinde açılır):
    #   components/ actions/ repositories/ services/ validators/ types.ts

  components/
    ui/                    # shadcn primitifleri (feature-agnostic)
    dashboard/             # panel geneli chrome (sidebar, header) — feature'a özel değil

  server/                  # Kesinlikle sunucu-özel, Client Component'ten import edilmez
    supabase/
      server.ts            # anon key + cookie, RLS'e tabi
      admin.ts             # service role, RLS bypass
    auth/                  # rezerve: getCurrentUser()/requireUser()
    rate-limit/            # rezerve: dış erişimli endpoint'ler için
    webhooks/              # rezerve: imza doğrulama yardımcıları
    logging/                # rezerve: hassas veri maskeleyen logger

  services/                # Cross-feature orkestrasyon (örn. AttributionService) — henüz yok
  repositories/             # Paylaşılan/generic repository yardımcıları — henüz yok
  actions/                  # Global Server Action'lar (örn. signOutAction) — henüz yok
  validators/               # Paylaşılan Zod şemaları — henüz yok
  types/                    # database.ts (Supabase'den üretilen tipler), api.ts — henüz yok
  providers/                # React context sağlayıcıları — henüz yok
  stores/                   # İstemci state (rezerve, boş)
  constants/                # Uygulama geneli sabitler — henüz yok
  config/                   # Tipli env erişim katmanı — henüz yok
  emails/                   # E-posta şablonları (rezerve, boş)

  lib/
    utils.ts               # cn() vb. framework-agnostic yardımcılar
    supabase/client.ts      # tarayıcı-güvenli (anon key), Client Component'lerden kullanılır
    navigation.ts           # sidebar menü tanımı

  hooks/                    # Paylaşılan React hook'ları (use-mobile.ts)
  proxy.ts                  # Next.js 16 rota koruması + oturum yenileme (kök seviyede kalmalı)
```

**Paylaşılan çekirdek varlık:** `contacts` tablosuna `conversations`,
`lead_profiles`, `reservations`, `sales`, `attribution_events` referans verir.
`features/contacts` sahibidir; diğer feature'lar onun repository/type'larını
import eder, kopyalamaz.

## Dependency Injection

**Framework/container tabanlı DI kullanılmaz** (NestJS/tsyringe tarzı gereksiz
karmaşıklık — 01-code-quality.mdc). Yerine **hafif, açık manuel DI**:
servis/repository fonksiyonları bağımlılıklarını (Supabase istemcisi gibi)
parametre olarak alır, global singleton'a gizlice bağımlı olmaz. Mevcut
`createClient()` / `createAdminClient()` factory fonksiyonları bu deseni
zaten uygular.

## Repository Pattern

**Evet, ama pragmatik/lite versiyonu.** Her feature içinde
`repositories/<entity>.repository.ts` adında düz, tipli fonksiyon modülleri
(`getContactById(supabase, id)` gibi) — class tabanlı interface+implementation
ikilisi değil. Sorgu mantığı UI/Server Action'a yayılmaz (03-database.mdc).

## Server Actions vs. API Route (Route Handler)

**Server Action** — bu uygulamanın kendi UI'ından tetiklenen, dışa açık
sözleşmeye ihtiyacı olmayan mutasyonlar: form gönderimleri (lead/rezervasyon
oluşturma), tek tıkla aksiyonlar (AI önerisi onaylama), oturum aksiyonları.

**Route Handler (`app/api/**/route.ts`)** — Next.js UI'ı dışından çağrılan
veya özel HTTP semantiği gereken her yer:
- Webhook'lar (`api/chatplace/webhook`, `api/meta/webhook` — `docs/CHATPLACE.md`, `docs/META.md`)
- OAuth callback'ler
- Cron/zamanlı görev tetikleyicileri
- İleride genel API/entegrasyon yüzeyi

Her Route Handler: (1) girdiyi Zod ile doğrular, (2) iş mantığını ayrı
fonksiyona devreder, (3) standart `ApiResponse<T>` zarfıyla cevap döner.

## Server / Client Sınırı

- Veri okuma/yazma, dış servis çağrıları ve sır (secret) kullanımı **sunucu
  tarafında** kalır (Server Component, Route Handler, Server Action,
  `server/` klasörü).
- Client Component'ler yalnızca etkileşim gerektiren küçük parçalarda
  kullanılır (form, filtre, canlı güncellenen widget).

## Ortam Değişkenleri (Environment Variables)

- Sır niteliğindeki değerler (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`,
  `META_APP_SECRET`, `CHATPLACE_API_KEY` vb.) yalnızca sunucu tarafında
  okunur, `NEXT_PUBLIC_` öneki almaz.
- İstemciye açık olması gereken değerler `NEXT_PUBLIC_` öneki ile açıkça
  işaretlenir ve sır içermez.
- Şu an `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` `.env.local` içinde tanımlı (bkz. `.env.example`).

## Veri Akışı (Yüksek Seviye, Planlanan)

```
Meta / ChatPlace  --webhook-->  Route Handler  --dogrulama+Zod-->  Supabase
                                                                     |
Dashboard (Server Component)  <--sorgu--  Supabase  <--yazma--  AI modulu (OpenAI)
```

Bu akış, ilgili entegrasyonlar eklendiğinde bu belgeyle birlikte
güncellenecektir.
