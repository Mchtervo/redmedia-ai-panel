/**
 * CEO metrik/risk → profesyonel IntelligenceBrief.
 * Yalnızca ölçülen değerler evidence'a girer; uydurma yok.
 */
import type {
  CeoMetricsSnapshot,
  CeoRiskItem,
} from "@/features/ceo-intelligence/types";
import { formatTry } from "@/features/ceo-intelligence/utils/time";
import {
  makeBrief,
  type IntelligenceBrief,
  type IntelligenceEvidenceItem,
} from "@/features/intelligence/types";

function ceoBaseEvidence(
  metrics: CeoMetricsSnapshot
): IntelligenceEvidenceItem[] {
  return [
    { label: "Rapor günü", value: metrics.reportDate },
    { label: "Yeni müşteri (bugün)", value: String(metrics.newCustomersToday) },
    { label: "Aktif konuşma", value: String(metrics.activeConversations) },
    { label: "Kapora bekleyen", value: String(metrics.awaitingDeposit) },
    {
      label: "Dekont bekleyen",
      value: String(metrics.awaitingReceiptReview),
    },
    { label: "Bugün çekim", value: String(metrics.shootsToday) },
    {
      label: "Bu ay rezervasyon",
      value: String(metrics.reservationsThisMonth),
    },
  ];
}

