# Mimari

## Genel Yaklaşım

- Next.js **App Router** kullanılır.
- Varsayılan bileşen tipi **Server Component**'tir; `"use client"` yalnızca
  gerçekten gerekli olduğunda (state, effect, tarayıcı API'si, event handler)
  eklenir.
- Mimari **modüler** kurulur: her iş alanı (müşteri, konuşma, kampanya, AI)
  kendi klasöründe, kendi veri erişim ve tip tanımlarıyla yaşar.
- Kod, henüz istenmeyen özellik/entegrasyon için önceden iskelet
  oluşturmaz (bkz. `.cursor/rules/00-project.mdc`).

## Mevcut Klasör Yapısı

```
src/
  app/
    layout.tsx      # Kök layout, metadata
    page.tsx         # Ana sayfa
    globals.css      # Tailwind + global stiller
public/               # Statik dosyalar
docs/                 # Proje dokümantasyonu
.cursor/rules/        # Cursor proje kuralları
```

## Planlanan Klasör Yapısı (İhtiyaç Doğdukça)

Aşağıdaki yapı, ilgili özellik geliştirilmeye başlandığında kademeli olarak
oluşturulacaktır; şu an mevcut değildir:

```
src/
  app/
    (dashboard)/            # Panel sayfaları (route group)
    api/                    # Route Handler'lar (webhook, dış entegrasyon)
  components/               # Paylaşılan, genel amaçlı UI bileşenleri
  lib/
    supabase/
      client.ts             # anon key ile - istemci tarafı
      server.ts             # service role ile - yalnızca sunucu
    meta/                   # Meta Graph API istemcisi
    chatplace/               # ChatPlace istemcisi/webhook işleyicileri
    ai/                     # OpenAI istemcisi, prompt/grounding mantığı
  types/                    # Paylaşılan TypeScript tipleri
  schemas/                  # Zod şemaları
```

Bu yapı bir öneri iskelettir; gerçek klasörler ilgili entegrasyon
geliştirilirken, ihtiyaca göre açılır.

## Server / Client Sınırı

- Veri okuma/yazma, dış servis çağrıları ve sır (secret) kullanımı **sunucu
  tarafında** kalır (Server Component, Route Handler, Server Action).
- Client Component'ler yalnızca etkileşim gerektiren küçük parçalarda
  kullanılır (form, filtre, canlı güncellenen widget).

## API Route Konvansiyonu

- Dış sistemlerden gelen istekler (webhook) ve istemciden tetiklenen
  mutasyonlar `src/app/api/**/route.ts` altında Route Handler olarak
  tanımlanır.
- Her Route Handler:
  1. Girdiyi Zod ile doğrular.
  2. İş mantığını ayrı bir fonksiyona/modüle devreder (handler'ın içine
     iş mantığı yazılmaz).
  3. Standart `ApiResponse<T>` zarfıyla cevap döner
     (`.cursor/rules/01-code-quality.mdc`).

## Ortam Değişkenleri (Environment Variables)

- Sır niteliğindeki değerler (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`,
  `META_APP_SECRET`, `CHATPLACE_API_KEY` vb.) yalnızca sunucu tarafında
  okunur, `NEXT_PUBLIC_` öneki almaz.
- İstemciye açık olması gereken değerler (varsa) `NEXT_PUBLIC_` öneki ile
  açıkça işaretlenir ve sır içermez.
- Gerçek değerler bu aşamada eklenmemiştir; entegrasyon başladığında
  `.env.example` dosyası ile hangi değişkenlerin gerektiği belgelenecektir.

## Veri Akışı (Yüksek Seviye, Planlanan)

```
Meta / ChatPlace  --webhook-->  Route Handler  --doğrulama+Zod-->  Supabase
                                                                     |
Dashboard (Server Component)  <--sorgu--  Supabase  <--yazma--  AI modülü (OpenAI)
```

Bu akış, ilgili entegrasyonlar eklendiğinde bu belgeyle birlikte
güncellenecektir.
