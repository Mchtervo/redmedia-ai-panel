# 47 — DETAYLI UYGULAMA PLANI

**Belge türü:** Ürün + teknik uygulama yol haritası  
**Son güncelleme:** 2026-07-18  
**Durum:** Onay bekleyen çalışma planı (bu belge uygulanacak işlerin tek kaynağıdır)  
**Kısa checklist:** `TODO.md` (bu dosyanın özeti)

---

## 0. Bu belge ne için?

Bu plan, Redmedia AI Panel’i bir **AI Business Operating System** haline getirmek için yapılacak her işi **neden / ne / nasıl / kim görür / ne zaman bitti sayılır** seviyesinde anlatır.

Kısa madde listesi değildir. Her faz:

- iş değerini,
- mevcut durumu (dürüst),
- yapılacakları adım adım,
- AI / otomasyon / veritabanı / ekran etkisini,
- riskleri,
- bitiş kriterlerini

içerir.

**Çalışma kuralı:** Faz sırası bozulmaz. Bir fazın çıkış kriteri sağlanmadan sonrakine geçilmez (dış bağımlılık engeli varsa o madde “blokeli” işaretlenir, paralel güvenli işler devam eder).

---

## 1. Ürün vizyonu (sabit kararlar)

### 1.1 Ne değiliz / neyiz

| Değiliz | Yiz |
|---------|-----|
| Klasik CRM | AI işletim sistemi |
| Sadece sohbet botu | Satış + rezervasyon + reklam + öğrenme döngüsü |
| Reklam paneli | Uzman reklam direktörü gibi düşünen motor |
| Rapor aracı | Karar üreten + (onayla) uygulayan sistem |

### 1.2 Değişmez iş kuralları

1. **Fiyat uydurulmaz.** Fiyat ve hizmet yalnızca Supabase’deki katalogdan gelir.
2. **Reklam bütçesi kendi başına değişmez.** AI önerir → insan onaylar → (ileride) uygulanır.
3. **İndirim / iptal / şikâyet / özel fiyat / pazarlık** → insan onayı olmadan sonuçlandırılmaz.
4. **Logsuz AI çıktısı müşteriye gitmez** (`ai_runs` kaydı şart).
5. **Her AI “evreninin” ayrı aç/kapa anahtarı vardır** (aşağıda).
6. **Doğru GPT modeli doğru işte kullanılır** (model matrisi).
7. **Kanıtsız iddia yok.** “Bu reklam kötü” denecekse metrik + dönem + karşılaştırma gösterilir.

### 1.3 İki ana “uzman çalışan”

**A) AI Satış & Rezervasyon Danışmanı**  
Müşteriyle konuşur, hafızasında tutar, pazarlığı öğrenir, eksik bilgileri sorar, unutmaz, takip eder, yeterli bilgiyle rezervasyonu sisteme girer, “neden rezervasyon olmuyor” diye analiz eder ve sana teklif sunar.

**B) AI Meta Reklam Direktörü**  
Hangi müşterinin hangi reklama geldiğini bilir, sıcak/ılık/soğuk strateji kurar, günlük bütçene göre kaç kreatif/kaç test önerir, Instagram gönderilerini kreatife çevirir, hataları bulur, düzeltme önerir. Otomatik bütçe yakmaz.

---

## 2. Bugünkü gerçek durum (dürüst özet)

Detaylı envanter daha önce yapıldı. Uygulama planı açısından kritik gerçekler:

| Alan | Durum | Anlamı |
|------|-------|--------|
| Inbox + CRM + rezervasyon UI | Çalışıyor | Veri paneli var |
| ChatPlace webhook + AI DM cevap | Çalışıyor | Mesaj gelince cevap üretilebiliyor |
| ChatPlace MCP geçmiş senkron | Çalışıyor | Eski konuşmalar içe aktarıldı |
| Follow-up / hatırlatma | Kısmi | Görev oluşuyor ama **müşteriye gitmiyor** |
| Personel mesajı panelden | Kısmi | DB’ye yazılıyor, Instagram’a gitmiyor |
| Onay kuyruğu | Kısmi | Var ama çoğu zaman cevap **sonra** gidiyor |
| Marketing attribution | İyi | Zincir büyük ölçüde var |
| Marketing “AI strateji” | Zayıf | Şablon / sabit metin ağırlıklı |
| AI Brain / öğrenme | İyi ama yarım | Öğreniyor; bazı çıktılar asistanı beslemiyor |
| Kill switch | Çok zayıf | Yalnızca env `AI_AUTO_REPLY_ENABLED` |
| Model router | Kod var | Env doldurma + tüm görevlerin bağlanması eksik |
| Analytics / Leads / Settings / Knowledge sayfası | Boş/placeholder | UI yok veya yetersiz |
| Otomasyon motoru | Motor var, kural yok | Fiilen hiç çalışmamış gibi |

