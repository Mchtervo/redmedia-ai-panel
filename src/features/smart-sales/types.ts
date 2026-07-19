export const LIFECYCLE_STAGES = [
  "new_customer",
  "gathering_info",
  "price_given",
  "negotiating",
  "awaiting_reservation",
  "awaiting_deposit",
  "awaiting_receipt",
  "reservation_confirmed",
  "shoot_completed",
  "delivery",
  "completed",
  "cancelled",
  "passive",
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  new_customer: "Yeni Müşteri",
  gathering_info: "Bilgi Alıyor",
  price_given: "Fiyat Verildi",
  negotiating: "Pazarlık Yapıyor",
  awaiting_reservation: "Rezervasyon Bekleniyor",
  awaiting_deposit: "Kapora Bekleniyor",
  awaiting_receipt: "Dekont Bekleniyor",
  reservation_confirmed: "Rezervasyon Onaylandı",
  shoot_completed: "Çekim Tamamlandı",
  delivery: "Teslim Sürecinde",
  completed: "Tamamlandı",
  cancelled: "İptal",
  passive: "Pasif Müşteri",
};

/** AI konuşma tonu ipuçları — aşamaya göre. */
export const LIFECYCLE_TONE_HINTS: Record<LifecycleStage, string> = {
  new_customer:
    "İlk temas: sıcak tebrik, kısa sorular; hemen fiyat dökme.",
  gathering_info:
    "Bilgi topla: tarih, hizmet, mekân; netleşmeden ayrıntılı paket dayatma.",
  price_given:
    "Fiyat verildi: soruları yanıtla, kapora sürecini nazikçe hatırlat; baskı yapma.",
  negotiating:
    "Pazarlık: indirim uydurma; paket/hizmet düzeni öner; insan onayına bırak.",
  awaiting_reservation:
    "Rezervasyon bekleniyor: tarih/telefon netleştir, IBAN öncesi eksikleri kapat.",
  awaiting_deposit:
    "Kapora bekleniyor: IBAN/kapora bilgisini hatırlat, kesinleşmeyi söyleme.",
  awaiting_receipt:
    "Dekont bekleniyor: dekont paylaşımını nazikçe iste; ödeme kesin geçti deme.",
  reservation_confirmed:
    "Rezervasyon onaylı: detayları netleştir, güven ver; satış baskısı yok.",
  shoot_completed:
    "Çekim bitti: teşekkür et, teslim sürecini açıkla.",
  delivery:
    "Teslim: süre/kalite beklentisini yönet, şikâyette ekibe yönlendir.",
  completed:
    "Tamamlandı: teşekkür, yorum/referans isteyebilirsin; satış dayatma.",
  cancelled:
    "İptal: nazik ol, yeniden satış baskısı yapma; kapı açık bırak.",
  passive:
    "Pasif: kısa, nazik hatırlatma; spam gibi görünme.",
};

export const SALES_TAG_OPTIONS = [
  "sıcak müşteri",
  "yüksek bütçe",
  "düşük bütçe",
  "pazarlıkçı",
  "hızlı karar veren",
  "kararsız",
  "tekrar gelen",
  "referans müşteri",
  "acil tarih",
  "VIP",
  "riskli müşteri",
] as const;

export type SalesTag = (typeof SALES_TAG_OPTIONS)[number];