export function buildCeoIntelligenceBriefs(
  metrics: CeoMetricsSnapshot,
  risks: CeoRiskItem[]
): IntelligenceBrief[] {
  const briefs: IntelligenceBrief[] = [];
  const base = ceoBaseEvidence(metrics);
  const hasOpsSignal =
    metrics.awaitingReceiptReview +
      metrics.awaitingDeposit +
      metrics.shootsToday +
      metrics.pendingCollectionsCount >
    0;

  if (metrics.awaitingReceiptReview > 0) {
    briefs.push(
      makeBrief({
        id: "ceo-receipts",
        domain: "ops",
        priority: metrics.awaitingReceiptReview >= 3 ? "high" : "medium",
        confidenceBand: "exact",
        title: "Dekont kuyruğu",
        summary: `${metrics.awaitingReceiptReview} dekont onay bekliyor.`,
        why: `Ödeme panosunda ${metrics.awaitingReceiptReview} dekont inceleme bekliyor.`,
        whatNext:
          "Onay gecikirse rezervasyon kesinleşmesi ve müşteri takibi yavaşlar.",
        doNow: "Ödemeler panelinden bekleyen dekontları inceleyin.",
        evidence: [
          ...base,
          {
            label: "Dekont bekleyen",
            value: String(metrics.awaitingReceiptReview),
          },
        ],
        href: "/dashboard/payments",
        hrefLabel: "Ödemeler",
      })
    );
  }

  if (metrics.awaitingDeposit > 0) {
    briefs.push(
      makeBrief({
        id: "ceo-deposits",
        domain: "sales",
        priority: metrics.awaitingDeposit >= 5 ? "high" : "medium",
        confidenceBand: "exact",
        title: "Kapora bekleyen müşteriler",
        summary: `${metrics.awaitingDeposit} müşteri kapora aşamasında.`,
        why: `CRM’de ${metrics.awaitingDeposit} kapora bekleyen kayıt sayıldı.`,
        whatNext: "Takip edilmezse fırsat soğuyabilir veya tarih kaçabilir.",
        doNow: "Kapora bekleyen müşterileri kontrol edip hatırlatma yapın.",
        evidence: [
          ...base,
          { label: "Kapora bekleyen", value: String(metrics.awaitingDeposit) },
        ],
        href: "/dashboard/customers",
        hrefLabel: "Müşteriler",
      })
    );
  }

  if (metrics.shootsToday > 0) {
    briefs.push(
      makeBrief({
        id: "ceo-shoots-today",
        domain: "ops",
        priority: "medium",
        confidenceBand: "exact",
        title: "Bugün çekim",
        summary: `Bugün ${metrics.shootsToday} çekim; ${metrics.staffOnDutyToday} personel görevli.`,
        why: `Rezervasyon takviminden bugün ${metrics.shootsToday} çekim okundu.`,
        whatNext: "Atama eksikliği günü riske sokabilir.",
        doNow: "Bugünkü rezervasyon ve personel atamalarını doğrulayın.",
        evidence: [
          ...base,
          { label: "Bugün çekim", value: String(metrics.shootsToday) },
          {
            label: "Personel görevli",
            value: String(metrics.staffOnDutyToday),
          },
        ],
        href: "/dashboard/reservations",
        hrefLabel: "Rezervasyonlar",
      })
    );
  }

  if (metrics.topCampaignsByAttribution[0]) {
    const top = metrics.topCampaignsByAttribution[0];
    briefs.push(
      makeBrief({
        id: "ceo-top-campaign",
        domain: "marketing",
        priority: "low",
        confidenceBand: "probable",
        title: "Önde giden reklam atfı",
        summary: `"${top.label}" ${top.count} atıf olayıyla önde (kampanya kalitesi ayrıca doğrulanmalı).`,
        why: `Attribution özetinde "${top.label}" ${top.count} olayla listeleniyor.`,
        whatNext:
          "Bütçe kararı exact gelir/ROI görülmeden verilirse risk artar.",
        doNow: "Attribution dashboard’da exact gelir ve ROI’yi kontrol edin.",
        evidence: [
          { label: "Kampanya", value: top.label },
          { label: "Atıf olay sayısı", value: String(top.count) },
          { label: "Rapor günü", value: metrics.reportDate },
        ],
        href: "/dashboard/marketing/attribution",
        hrefLabel: "Attribution",
      })
    );
  }

  if (metrics.pendingCollections > 0) {
    briefs.push(
      makeBrief({
        id: "ceo-collections",
        domain: "ops",
        priority: "high",
        confidenceBand: "exact",
        title: "Bekleyen tahsilatlar",
        summary: `${formatTry(metrics.pendingCollections)} kalan ödeme (${metrics.pendingCollectionsCount} kayıt).`,
        why: `Rezervasyonlardan ${metrics.pendingCollectionsCount} kayıtta kalan ödeme hesaplandı.`,
        whatNext: "Tahsilat gecikirse nakit akışı ve teslim süreci geriler.",
        doNow: "Kalan ödemesi olan rezervasyonları kontrol edin.",
        evidence: [
          {
            label: "Bekleyen tahsilat",
            value: formatTry(metrics.pendingCollections),
          },
          {
            label: "Kayıt sayısı",
            value: String(metrics.pendingCollectionsCount),
          },
        ],
        href: "/dashboard/reservations",
        hrefLabel: "Rezervasyonlar",
      })
    );
  }

  for (const hot of metrics.hotOpportunities.slice(0, 3)) {
    briefs.push(
      makeBrief({
        id: `ceo-hot-${hot.contactId}`,
        domain: "sales",
        priority: hot.opportunityScore >= 70 ? "high" : "medium",
        confidenceBand: "probable",
        title: `Sıcak fırsat: ${hot.name}`,
        summary: `Opportunity ${hot.opportunityScore}/100 · aşama ${hot.lifecycleStage}.`,
        why: `CRM skor/aşama alanlarından okundu; reklam atfı bu kartta doğrulanmadı.`,
        whatNext: "Takip gecikirse skor düşebilir.",
        doNow: "Müşteri kartından son mesajı okuyup net sonraki adım belirleyin.",
        evidence: [
          { label: "Opportunity", value: String(hot.opportunityScore) },
          { label: "Aşama", value: hot.lifecycleStage },
          ...(hot.tags[0]
            ? [{ label: "Etiket", value: hot.tags.slice(0, 3).join(", ") }]
            : []),
        ],
        href: `/dashboard/customers/${hot.contactId}`,
        hrefLabel: "Müşteri",
      })
    );
  }

  for (const risk of risks.slice(0, 4)) {
    briefs.push(
      makeBrief({
        id: `ceo-risk-${risk.id}`,
        domain: "ceo",
        priority:
          risk.severity === "critical"
            ? "critical"
            : risk.severity === "high"
              ? "high"
              : "medium",
        confidenceBand: "exact",
        title: risk.title,
        summary: risk.detail,
        why: risk.detail,
        whatNext:
          risk.severity === "critical" || risk.severity === "high"
            ? "Müdahale edilmezse operasyon veya gelir riski büyüyebilir."
            : "İzlenmezse sorun birikebilir.",
        doNow: risk.href
          ? "İlgili panele gidip kaydı inceleyin."
          : "İlgili ekibi bilgilendirin; AI otomatik işlem yapmaz.",
        evidence: [
          { label: "Risk seviyesi", value: risk.severity },
          { label: "Rapor günü", value: metrics.reportDate },
          {
            label: "Aktif konuşma",
            value: String(metrics.activeConversations),
          },
        ],
        href: risk.href,
      })
    );
  }

  if (briefs.length === 0) {
    briefs.push(
      makeBrief({
        id: "ceo-baseline",
        domain: "general",
        priority: "low",
        confidenceBand: hasOpsSignal ? "exact" : "insufficient",
        title: "Kritik birikmiş işlem yok",
        summary: hasOpsSignal
          ? "Ölçülen metrikler mevcut; kritik eşik aşılmadı."
          : "Gösterilecek güçlü operasyon sinyali sınırlı.",
        why: hasOpsSignal
          ? "Kapora/dekont/çekim sayıları eşik altında."
          : "Yeterli operasyon birikimi ölçülmedi.",
        whatNext: "Veri geldikçe risk ve fırsat kartları burada listelenir.",
        doNow: "Inbox ve bugünkü rezervasyonları yine de gözden geçirin.",
        evidence: base,
        href: "/dashboard/inbox",
        hrefLabel: "Inbox",
      })
    );
  }

  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return briefs
    .sort((a, b) => order[a.priority] - order[b.priority])
    .slice(0, 12);
}