**Tek cümle:** Gözler ve beyin kısmen var; **eller (gönderim + otonom rezervasyon + gerçek reklam uzmanlığı) eksik.**

---

## 3. OpenAI model matrisi (detay)

### 3.1 Environment değişkenleri

`.env.local` içinde (değerler burada yazılmaz; sadece isimler):

- `OPENAI_API_KEY`
- `OPENAI_MODEL_FAST`
- `OPENAI_MODEL_DEFAULT`
- `OPENAI_MODEL_REASONING`
- `OPENAI_MODEL_COMPLEX`
- `OPENAI_MODEL_EMBEDDING`

Deprecated (temizlenecek):

- `OPENAI_MODEL`
- `OPENAI_MODEL_BALANCED`
- `OPENAI_MODEL_VISION`
- `OPENAI_MODEL_ROUTER_ENABLED` (hiçbir kod okumuyor)

### 3.2 Görev → katman → ne zaman kullanılır

| Görev (`AiTaskKind`) | Katman | Ne zaman |
|----------------------|--------|----------|
| `dm_reply` | FAST | Instagram/ChatPlace müşteri cevabı |
| `comment_reply` | FAST | IG yorum cevabı (ileride) |
| `classification` | FAST | CRM profil çıkarımı, sıcaklık, etiket |
| `tagging` | FAST | Otomatik etiket |
| `notification_copy` | FAST | Panel bildirim metni |
| `short_summary` | FAST | Kısa konuşma özeti |
| `extraction` | DEFAULT | Konuşmadan öğrenme (itiraz, skor, özet) |
| `crm_assist` | DEFAULT | CRM yardım / müşteri kartı zenginleştirme |
| `reservation_assist` | DEFAULT | Rezervasyon bilgi toplama / taslak |
| `customer_summary` | DEFAULT | Müşteri 360 özeti |
| `vision` | DEFAULT | Dekont / görsel okuma |
| `email_draft` | DEFAULT | E-posta taslağı (ileride) |
| `ceo_intelligence` | REASONING | CEO sohbet + derin yorum |
| `marketing_strategy` | REASONING | Reklam stratejisi önerisi |
| `campaign_analysis` | REASONING | Kampanya teşhisi / hata bulma |
| `sales_strategy` | REASONING | Playbook, ikna stratejisi |
| `recommendation` | REASONING | “Şimdi ne yap” önerileri |
| `architecture_analysis` vb. | COMPLEX | Teknik derin analiz (iç kullanım) |
| Embeddings | EMBEDDING | RAG, benzer konuşma arama |

### 3.3 Bu planda “model işi” ne demek?

1. Env’lerin doldurulması (sahip).
2. Kodda her AI çağrısının doğru `task` ile router’a gitmesi (doğrulama + eksik bağlama).
3. Şablon üreten “sahte AI” yerlerin gerçek `marketing_strategy` / `campaign_analysis` / `recommendation` task’larına bağlanması.
4. Maliyetin `ai_runs` üzerinden izlenmesi; aşırı harcamada alarm.

---

## 4. AI evren anahtarları (kill switch) — detaylı tasarım

### 4.1 Neden şart?

Canlıda bir şey bozulursa (yanlış cevap, yanlış follow-up, yanlış öğrenme) **tek tek veya hepsini anında kapatabilmelisin**. Bugün bunu paneldan yapamıyorsun.

### 4.2 Anahtar listesi ve davranış

