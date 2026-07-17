# Veritabanı (Supabase)

> **Durum:** Veritabanı henüz oluşturulmadı. Bu belge, veritabanı
> kurulduğunda uygulanacak planı ve konvansiyonları tanımlar; kod veya şema
> içermez.

## Teknoloji

- Supabase (PostgreSQL + RLS + Auth + Storage).

## Konvansiyonlar

Detaylı kurallar için `.cursor/rules/03-database.mdc`'ye bakınız. Özet:

- `snake_case` isimlendirme, çoğul tablo adları.
- Her şema değişikliği migration dosyası ile yapılır.
- Kullanıcı/müşteri verisi içeren her tablo RLS ile birlikte oluşturulur.
- Service role erişimi yalnızca sunucu tarafı kodda kullanılır.

## Öngörülen Tablo Alanları (Taslak, Henüz Uygulanmadı)

Bu liste, projenin amacına göre **öngörülen** alanlardır; birebir şema
tanımı değildir ve gerçek geliştirme sırasında ihtiyaca göre değişebilir:

- **Müşteriler** — Instagram/Facebook üzerinden gelen müşteri kayıtları.
- **Konuşmalar / Mesajlar** — ChatPlace üzerinden yürütülen müşteri
  konuşmalarının geçmişi (müşteri hafızası dahil).
- **Kampanyalar / Reklamlar** — Meta reklam hesabından senkronize edilen
  kampanya ve performans verisi (yalnızca okuma/analiz amaçlı).
- **AI Cevap Logları** — Üretilen her AI cevabının girdi/çıktı/model/zaman
  kaydı (`.cursor/rules/04-ai-behavior.mdc`).
- **Personel / Yetkilendirme** — Panelde işlem yapan Redmedia personeli ve
  yetki seviyeleri (insan onayı gerektiren akışlar için).

## RLS Yaklaşımı

- Varsayılan: erişim reddedilir (deny by default).
- Her tablo için, hangi rolün hangi satırlara erişebileceği açık politika
  ile tanımlanır.
- Servis tarafı (webhook işleme, AI log yazma gibi arka plan işler) service
  role ile RLS'yi bypass eder; bu erişim yalnızca sunucu kodunda kalır.

## Migration Süreci

1. Şema değişikliği ihtiyacı doğar.
2. Yeni bir migration dosyası eklenir (`supabase/migrations`).
3. Migration; tablo/kolon değişikliği + gerekiyorsa RLS politikalarını
   birlikte içerir.
4. Migration uygulanır, TypeScript tipleri şemadan yeniden üretilir.

Bu süreç, Supabase bağlanıp ilk migration eklendiğinde bu belgeye
işlenecektir.
