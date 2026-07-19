/**
 * Attribution dashboard → IntelligenceBrief (kanıtlı).
 */
import type { AttributionDashboard } from "@/features/marketing/services/attribution-dashboard.service";
import { formatTry } from "@/features/ceo-intelligence/utils/time";
import {
  makeBrief,
  type IntelligenceBrief,
  type IntelligenceEvidenceItem,
} from "@/features/intelligence/types";

function dashEvidence(
  dash: AttributionDashboard
): IntelligenceEvidenceItem[] {
  const s = dash.summary;
  return [
    {
      label: "Dönem",
      value: `${dash.range.start} — ${dash.range.end}`,
    },
    { label: "Kampanya", value: String(dash.campaigns.length) },
    { label: "DM", value: String(s.dm) },
    { label: "Lead", value: String(s.lead) },
    { label: "Rezervasyon", value: String(s.reservation) },
    { label: "Kapora", value: String(s.kapora) },
    { label: "Çekim", value: String(s.shoot) },
    { label: "Harcama", value: formatTry(s.totalSpend) },
    { label: "Kesin gelir", value: formatTry(s.revenueExact) },
    {
      label: "Exact attribution",
      value: String(s.byStatus.exact ?? 0),
    },
    {
      label: "Olası kaynak",
      value: String(s.byStatus.probable ?? 0),
    },
    {
      label: "Unknown",
      value: String(s.byStatus.unknown ?? 0),
    },
  ];
}

export function buildMarketingIntelligenceBriefs(
  dash: AttributionDashboard
): IntelligenceBrief[] {
  const briefs: IntelligenceBrief[] = [];
  const evidence = dashEvidence(dash);
  const s = dash.summary;
  const hasCore =
    dash.campaigns.length > 0 ||
    s.dm + s.lead + s.reservation + s.kapora > 0;

  if ((s.byStatus.unknown ?? 0) > 3) {
    briefs.push(
      makeBrief({
        id: "mkt-unknown-src",
        domain: "attribution",
        priority: "high",
        confidenceBand: "exact",
        title: "Bilinmeyen müşteri kaynağı",
        summary: `${s.byStatus.unknown} müşteride kaynak unknown.`,
        why: `customer_attributions tablosunda ${s.byStatus.unknown} unknown kayıt sayıldı.`,
        whatNext: "ROI hesabı eksik kalır; bütçe yanlış yönlenebilir.",
        doNow: "Müşteri kartlarından manuel kaynak atayın veya UTM/fbclid toplayın.",
        evidence,
        href: "/dashboard/marketing/attribution",
        hrefLabel: "Attribution",
      })
    );
  }

  if ((s.byStatus.probable ?? 0) > 0) {
    briefs.push(
      makeBrief({
        id: "mkt-probable",
        domain: "attribution",
        priority: "medium",
        confidenceBand: "probable",
        title: "Olası kaynak gelirleri ayrı",
        summary: `${s.byStatus.probable} olası eşleşme; ${formatTry(s.revenueProbableExcluded)} gelir ROI dışı.`,
        why: `Probable attribution sayısı ${s.byStatus.probable}; bu gelir exact ROI’ye eklenmedi.`,
        whatNext:
          "Olası kaynaklar exact gibi okunursa kampanya performansı yanlış yorumlanır.",
        doNow: "Olası kayıtları timeline’dan doğrulayın; emin değilseniz exact yapmayın.",
        evidence,
        href: "/dashboard/marketing/attribution",
      })
    );
  }

  if (s.roi != null && s.roi < 0 && s.totalSpend > 0) {
    briefs.push(
      makeBrief({
        id: "mkt-neg-roi",
        domain: "marketing",
        priority: "high",
        confidenceBand:
          (s.byStatus.exact ?? 0) + (s.byStatus.manual ?? 0) > 0
            ? "exact"
            : "insufficient",
        title: "Kesin gelir bazlı ROI negatif",
        summary: `Harcama ${formatTry(s.totalSpend)}, kesin gelir ${formatTry(s.revenueExact)}.`,
        why: `Exact/manual funnel gelirinden hesaplanan ROI ${(s.roi * 100).toFixed(1)}%.`,
        whatNext:
          "Düşük kapora dönüşümlü kampanyalar büyütülürse zarar artabilir.",
        doNow:
          "Kampanya tablosunda kapora/gelir sütunlarını inceleyin; bütçe kararını siz verin.",
        evidence,
        href: "/dashboard/marketing/attribution",
      })
    );
  }

  const top = dash.campaigns[0];
  if (top && (top.kapora > 0 || top.revenue > 0)) {
    briefs.push(
      makeBrief({
        id: "mkt-top-camp",
        domain: "marketing",
        priority: "low",
        confidenceBand: top.revenue > 0 ? "exact" : "probable",
        title: `Önde: ${top.campaignName}`,
        summary: `Kapora ${top.kapora}, kesin gelir ${formatTry(top.revenue)}, harcama ${formatTry(top.spend)}.`,
        why: `Kampanya attribution satırından okunan kapora/gelir değerleri.`,
        whatNext: "Benzer kreatif test edilmezse öğrenim birikmez.",
        doNow: "Deneyler sayfasından kontrollü hipotez açmayı değerlendirin.",
        evidence: [
          ...evidence,
          { label: "Kampanya", value: top.campaignName },
          { label: "Kapora", value: String(top.kapora) },
          { label: "Kesin gelir", value: formatTry(top.revenue) },
        ],
        href: "/dashboard/marketing/experiments",
        hrefLabel: "Deneyler",
      })
    );
  }

  if (briefs.length === 0) {
    briefs.push(
      makeBrief({
        id: "mkt-baseline",
        domain: "marketing",
        priority: "low",
        confidenceBand: hasCore ? "probable" : "insufficient",
        title: "Pazarlama sinyali",
        summary: hasCore
          ? "Temel metrikler var; güçlü ROI/kaynak uyarısı yok."
          : "Gösterilecek güçlü attribution sinyali yok.",
        why: hasCore
          ? "Kampanya/DM/lead sayıları mevcut; kritik eşik aşılmadı."
          : "Attribution / kampanya verisi yetersiz.",
        whatNext: "Veri gelmeden bütçe kararı spekülatif kalır.",
        doNow: "Meta sync ve funnel yenilemeyi çalıştırın.",
        evidence,
        href: "/dashboard/marketing/connections",
        hrefLabel: "Bağlantılar",
      })
    );
  }

  return briefs.slice(0, 8);
}