| Anahtar | Kapalıyken ne olur | Açıkken ne olur |
|---------|--------------------|-----------------|
| **AI_MASTER** | Tüm AI üretimi/gönderimi/öğrenme durur (acil stop) | Diğer anahtarlar geçerli |
| **AI_DM_ASSISTANT** | Webhook’ta otomatik cevap üretilmez; mesaj CRM’e yazılır | Otomatik DM cevabı |
| **AI_LEARNING** | Saatlik öğrenme cron’u atlanır | Konuşma/satış öğrenmesi çalışır |
| **AI_BRAIN** | Yeni bilgi adayı / düzeltme önerisi üretilmez | Brain kuyruğu dolar |
| **AI_FOLLOW_UP** | Follow-up gönderilmez (görev oluşabilir ama send yok) | Otomatik takip gider |
| **AI_RESERVATION** | AI rezervasyon kaydı oluşturmaz; sadece taslak/not | Yeterli bilgide kayıt açabilir |
| **AI_MARKETING** | Strateji/kreatif öneri üretimi durur | Reklam direktörü çalışır |
| **AI_CEO** | CEO asistanı + AI anlatılı rapor kapanır | CEO AI açık |
| **AI_ADS_AUTONOMY** (ileride) | Onaylı reklam aksiyonları uygulanmaz | Onay sonrası uygulama |

### 4.3 Nerede yönetilir?

- **Ayarlar → AI Kontrolleri** sayfası (Settings şu an boş; bu sayfa ilk doldurulacak içerik).
- Her anahtar: Türkçe etiket + kısa açıklama + son değiştiren + zaman.
- Acil kırmızı buton: **Tüm AI’yi durdur** (`AI_MASTER = off`).

### 4.4 Teknik not (uygulama zamanı)

- Saklama: `business_settings` (şu an ölü tablo — canlandırılacak) veya yeni `ai_feature_flags`.
- Okuma: sunucu tarafı; webhook/cron her seferinde flag kontrol eder.
- Env `AI_AUTO_REPLY_ENABLED` geçiş döneminde fallback kalabilir; hedef panel kontrolüdür.

---

# FAZLAR (DETAY)

---

## FAZ 0 — Temel hazırlık

### Amaç
Uygulamaya başlamadan ortamın ve planın netleşmesi.

### İş değeri
Yanlış model / yanlış env ile pahalı veya hatalı AI çağrısı yapmamak.

### Yapılacaklar
1. `.env.local` model değişkenlerini doldur (sahip).
2. Deprecated satırları temizle.
3. `AI_AUTO_REPLY_ENABLED` niyetini netleştir (şu an key varken varsayılan açık olabilir — tehlikeli sürpriz olmasın).
4. ChatPlace’in **mesaj gönderip gönderemediğini** araştırmak (Faz 1’in en kritik dış bağımlılığı).

### Bitiş kriteri
- Model env’leri dolu.
- Outbound için “mümkün / değil / alternatif” kararı yazılı.

---

## FAZ 1 — ELLER: Sistem gerçekten çalışsın

### Amaç
AI’nin ürettiği veya planladığı her aksiyonun **gerçek dünyaya** çıkması.

### İş değeri
“AI var” demek yerine “AI bugün 12 follow-up gönderdi, 3 rezervasyon döndü” diyebilmek. Bu faz olmadan sonraki fazların hiçbiri ölçülemez.

### Mevcut durum
- Webhook AI cevabı ChatPlace’in `reply` alanına bağlı çalışıyor olabilir.
- Panel personel mesajı Instagram’a gitmiyor.
- Follow-up/hatırlatma sadece status flip (`queued` / `sent` etiketi) — gerçek gönderim yok.
- Onay çoğu zaman post-hoc.

---

### 1.1 Mesaj teslimat katmanı

**Ne yapılacak?**
- Tek bir “Outbound Message” servisi:
  - kimden (AI / personel),
  - kime (conversation/contact),
  - içerik,
  - durum: `draft → pending_approval → approved → sending → sent → failed → delivered?`
- ChatPlace outbound yolu bağlanır (araştırma sonucuna göre API veya köprü).
- Panel Inbox’ta “Gönder” gerçekten dışarı çıkar.
- Başarısızlıkta hata nedeni loglanır; kullanıcıya Türkçe mesaj.

**DB (beklenen):**
- `outbound_messages` ve/veya mevcut `messages` üzerinde delivery alanları.
- `delivery_logs` (isteğe bağlı).

**Ekran:**
- Inbox mesaj balonunda durum rozeti (Gönderildi / Hata / Onay bekliyor).

**Bitiş kriteri:**
Panelden test mesajı Instagram’a ulaşır; hata olursa panelde görünür.

---

### 1.2 Follow-up ve hatırlatma gerçek olsun

