# AI Sales Learning Engine

Redmedia'nın satış danışmanı gibi konuşan, her konuşmadan öğrenen ve zamanla
satış performansını artıran AI katmanı. Mevcut Conversation Learning
(`docs/LEARNING.md`) altyapısının üzerine kuruludur; ham mesajlar değil,
maskelenmiş ve yapılandırılmış analizler kullanılır.

## Bileşenler

### 1. Conversation Memory

- Kaynaklar: Instagram DM, Facebook Messenger, WhatsApp (`conversations.channel`)
  ve CRM notları (`customer_admin_notes`, analiz transkriptine dahil edilir).
- Her konuşma gece analizinde şu alanlarla hafızaya işlenir
  (`conversation_analyses`): müşteri isteği, ilk soru, ilk verilen cevap,
  vazgeçme noktası (`drop_off_point`), rezervasyon (`reservation_created`),
  kapora (`deposit_received`), satış sonucu (`sale_outcome`).

### 2. Learning Engine (gecelik)

- Cron: `/api/cron/conversation-learning` (mevcut). Extraction prompt'u
  genişletildi; her analizden satış kalıpları çıkarılır ve `sales_patterns`
  tablosuna işlenir: açılış, fiyat anlatımı, güven oluşturma, itiraz cevabı,
  kapanış, başarısız yaklaşım, ayrılma sebebi.
- Kalıplar silinmez; `won_count` / `lost_count` sayaçları büyür,
  `success_rate` yeniden hesaplanır (Continuous Memory).

### 3. Company Personality

- `company_personality_traits`: nasıl konuşuyoruz, nasıl fiyat veriyoruz,
  telefonu ne zaman istiyoruz, hangi hizmetleri öneriyoruz, hangi kelimeleri
  kullanıyoruz, nasıl güven veriyoruz.
- Yalnızca personel mesajlarından öğrenilir; kanıt sayısı arttıkça güven artar.

### 4. Conversation Scoring

- Her konuşmaya 0-100 puan: Satış Kalitesi, Empati, Hız, İkna, Rezervasyona
  Yakınlık (`score_*` kolonları) + eksikler (`score_notes`).

### 5. Self Improvement

- `ai_mistakes`: AI'nin (yalnızca "Asistan" mesajlarının) hataları — örn.
  fiyat sorusuna yardım etmeden karşı soru sorma, erken telefon isteme.
- Aktif hatalar her cevap üretiminde "ASLA TEKRARLAMA" bloğu olarak prompt'a
  girer. 14 gün tekrarlanmayan hata haftalık raporda otomatik "çözüldü" olur;
  panelden de çözülebilir.

### 6. Best Conversation Library

- `saleOutcome=won` (veya rezervasyon/kapora kanıtı) + satış kalitesi ≥ 80
  olan konuşmalar `is_best_conversation=true` işaretlenir ve yeni cevaplarda
  örnek olarak prompt'a eklenir.

### 7-8. Continuous Memory + AI Decision Rules

- `generateSimpleAssistantReply` her cevap öncesi öğrenilmiş hafızayı yükler
  (`loadSalesLearningContext`) ve gelen mesaja göre ilgili kalıp türlerini
  önceliklendirir (`detectRelevantPatternTypes`).
- Çelişkide `success_rate` yüksek kalıp önce gelir.
- Güvenlik sınırı: öğrenilmiş hafıza yalnızca üslup/strateji içindir;
  fiyat/hizmet bilgisi yalnızca onaylı knowledge + rezervasyon taslağından
  gelir (`04-ai-behavior.mdc` kuralları geçerli kalır).

### 9. Quality Control

- `ai_weekly_reports` + `/api/cron/ai-weekly-report` (Pazartesi 03:00):
  bu hafta öğrendiklerim, yaptığım/düzelttiğim hatalar, yeni satış
  teknikleri, en başarılı/başarısız cevaplar. Veri yoksa "Yeterli veri
  bulunamadı." yazılır.
- Panel: `/dashboard/ai` → "AI Satış Öğrenme Motoru" bölümü.

## Tablolar

| Tablo | Amaç |
| --- | --- |
| `sales_patterns` | Öğrenilen satış kalıpları + başarı sayaçları |
| `company_personality_traits` | Şirket kişiliği (kalıcı AI Memory) |
| `ai_mistakes` | AI hata hafızası (tekrar önleme) |
| `ai_weekly_reports` | Haftalık öz değerlendirme raporu |
| `conversation_analyses` (genişletildi) | Skorlar, ilk soru/cevap, vazgeçme noktası, best flag |

Migration'lar: `000025`–`000030`. Mevcut veritabanına uygulamak için
`supabase/setup/sales_learning_engine.sql` dosyasını Supabase SQL Editor'da
çalıştırın.
