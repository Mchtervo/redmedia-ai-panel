# Redmedia AI Panel

Redmedia'nın Instagram ve Facebook müşterilerini, ChatPlace otomasyonlarını,
Meta reklamlarını, müşteri konuşmalarını, satış dönüşümlerini ve yapay zekâ
analizlerini tek panelden yönetmek için geliştirilen yönetim uygulaması.

Proje detayları, mimari ve yol haritası için `docs/PROJECT.md`'ye bakınız.

## Başlarken

Geliştirme sunucusunu çalıştırmak için:

```bash
npm install
npm run dev
```

Ardından tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

## Kod Kalitesi Kontrolleri

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Dokümantasyon

- `docs/PROJECT.md` — Proje amacı ve kapsamı
- `docs/ARCHITECTURE.md` — Mimari ve klasör yapısı
- `docs/DATABASE.md` — Veritabanı planı (Supabase)
- `docs/CHATPLACE.md` — ChatPlace entegrasyon planı
- `docs/META.md` — Meta (Instagram/Facebook) entegrasyon planı
- `docs/AI.md` — Yapay zekâ davranışı ve OpenAI entegrasyon planı
- `docs/SECURITY.md` — Güvenlik politikası
- `docs/ROADMAP.md` — Aşamalı yol haritası

Proje kuralları için `.cursor/rules/` klasörüne bakınız.