**Senaryo (istediğin gibi):**
1. Müşteri rezervasyon yapmadı / “düşüneyim” dedi.
2. Sistem hafızaya not düşer.
3. X gün sonra (ayarlanabilir: 1 / 3 / 7) otomatik yazar.
4. Mesaj nedenine göre değişir (fiyat / tarih / paket).
5. Max deneme aşılınca durur; “yazmayın” derse opt-out.

**Ayrıca rezervasyon hatırlatmaları:**
- 7 gün / 3 gün / 1 gün / çekim günü.
- Konum-saat eksikse önce bilgi tamamlama mesajı.

**Kill switch:** `AI_FOLLOW_UP` kapalıysa görev oluşabilir ama gönderim olmaz.

**Bitiş kriteri:**
En az bir gerçek müşteri/test konuşmasında follow-up Instagram’da görünür; panelde teslimat kaydı vardır.

---

### 1.3 Onay kapısı — GÖNDERMEDEN ÖNCE

**Neden?**
Şikâyet/indirim/iptal/pazarlıkta AI’nin cevabı önce gidip sonra onay kuyruğuna düşmesi yanlış.

**Akış:**
1. Gelen mesaj hassas mı? (önce kural, sonra semantik sınıflandırma — FAST/DEFAULT)
2. Hassassa: müşteriye nötr bekleme mesajı **veya** hiç otomatik sonuç mesajı yok (ürün kararı).
3. `ai_approvals` kaydı + panel bildirimi.
4. Admin onaylar / düzenler / reddeder.
5. Onaylanan metin outbound ile gider.

**Bitiş kriteri:**
Test: “indirim isterim” → onay kuyruğunda görünür → onaylanmadan kesin indirim cevabı gitmez.

---

### 1.4 MCP senkron boşluğunu kapat

**Sorun:** Saatlik ChatPlace sync ile gelen mesajlar bugün CRM/AI pipeline’ını atlıyor.

**Ne yapılacak?**
Sync sonrası her yeni mesaj için (en azından):
- customer profile touch,
- smart-sales refresh,
- timeline,
- follow-up iptal/plan.

AI otomatik cevap sync mesajına **genelde verilmez** (geçmiş mesaj); sadece canlı webhook cevaplar. Bu bilinçli ayrım dokümante edilir.

**Bitiş kriteri:**
Sync ile gelen yeni mesaj müşteri skorunu/günceller; panelde timeline’da görünür.

---

### 1.5 Kill switch v1 (Faz 1 içinde zorunlu)

Settings sayfası artık placeholder kalmaz; en azından AI Kontrolleri sekmesi açılır.

**Bitiş kriteri:**
Panelden DM asistanını kapat → yeni mesajda otomatik cevap gelmez. Master kapat → öğrenme cron da no-op.

---

### Faz 1 riskleri
- ChatPlace outbound yoksa: Plan B (ChatPlace otomasyon tetikleyici) veya Plan C (Meta messaging API) — faz “blokeli” kalabilir; o zamana kadar en azından panel bildirimi + kopyala-gönder UX’i yapılır.
- Webhook süresi: gönderim/onay mantığı asenkronlaştırılmalı (mesaj kaydı hızlı ACK).

### Faz 1 çıkış kriteri (hepsi)
1. Gerçek dışarı mesaj (AI veya personel)  
2. Follow-up gerçek gönderim veya bilinçli geçici köprü  
3. Hassas konu onay kapısı  
4. Sync pipeline bağlandı  
5. Kill switch’ler panelde çalışıyor  

---

## FAZ 2 — Satış & Rezervasyon AI (detaylı)

### Amaç
En iyi satış danışmanı gibi davranan, unutmayan, rezervasyonu tamamlayan AI.

### İş değeri
Daha az kaçan lead, daha az “ne oldu bu müşteri?”, daha hızlı rezervasyon kaydı, pazarlık/itiraz öğrenmesi.

---

### 2.1 Konuşma zekâsı ve sürekli hafıza

**Öğrenilecekler (otomatik):**
- Müşteri tipi (sıcak / ılık / soğuk)
- İlgilendiği paket / plato / tarih aralığı
- Fiyat hassasiyeti / pazarlık eğilimi
- İtirazlar (“pahalı”, “düşüneyim”, “başka yerle görüşüyorum”)
- Karar durumu: `undecided` / `waiting_date` / `waiting_price` / `ready_to_book` / `lost`
- Son AI / personel vaadi (söylenen ama yapılmayan şey kalmasın)

