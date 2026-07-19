# 48 — Sistem Durum Raporu (Sprint A sonrası)

Tarih: 2026-07-18  
Kaynak plan: `docs/47_EXECUTION_PLAN.md`

---

## Bu turda yapılanlar

### 1) AI evren anahtarları (kill switch)
- Ayarlar sayfası artık gerçek: `/dashboard/settings`
- Bayraklar `business_settings.settings.ai_flags` içinde saklanır
- Anahtarlar: MASTER, DM, LEARNING, BRAIN, FOLLOW_UP, RESERVATION, MARKETING, CEO
- Günlük reklam bütçesi de aynı ekrandan kaydedilir
- Bağlandığı yerler: DM asistanı, öğrenme cron, follow-up cron, marketing strateji, CEO asistanı

### 2) Onay kapısı (göndermeden önce)
- Şikayet / indirim / iptal / pazarlık / özel fiyat → **nötr ara cevap**
- Nihai satış cevabı üretilmez; onay kuyruğu **önce** oluşur
- Müşteriye giden metin: “Talebiniz ilgili ekibe iletildi…”

### 3) Follow-up
- `AI_FOLLOW_UP` kapalıysa kuyruk işlenmez
- Açıkken vadesi gelen görev → `queued` + **panel bildirimi**
- ChatPlace’te mesaj gönderme aracı olmadığı için Instagram’a otomatik push yok
- “Karar vermedik / düşünelim” → 72s sonra “Belli oldu mu?” taslağı

### 4) ChatPlace sync → CRM
- Incremental sync’te yeni inbound mesaj → CRM profil + smart-sales + timeline
- AI otomatik cevap sync’te yok (bilinçli)

### 5) Marketing AI
- Strateji üretimi artık `marketing_strategy` (REASONING) LLM çağrısı
- Günlük bütçe + metrik + attribution bağlamı
- Sıcak/ılık/soğuk kova önerisi prompt’ta
- Instagram kreatif adayları insight skoruna göre (stub kaldırıldı)

### 6) Boş sayfalar dolduruldu
- Leads, Analytics, Integrations, Settings

### 7) Otomasyon seed
- Migration: `20260718000035_automation_rule_seeds.sql` (6 kural)
- Supabase’e uygulamanız gerekir

---

## Hâlâ bilinçli eksik / sınır

| Konu | Durum |
|------|--------|
| Panelden Instagram’a personel mesajı | Yok (ChatPlace outbound API yok) |
| Follow-up’ın müşteriye otomatik gitmesi | Yok — panel bildirimi + kuyruk |
| Otomatik rezervasyon kaydı | Bayrak var, varsayılan **kapalı**; tam akış sonraki sprint |
| Reklam bütçesini Meta’da değiştirme | Yok (kural gereği) |
| Nano Banana görsel | Yok |
| Multi-tenant / billing | Yok |

---

## Sprint B (devam — 2026-07-18)

### Outbound gerçeği (doğrulandı)
ChatPlace MCP’de **mesaj gönderme aracı yok** (50 araç tarandı).  
Canlı gönderim yolu yalnızca webhook cevabı `data.reply`.

### Yapılanlar
- Follow-up paneli: kopyala → Inbox → “Gönderildi işaretle / Atla”
- Rezervasyon AI: mesajdan saat/mekân çıkarımı, eksik alan listesi prompt’ta
- `AI_RESERVATION` açıksa + onay niyeti + tarih/tel/ad doluysa taslak → `pending_customer` + bildirim
- Marketing: günlük bütçe planı kartı (kaç kreatif / kaç test / soğuk-ılık-sıcak bölüşüm)

### Hâlâ yok
- Instagram’a panelden otomatik push (ChatPlace API sınır)
- Meta’da otomatik bütçe uygulama (bilinçli)

---

## Sahibin yapması gerekenler

1. `.env.local` → `OPENAI_MODEL_FAST/DEFAULT/REASONING/COMPLEX/EMBEDDING` doldur  
2. Migration seed’i uygula: `20260718000035_automation_rule_seeds.sql`  
3. Panel → Ayarlar → AI kontrollerini kontrol et  
4. İstersen **AI_RESERVATION**’ı aç (varsayılan kapalı — dikkatli)  
5. Follow-up: kuyrukta “Kopyala” ile manuel gönderim köprüsünü kullan
