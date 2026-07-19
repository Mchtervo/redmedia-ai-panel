import type {
  CeoMetricsSnapshot,
  CeoRecommendationItem,
  CeoRiskItem,
} from "@/features/ceo-intelligence/types";
import { formatTry } from "@/features/ceo-intelligence/utils/time";

/** Kural tabanlı yönetim önerileri — yalnızca tavsiye. */
export function buildCeoRecommendations(
  metrics: CeoMetricsSnapshot,
  risks: CeoRiskItem[]
): CeoRecommendationItem[] {
  const recs: CeoRecommendationItem[] = [];

  if (metrics.topCampaignsByAttribution[0]) {
    const top = metrics.topCampaignsByAttribution[0];
    recs.push({
      id: "top-campaign",
      category: "campaign",
      title: "Dönemin en aktif reklam atfı",
      detail: `"${top.label}" ${top.count} olayla önde. Bütçe kararını admin verir; sistem değiştirmez.`,
    });
  } else if (metrics.dataGaps.some((g) => g.includes("attribution"))) {
    recs.push({
      id: "attr-gap",
      category: "campaign",
      title: "Reklam atıf verisi eksik",
      detail:
        "Hangi reklamın daha çok müşteri getirdiği şu an ölçülemiyor. Attribution bağlandığında burada görünecek.",
    });
  }

  if (metrics.topPackages[0]) {
    recs.push({
      id: "top-package",
      category: "sales",
      title: "En çok tercih edilen hizmet",
      detail: `"${metrics.topPackages[0].label}" önde (${metrics.topPackages[0].count}). Paket vurgusu satışta kullanılabilir.`,
    });
  }

  if (metrics.freeDaysThisWeek.length > 0) {
    recs.push({
      id: "free-days",
      category: "capacity",
      title: "Bu hafta boş günler",
      detail: `Boş günler: ${metrics.freeDaysThisWeek.join(", ")}. Takvim doldurma / kampanya zamanlaması için fırsat.`,
    });
  }

  if (metrics.busyDaysAhead.some((d) => d.count >= 3)) {
    recs.push({
      id: "capacity-warning",
      category: "capacity",
      title: "Personel kapasitesi",
      detail:
        "Yaklaşan yoğun günlerde ek atama ve çakışma kontrolü önerilir (atama yine admin).",
    });
  }

  if (metrics.awaitingDeposit + metrics.awaitingReceiptReview > 0) {
    recs.push({
      id: "pipeline-cash",
      category: "follow_up",
      title: "Tahsilat hattını temizle",
      detail: `${metrics.awaitingDeposit} kapora + ${metrics.awaitingReceiptReview} dekont bekliyor. Öncelik paneli: Ödemeler.`,
    });
  }

  for (const hot of metrics.hotOpportunities.slice(0, 2)) {
    recs.push({
      id: `follow-${hot.contactId}`,
      category: "follow_up",
      title: `Takip: ${hot.name}`,
      detail: `Opportunity ${hot.opportunityScore}. Inbox veya müşteri kartından devam.`,
    });
  }

  if (risks.some((r) => r.id.startsWith("cancel-risk"))) {
    recs.push({
      id: "risk-customers",
      category: "ops",
      title: "Riskli müşterilere insan teması",
      detail:
        "İptal riski etiketli müşterilerde AI yerine personel araması önerilir.",
    });
  }

  if (metrics.salesToday < metrics.salesYesterday && metrics.salesYesterday > 0) {
    recs.push({
      id: "sales-dip",
      category: "sales",
      title: "Günlük satış temposu dününden düşük",
      detail: `Bugün ${metrics.salesToday}, dün ${metrics.salesYesterday} onay/güncelleme. Inbox ve sıcak skorları kontrol edin.`,
    });
  }

  if (metrics.pendingCollections > 0) {
    recs.push({
      id: "collections",
      category: "ops",
      title: "Bekleyen tahsilatlar",
      detail: `${formatTry(metrics.pendingCollections)} kalan ödeme (${metrics.pendingCollectionsCount} kayıt).`,
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: "baseline",
      category: "general",
      title: "Veri biriktikçe öneriler netleşir",
      detail:
        "Rezervasyon, atıf ve CRM doldukça kampanya / paket / kapasite önerileri burada listelenir.",
    });
  }

  return recs.slice(0, 10);
}

export function buildSummaryBullets(metrics: CeoMetricsSnapshot): string[] {
  const bullets = [
    `Bugün ${metrics.newCustomersToday} yeni müşteri yazdı`,
    `${metrics.activeConversations} aktif konuşma var`,
    `${metrics.awaitingDeposit} müşteri kapora bekliyor`,
    `${metrics.awaitingReceiptReview} dekont onay bekliyor`,
    `Bugün ${metrics.shootsToday} çekim var`,
    `${metrics.staffOnDutyToday} personel görevli, ${metrics.staffIdleToday} boşta`,
    `Bugünkü tahmini ciro: ${formatTry(metrics.estimatedRevenueToday)}`,
    `Bu haftaki tahmini ciro: ${formatTry(metrics.estimatedRevenueThisWeek)}`,
    `Bekleyen tahsilat: ${formatTry(metrics.pendingCollections)} (${metrics.pendingCollectionsCount} kayıt)`,
  ];

  if (metrics.hotOpportunities[0]) {
    bullets.push(
      `En sıcak fırsat: ${metrics.hotOpportunities[0].name} (skor ${metrics.hotOpportunities[0].opportunityScore})`
    );
  }

  return bullets;
}