**Saklama:**
- `customer_profiles` hafıza alanları (mevcut genişletilir)
- Timeline event: “Müşteri karar vermedi — 3 gün sonra sorulacak”
- Gerekirse `customer_admin_notes` AI notu (etiketli)

**Asistan kullanımı:**
Her cevapta bu hafıza prompt’a girer (zaten kısmen var; eksikler tamamlanır).

---

### 2.2 “Karar vermedi” akışı (senin tarifin)

1. Müşteri: “daha karar vermedik / düşünelim”
2. AI: nazik kapanış + net sonraki adım sorusu (tarih mi, paket mi?)
3. Hafızaya: `decision_status=undecided`, `next_check_at=şimdi+N`
4. Müşteri yazmazsa sistem yazar: “Belli oldu mu? Tarih netleştiyse hemen bakayım.”
5. `AI_FOLLOW_UP` kapalıysa sadece panel görevi oluşur.

---

### 2.3 Rezervasyon bilgi toplama checklist

AI rezervasyon için şunları **eksiksiz** toplamaya çalışır:

| Alan | Zorunlu mu | Not |
|------|------------|-----|
| Çekim / etkinlik tarihi | Evet | |
| Ad soyad | Evet | |
| Telefon | Evet | CRM’e de yazılır |
| Gelin adı | Varsa | Düğün işi |
| İç çekim saat | Evet (iç varsa) | |
| İç çekim konum | Evet | |
| Dış çekim saat | Varsa | |
| Dış çekim konum | Varsa | |
| Plato / paket | Evet | Katalogdan |
| Ekstralar (drone vb.) | Opsiyonel | Fiyat DB’den |
| Notlar | Opsiyonel | |

**Davranış:**
- Eksik alanı sırayla, tek tek sorar (mesaj yağmuru yapmaz).
- Müsaitlik çakışması varsa alternatif önerir (Scheduling servisi).
- Fiyatı her zaman `quote-from-db` ile söyler.

---

### 2.4 Otomatik rezervasyon kaydı

**Koşullar (hepsi):**
1. `AI_RESERVATION` açık  
2. Zorunlu alanlar dolu  
3. Güven skoru eşik üstü  
4. (İsteğe bağlı) düşük güvende insan onayı  

**Sonuç:**
- `reservations` + `reservation_items` oluşur  
- Timeline: “AI rezervasyon oluşturdu”  
- Bildirim: ekibe “yeni rezervasyon”  
- Müşteriye onay özeti mesajı

---

### 2.5 Neden rezervasyon olmuyor? + teklif motoru

**Periyot:** günlük özet + haftalık derin analiz (`sales_strategy` / `recommendation` — REASONING)

**Çıktı örnekleri (kanıtlı):**
- “Bu hafta 40 konuşmanın 12’si fiyat itirazında düştü (kanıt: conversation_analyses)”
- Öneri: “İlık lead’lerde plato ücretini kampanya olarak 0’la, paket fiyatını koru”
- Öneri: “Drone’u hediye göster, algılanan değeri artır”
- Öneri: “Cevap süresi 2 saati aşan lead’lerde dönüşüm düşüyor → follow-up hızlandır”

**Kurallar:**
- Bunlar **iş önerisidir**; fiyat/kampanya DB’ye AI tek başına yazmaz.
- Kampanya/fiyat değişikliği → admin onayı.

**Ekran:**
- AI Öğrenme + CEO’da “Kaçan rezervasyon nedenleri” kartı.

---

### 2.6 İkna / geri kazanım playbook’ları

- N güne göre senaryolar (1. gün yumuşak, 3. gün değer, 7. gün son dokunuş)
- Kaybeden pattern’ler `ai_mistakes` / playbook’a işlenir
- Kazanan konuşmalar örnek olarak asistan bağlamına girer (mevcut yapı güçlendirilir)

---

### Faz 2 çıkış kriteri
1. Undecided müşteri hafızada + otomatik “belli oldu mu?”  
2. Tipik rezervasyon bilgileri toplanabiliyor  
3. Anahtar açıksa rezervasyon kaydı oluşabiliyor  
4. Haftalık “neden olmuyor” raporu gerçek veriyle geliyor  
5. Dönüşmeyen lead’ler unutulmuyor  

---

