# Yapay Zekâ (AI) Modülü

> **Durum:** OpenAI'ye **henüz bağlanmadı**. Conversation Engine v1
> (`features/conversations`) `ai_runs` tablosunu salt-okuma olarak
> kullanıma hazırladı (bkz. altta), ancak bu tabloya henüz hiçbir satır
> yazılmıyor — gerçek AI cevap üretimi bu belgenin "Kapsam Dışı"
> bölümündedir.

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

## AI'nin Devreye Gireceği Noktalar (Conversation Engine İçinde)

Gerçek OpenAI entegrasyonu geldiğinde, akış şu noktalara oturacak (bkz.
`docs/CHATPLACE.md` mesaj akışı):

1. AI, **yalnızca mesaj `messages` tablosuna kalıcı olarak yazıldıktan
   sonra** devreye girer (`ingestInboundMessage` tamamlandıktan sonra) —
   ham webhook üzerinde asla; AI üretimi başarısız olsa da müşterinin
   mesajı kaybolmaz.
2. **Önce sınıflandırma:** mesaj şikâyet/indirim/iptal/özel fiyat mı?
3. **AI cevaplayabilirse:** kaynak veriden (`knowledge_documents`/`knowledge_chunks`)
   grounded cevap üretir; `ai_runs` (`requires_human_approval=false`) ile
   loglanır, sonra `sendStaffMessage`'a benzer bir `sendAiMessage` akışıyla
   (henüz yazılmadı) `messages`'a `sender_type=ai` olarak eklenir.
4. **Hassas konuysa:** AI nihai cevabı üretmez; `ai_runs.requires_human_approval=true`
   ile işaretler, konuşma bir personele yönlendirilir/atanır
   (`assignConversation`, zaten v1'de mevcut).
5. **Önerilen desen — "AI taslak, insan gönderir":** hassas durumlarda AI
   tamamen susmak zorunda değildir; bir taslak cevap hazırlayıp personelin
   onayına sunabilir, onaylanmadan müşteriye gitmez.
6. Müşteriye ulaşan her AI cevabının karşılığında bir `ai_runs` satırı
   olmalıdır (kural 4).
7. AI ayrıca periyodik/talep üzerine `conversation_summaries`'i güncelleyerek
   uzun konuşmalar için kompakt bir "hafıza" tutar — bu, cevap üretmekten
   **farklı bir görev türü** (`ai_runs.task_type`).

## `ai_runs` — v1'de Salt-Okuma Kullanım

- `features/conversations/repositories/conversations.repository.ts` içinde
  `listAiRunsForConversation(supabase, conversationId)` fonksiyonu mevcuttur.
- Konuşma detay sayfasında (`/dashboard/inbox/[id]`) bir "AI Geçmişi" bölümü
  bu fonksiyonu çağırır; OpenAI bağlanana kadar bu bölüm her zaman **boş
  durum** ("Henüz AI etkileşimi yok") gösterir.
- Bu, tabloyu ve okuma yolunu şimdiden hazırlar; gerçek AI entegrasyonu
  geldiğinde yalnızca yazma tarafı (`ai_runs` INSERT) eklenecektir.

## Planlanan Bileşenler (Henüz Yok)

- **Prompt/grounding katmanı** — AI'a gönderilecek bağlamın kaynak veriden
  (hizmet/fiyat/SSS) derlenmesi.
- **Karar katmanı** — Gelen talebin "insan onayı gerektirir mi" sınıflandırması.
- **`features/ai/`** — bu karar/log mantığının yaşayacağı feature modülü;
  `features/conversations`, yeni bir mesaj geldiğinde bu modülün servis
  fonksiyonunu çağıracak (cross-feature servis çağrısı, repository çağrısı
  değil — bkz. `docs/ARCHITECTURE.md`).

## Meta Reklam Analizi İçin AI

- AI, reklam performans verisini yorumlar ve öneri metni üretir.
- Bütçe/kampanya durumu değişikliği önerisi, insan onayına sunulmadan
  uygulanmaz (bkz. `docs/META.md`).

## Kapsam Dışı (v1)

- Gerçek OpenAI API çağrısı / bağlantısı.
- `ai_runs` tablosuna yazma (yalnızca okuma hazır).
- AI'nin insan onayı almadan işlem (iptal, indirim, bütçe değişikliği)
  gerçekleştirmesi.
- AI'nin kaynak veride olmayan bilgiyle serbest metin üretmesi.

Gerçek entegrasyon başladığında bu belge; kullanılan model(ler), prompt
yapısı ve log şemasıyla güncellenecektir.
