# Güvenlik Politikası

Bu belge, projenin tüm entegrasyonları için geçerli olan güvenlik
politikasını özetler. Uygulanabilir kural detayları için
`.cursor/rules/02-security.mdc`'ye bakınız; bu belge o kuralların gerekçe ve
kapsamını açıklar.

## Sır Yönetimi

- Tüm API anahtarları, tokenlar ve secret'lar sunucu tarafı environment
  variable olarak saklanır.
- `.env*` dosyaları repoya commit edilmez (`.gitignore` içinde hariç
  tutulmuştur).
- İstemci koduna (`"use client"` bileşenler, tarayıcıda çalışan JS) hiçbir
  sır değeri geçirilmez.
- `NEXT_PUBLIC_` önekli değişkenler yalnızca sır içermeyen, istemciye açık
  olması güvenli değerler için kullanılır.

## Supabase Erişim Modeli

- **anon key**: istemci tarafında, RLS politikalarıyla sınırlı erişim için.
- **service role key**: yalnızca sunucu tarafı kodda, RLS'yi bypass eden
  yönetimsel/arka plan işlemler için (webhook işleme, AI log yazma).
- İki istemci türü kod tabanında ayrı modüllerde tutulur, birbirine
  karıştırılmaz.

## Webhook Güvenliği

- Meta ve ChatPlace webhook'ları, sağlayıcının belirttiği imza/secret
  doğrulama mekanizmasıyla doğrulanır.
- Doğrulanamayan istekler işlenmeden reddedilir.
- Webhook endpoint'leri rate limiting ile korunur.

## Veri Erişim Kontrolü (RLS)

- Kullanıcı/müşteri verisi içeren her tablo RLS ile korunur.
- Politikalar "varsayılan reddet" (deny by default) ilkesiyle yazılır.
- Yetki seviyeleri (personel/yönetim) veri erişimini sınırlar.

## Loglama Hijyeni

- Loglarda API anahtarı, token veya müşteri hassas verisi
  (mesaj içeriği, iletişim bilgisi, ödeme verisi) gösterilmez.
- Hata logları, sorunu teşhis etmeye yetecek kadar bilgi içerir; gereğinden
  fazla veri (tam istek gövdesi, kullanıcı verisi) loglanmaz.

## Bağımlılık ve Kod Güvenliği

- Yeni bağımlılıklar eklenmeden önce gerekliliği değerlendirilir
  (bkz. `.cursor/rules/01-code-quality.mdc`).
- `any` kullanımından kaçınılması, tip güvenliği yoluyla dolaylı olarak
  hatalı veri işlemeyi de azaltır.

## Sorumluluk Sınırı

Bu belge, planlanan entegrasyonlar (Supabase, Meta, ChatPlace, OpenAI)
henüz canlı bağlanmadığı için ileriye dönük bir politika niteliğindedir.
Her entegrasyon bağlandığında, o entegrasyona özgü güvenlik detayları
ilgili doküman (`DATABASE.md`, `META.md`, `CHATPLACE.md`, `AI.md`) içine
işlenir.