## FAZ 3 — AI Meta Reklam Direktörü (detaylı)

### Amaç
Sen günlük bütçe verirsin; AI uzman reklamcı gibi düşünür, öğrenir, önerir, hataları bulur.

### İş değeri
Boşa giden reklam harcamasını azaltmak, hangi kreatifi/hangi kitleyi ölçeceğini bilmek, Instagram içeriğini reklama çevirmek.

### Değişmez sınır
AI **bütçeyi / kampanyayı kendi başına değiştirmez**. Öneri + onay. (`AI_ADS_AUTONOMY` ileride ayrı açılır.)

---

### 3.1 Attribution — “kim hangi reklama geldi”

**Hedef deneyim:**
- Müşteri kartında: kaynak kampanya / ad set / ad / kreatif  
- Rezervasyon ve ciro aynı zincire bağlı  
- Pazarlama panosunda: harcama → mesaj → müşteri → rezervasyon → ciro  

**Mevcut:** attribution tabloları ve matcher büyük ölçüde var.  
**Eksik:** bu verinin strateji motoruna sürekli geri beslenmesi; boş/yanlış eşleşmelerin kalite raporu.

---

### 3.2 Sıcak / ılık / soğuk strateji çerçevesi

| Kova | Kim | Tipik hedef | Tipik mesaj |
|------|-----|-------------|-------------|
| **Soğuk** | Tanımayan kitle, ilgi alanı, geniş lookalike | Trafik / etkileşim / mesaj (teste göre) | Marka + sosyal kanıt + güçlü hook |
| **Ilık** | Profil girenler, etkileşim, video izleyenler | Mesaj / dönüşüm | Güven + paket netliği + CTA |
| **Sıcak** | DM yazmış, site/lead, yarı kalmış | Mesaj / retarget | “Belli oldu mu?”, tarih, paket, sınırlı slot |

AI her gün:
- hangi kovaya ne kadar bütçe önerisi,
- hangi kreatiften kaç adet,
- hangi testi açık tutacağını
hesaplar.

---

### 3.3 Günlük bütçe zekâsı

**Girdi:** Senin girdiğin günlük bütçe (Settings veya Marketing).  
**Çıktı örneği:**
- Bütçe: 2000 TL  
- Öneri: 3 kreatif aktif, 2 strateji testi  
- Bölüşüm: %50 soğuk / %30 ılık / %20 sıcak  
- Durdur önerisi: Ad X (yüksek harcama, düşük rezervasyon)  
- Ölçekle önerisi: Ad Y (ucuz mesaj + iyi rezervasyon oranı)

**Model:** `marketing_strategy` + `campaign_analysis` (REASONING).  
**Kanıt:** son 7/14/30 gün metrikleri + attribution.

---

### 3.4 Karar alanları (AI’nin vereceği öneriler)

- Trafik mi, etkileşim mi, mesaj mı, dönüşüm mü?
- İlgi alanı mı, yaş kitlesi mi, lookalike mi, engagers mı?
- Kaç A/B testi sağlıklı? (bütçeye göre üst sınır)
- Hangi IG postu reklama çevrilmeli?
- Hangi metin/hook?
- Kreatif yorgun mu?

---

### 3.5 Kreatif motoru

**Faz 3a (hemen):**
- Mevcut Instagram medya kütüphanesinden öneri  
- “Şu postu al → şu metni yaz → şu kitleye vur” paketi  
- Stub olan `suggestInstagramContentCount` kaldırılır / gerçeklenir  

**Faz 3b (sonra):**
- Nano Banana / otomatik görsel üretimi  
- Üretimden önce “ne üretilmeli” kararı şart (kör üretim yok)

---

### 3.6 Öğrenme döngüsü (reklam)

Her gün / hafta:
1. Veri topla (Meta sync — mevcut)  
2. Analiz et (kampanya karnesi)  
3. Hata bul (yüksek CPL, düşük rezervasyon, yorgun kreatif)  
4. Öneri üret  
5. İnsan onaylasın  
6. Sonuç ölçülsün → `marketing_learnings`  
7. Ertesi gün bağlamına girsin  

**Kill switch:** `AI_MARKETING`

---

### Faz 3 çıkış kriteri
1. Attribution panosu güvenilir  
2. Günlük bütçe → strateji/kreatif öneri paketi  
3. Sıcak/ılık/soğuk önerileri kanıtlı  
4. IG post → reklam paketi önerisi  
5. Şablon strateji kalmamış  
6. Marketing kill switch çalışıyor  

