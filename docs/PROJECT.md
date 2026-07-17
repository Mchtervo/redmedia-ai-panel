# Redmedia AI Panel

## Amaç

Redmedia AI Panel, Redmedia'nın aşağıdaki alanlarını **tek bir panelden**
yönetmesini sağlayan bir yönetim uygulamasıdır:

- Instagram ve Facebook müşterileri
- ChatPlace otomasyonları
- Meta reklamları
- Müşteri konuşmaları
- Satış dönüşümleri
- Yapay zekâ analizleri

## Hedef Kullanıcı

Redmedia ekibi (satış, müşteri temsilcisi, yönetim). Panel Redmedia'nın kendi
operasyonu için kullanılır; genel/çok kiracılı (multi-tenant) bir SaaS ürünü
değildir.

## Kapsam

Bu depo **yalnızca Redmedia** için geliştirilir. Kapsam dışı konular ve
detaylı sınırlar için `.cursor/rules/00-project.mdc`'ye bakınız.

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Framework | Next.js (App Router) |
| Dil | TypeScript (`strict`) |
| Stil | Tailwind CSS |
| Lint | ESLint |
| Klasör yapısı | `src/` |
| Paket yöneticisi | npm |
| Veritabanı (planlanan) | Supabase |
| Reklam/Sosyal entegrasyonu (planlanan) | Meta Graph API |
| Otomasyon entegrasyonu (planlanan) | ChatPlace |
| Yapay zekâ (planlanan) | OpenAI |

## Mevcut Durum

Proje şu anda temel Next.js iskeletindedir: App Router, TypeScript strict,
Tailwind, ESLint kurulu ve hatasız; `src/app` altında sade bir başlangıç
ekranı mevcuttur. Supabase, Meta API, ChatPlace, OpenAI bağlantıları,
gerçek API anahtarları ve veritabanı şeması **henüz eklenmemiştir**.

Detaylı ilerleme planı için `docs/ROADMAP.md`'ye bakınız.

## İlgili Dokümanlar

- `docs/ARCHITECTURE.md` — Mimari ve klasör yapısı
- `docs/DATABASE.md` — Veritabanı planı (Supabase)
- `docs/CHATPLACE.md` — ChatPlace entegrasyon planı
- `docs/META.md` — Meta (Instagram/Facebook) entegrasyon planı
- `docs/AI.md` — Yapay zekâ davranışı ve OpenAI entegrasyon planı
- `docs/SECURITY.md` — Güvenlik politikası
- `docs/ROADMAP.md` — Aşamalı yol haritası
