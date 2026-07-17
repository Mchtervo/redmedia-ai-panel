# Yol Haritası

Bu yol haritası aşama sırasını belirtir; tarih içermez. Bir aşamaya
geçilmeden önceki aşamanın gereksinimleri (özellikle güvenlik/RLS)
tamamlanmış olmalıdır.

## Aşama 0 — Temel Altyapı (Tamamlandı)

- Next.js (App Router) + TypeScript strict + Tailwind + ESLint kurulumu.
- `src/` klasör yapısı.
- Sade başlangıç ana sayfası.
- Cursor Project Rules ve proje dokümantasyonu (bu belgeler).

## Aşama 1 — Supabase Bağlantısı ve Temel Şema (Tamamlandı)

- [x] Supabase proje anahtarları `.env.local` içine eklendi.
- [x] v1 şeması `supabase/migrations/` altında 10 migration dosyası olarak
      tanımlandı (25 tablo; bkz. `docs/DATABASE.md`). Her tabloda RLS aktif.
- [x] Migration'lar canlı Supabase projesine uygulandı ve doğrulandı (25/25 tablo).
- [x] Uygulama kodunda Supabase istemcisi kuruldu (`anon`/`service role`
      ayrımı — `src/lib/supabase/client.ts`, `src/server/supabase/{server,admin}.ts`).
- [x] Şemadan TypeScript tipleri üretildi (`src/types/database.ts`, `any` kullanılmadı).

## Aşama 2 — Kimlik Doğrulama ve Personel Yönetimi

- Redmedia personeli için giriş/yetkilendirme akışı.
- Yetki seviyeleri (örn. yönetici / temsilci) tanımlanır.
- İnsan onayı gerektiren akışlar (bkz. `docs/AI.md`) bu yetki modeline
  bağlanır.

## Aşama 3 — Meta (Instagram/Facebook) Entegrasyonu

- Meta Graph API bağlantısı (yalnızca okuma/analiz — bkz. `docs/META.md`).
- Reklam performans verisi ve sayfa konuşmalarının panelde görüntülenmesi.
- Otomatik bütçe/durum değişikliği yapılmaz; bu aşamada yalnızca izleme.

## Aşama 4 — ChatPlace Entegrasyonu

- Webhook bağlantısı ve doğrulaması (bkz. `docs/CHATPLACE.md`).
- Konuşma/mesaj senkronizasyonu ve müşteri hafızasının Supabase'de
  saklanması.

## Aşama 5 — Yapay Zekâ (OpenAI) Entegrasyonu

- AI davranış sözleşmesinin uygulanması (bkz. `docs/AI.md`,
  `.cursor/rules/04-ai-behavior.mdc`): fiyat/hizmet sınırları, insan onayı
  akışları, loglama, kaynağa dayalı cevap üretimi.
- Meta reklam verisi için AI destekli analiz/öneri raporları.

## Aşama 6 — Dashboard ve Raporlama

- Müşteri, konuşma, kampanya ve AI verilerini birleştiren üst düzey
  panel/rapor ekranları.
- Tablo ve grafiklerin okunabilirlik/erişilebilirlik standardına uygun
  şekilde tamamlanması (bkz. `.cursor/rules/05-ui.mdc`).

## Genel Not

Her aşama, ilgili `.cursor/rules/*.mdc` kurallarına ve `docs/` altındaki
kendi dokümanına uygun şekilde geliştirilecektir. Bir aşama başlamadan
önce ilgili doküman (varsa) somut teknik detaylarla güncellenecektir.