---

## FAZ 4 — Model Router kalitesi + sahte AI temizliği

### Amaç
“AI” yazan her yerin gerçekten doğru model + gerçek veri kullanması.

### Yapılacaklar
1. Tüm call-site envanteri ve test (hangi task, hangi model).  
2. Marketing strategy generator → LLM.  
3. Instagram öneri stub → LLM + metrik.  
4. CEO/marketing raporlarına isteğe bağlı REASONING anlatı ekleme (deterministik iskelet + AI yorum; kanıt zorunlu).  
5. Maliyet dashboard kartı (görev başına).  
6. Complex katmanı için iç araçlar (şimdilik düşük öncelik).

### Bitiş kriteri
Kodda “hardcoded strateji metni / sabit confidence 35” kalmaz; `ai_runs`’da marketing/ceo/sales task’leri görünür.

---

## FAZ 5 — Otomasyonlar + boş sayfalar

### 5.1 Otomasyon motorunu işe yarar hale getir

Motor var, kural yok. Seed edilecek hazır kurallar (örnek):

1. Yeni sıcak lead → panel bildirimi  
2. 24 saat cevapsız konuşma → bildirim (+ follow-up görevi)  
3. Kapora doğrulandı → teşekkür follow-up (onaylı şablon)  
4. Yüksek opportunity score → satış alarmı  
5. Rezervasyon eksik konum/saat → operasyon bildirimi  
6. Dekont geldi → muhasebe/operasyon bildirimi  

UI geliştirme: çoklu koşul, zamanlayıcı (Faz 5 sonunda veya Faz 6).

### 5.2 Boş sayfalar

| Sayfa | Ne olacak |
|-------|-----------|
| **Settings** | AI kill switch’ler, günlük reklam bütçesi, follow-up günleri, varsayılanlar |
| **Leads** | `lead_profiles` listesi, sıcaklık, kaynak reklam, sonraki aksiyon |
| **Analytics** | Funnel, trend, kanal, rezervasyon dönüşümü |
| **Knowledge** | Onaylı bilgi + chunk/embedding durumu + arama |
| **Integrations** | ChatPlace / Meta / OpenAI sağlık, son sync, hata |

---

## FAZ 6 — Beyin ve öğrenme döngüsünü kapat

### Sorunlar (bugün)
- `sales_learnings` yazılıyor ama asistan okumuyor olabilir.  
- Marketing learnings rapor-only.  
- Konuşma embedding yok.  
- Öneri sonucu ölçülmüyor.

### Yapılacaklar
1. Tüm öğrenme tablolarının tüketici haritası (kim yazıyor, kim okuyor).  
2. Okunmayan çıktıları prompt/RAG’a bağla.  
3. Conversation embeddings + benzer kazanan konuşma.  
4. Recommendation Engine: öner → kabul/ret → sonuç → kalibrasyon.  
5. Haftalık self-improvement: hangi playbook/kadans/kreatif kazandı.

---

## FAZ 7 — Güvenlik ve platform sertleştirme

- RBAC (owner / admin / staff) — giren herkes admin olmasın  
- Meta token şifreleme  
- CI: tsc + lint + test  
- Supabase Storage (dekont dosyaları)  
- Ölü tablo temizliği + `full_database_setup.sql` senkronu  
- Dağıtık rate limit  

---

## FAZ 8 — Bilinçli sonraki dalga

- WhatsApp / E-posta  
- Nano Banana görsel üretim  
- Multi-tenant + billing (SaaS)  
- Workflow Engine (çok adımlı otonomi)  
- Predictive analytics (gelir, churn)  
- Voice AI  

---

## 5. Mükemmel uçtan uca akış (hedef)

```
Instagram mesajı
  → ChatPlace webhook (doğrula, kaydet, hızlı ACK)
  → CRM + Customer Intelligence + Sales skoru
  → Hafıza oku + RAG + Playbook + Rezervasyon bağlamı
  → AI Router (doğru model)
  → Güven + hassas konu kontrolü
  → Kill switch kontrolü
  → (gerekirse) Onay kuyruğu
  → Outbound gönder
  → Follow-up planla
  → (gece) Learning → Brain → Knowledge(onaylı) → Embeddings
  → Marketing Attribution güncelle
  → CEO / Marketing günlük öneriler
  → Self-improvement
```

