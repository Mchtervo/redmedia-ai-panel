# Yapay Zekâ (AI) Modülü

> **Durum:** Henüz bağlanmadı. Bu belge, OpenAI entegrasyonu geldiğinde
> uygulanacak davranış sözleşmesini tanımlar; canlı bağlantı veya API
> anahtarı içermez.

## Amaç

AI modülü, müşteri konuşmalarına (ChatPlace üzerinden) destek olmak ve Meta
reklam performansı üzerinde analiz/öneri üretmek için kullanılır.

## Davranış Sözleşmesi

Aşağıdaki kurallar tüm AI özellikleri için zorunludur (bkz.
`.cursor/rules/04-ai-behavior.mdc` — bu belge ile birebir uyumludur):

1. **Fiyat uydurmaz.** Fiyat bilgisi yalnızca Supabase'deki doğrulanmış
   kaynak veriden gelir.
2. **Var olmayan hizmeti sunmaz.** Hizmet listesi kaynak veriyle sınırlıdır.
3. **İnsan onayı gerektiren durumlar:** şikâyet, indirim, iptal, özel fiyat.
   Bu durumlarda AI nihai cevabı/işlemi kendi başına yapmaz.
4. **Her cevap loglanır.** Girdi, çıktı, model, zaman damgası, ilgili
   müşteri/konuşma referansı Supabase'de tutulur.
5. **Kaynağa dayanır (grounding).** AI, Redmedia'nın işletme bilgisi
   (hizmetler, fiyatlar, politikalar) dışına çıkarak bilgi üretmez.
6. **Müşteri hafızası Supabase'de saklanır.** Geçici/bellek-içi bir çözüm
   kullanılmaz.

## Planlanan Bileşenler

- **Prompt/grounding katmanı** — AI'a gönderilecek bağlamın kaynak veriden
  (hizmet/fiyat/SSS) derlenmesi.
- **Karar katmanı** — Gelen talebin "insan onayı gerektirir mi" (şikâyet,
  indirim, iptal, özel fiyat) sınıflandırması.
- **Log katmanı** — Her AI etkileşiminin Supabase'e yazılması
  (`docs/DATABASE.md`'deki AI log alanı ile ilişkili).

## Meta Reklam Analizi İçin AI

- AI, reklam performans verisini yorumlar ve öneri metni üretir.
- Bütçe/kampanya durumu değişikliği önerisi, insan onayına sunulmadan
  uygulanmaz (bkz. `docs/META.md`).

## Kapsam Dışı (v1)

- AI'nin insan onayı almadan işlem (iptal, indirim, bütçe değişikliği)
  gerçekleştirmesi.
- AI'nin kaynak veride olmayan bilgiyle serbest metin üretmesi.

Gerçek entegrasyon başladığında bu belge; kullanılan model(ler), prompt
yapısı ve log şemasıyla güncellenecektir.