---

## 6. Dashboard’larda ne görülecek? (hedef)

### CEO
- Bugünkü ciro / rezervasyon vs hedef  
- 3 risk + 3 fırsat (kanıtlı)  
- AI bugün ne yaptı (mesaj, follow-up, rezervasyon)  
- Onay bekleyenler  
- Kaçan rezervasyon nedenleri özeti  

### Pazarlama
- Harcama → mesaj → rezervasyon → ciro  
- Günlük bütçe öneri paketi  
- Sıcak/ılık/soğuk performans  
- Kreatif yorgunluk  
- IG → reklam önerileri  

### Satış / Inbox
- Sıcak fırsatlar  
- Bugünkü follow-up’lar (gönder / ertelesin)  
- Onay kuyruğu  
- AI taslak → düzenle → gönder  

### Operasyon
- Takvim / ekip doluluk  
- Eksik bilgili rezervasyonlar  
- Kapora bekleyenler  

### AI Brain / Öğrenme
- Bekleyen bilgi adayları  
- Aktif hatalar  
- Playbook performansı  
- Model maliyet  
- Kill switch durumu  

---

## 7. Uygulama sırası (sprint planı)

### Sprint A (şimdi — Faz 1 çekirdek)
1. Settings + kill switch’ler  
2. Model env + router doğrulama  
3. Outbound araştırma + teslimat katmanı  
4. Follow-up gerçek gönderim (veya köprü)  
5. Onay kapısı (göndermeden önce)  
6. Sync pipeline bağlama  

### Sprint B (Faz 2)
7. Undecided hafıza + “belli oldu mu?”  
8. Rezervasyon checklist toplama  
9. Otomatik rezervasyon (flag’li)  
10. Neden olmuyor + teklif kartları  
11. İkna kadansı  

### Sprint C (Faz 3)
12. Attribution kalite  
13. Sıcak/ılık/soğuk + bütçe önerisi  
14. Kampanya analiz AI  
15. IG kreatif öneri  
16. Marketing learnings geri besleme  

### Sprint D (Faz 4–5)
17. Sahte AI temizliği  
18. Otomasyon seed kuralları  
19. Leads / Analytics / Knowledge / Integrations  

### Sprint E (Faz 6–7)
20. Öğrenme tüketim haritası kapatma  
21. RBAC + token şifreleme + CI  

---

## 8. Riskler ve bağımlılıklar

| Risk | Etki | Plan |
|------|------|------|
| ChatPlace mesaj gönderemiyor | Faz 1 blok | Meta API / ChatPlace otomasyon köprüsü |
| LLM maliyeti | Bütçe | FAST/DEFAULT ayrımı + günlük maliyet alarmı |
| Yanlış otonom rezervasyon | Müşteri güveni | `AI_RESERVATION` + güven eşiği + onay |
| Yanlış reklam önerisi | Harcama | Sadece öneri; uygulama ayrı flag |
| Halüsinasyon | Marka | Grounding + kanıt zorunlu + fiyat DB |

---

## 9. Bilinçli olarak bu planda OLMAYANLAR

- Multi-company SaaS (ayrı faz)  
- Stripe abonelik faturalama  
- AI’nin reklama tek başına bütçe basması  
- Fiyatı LLM’in uydurması  
- WhatsApp (Faz 8’e kadar)  

---

## 10. “Bitti” tanımı — ürün sahibi için

Şu cümleleri kurabiliyorsan sistem çalışıyor demektir:

1. “AI’yi paneldan kapattım, mesaj gelince susuyor.”  
2. “Follow-up gerçekten müşteriye gitti.”  
3. “Bu müşteri şu reklama gelmiş, rezervasyon oldu.”  
4. “Bugünkü bütçeme göre AI 3 kreatif / 2 strateji önerdi.”  
5. “Karar vermeyen müşteri 3 gün sonra soruldu.”  
6. “Eksik saat/konum tamamlanınca rezervasyon oluştu.”  
7. “DM ucuz model, strateji pahalı/akıllı model kullanıyor.”  

---

## 11. Sonraki adım

Bu belge onaylandığında uygulama **Sprint A / madde 1 (Kill switch + Settings)** ile başlar.

Onay için cevap yeterli: **“47 onay, başla”**  
Revizyon için: hangi fazı büyütmem / küçültmem gerektiğini yaz.
