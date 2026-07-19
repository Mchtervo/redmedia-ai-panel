/**
 * Müşteri kartı → tek IntelligenceBrief (kanıtlı).
 */
import type { CustomerProfile } from "@/features/customer-intelligence/types";
import {
  LIFECYCLE_STAGE_LABELS,
  type LifecycleStage,
} from "@/features/smart-sales/types";
import {
  bandFromAttributionStatus,
  makeBrief,
  type IntelligenceBrief,
  type IntelligenceEvidenceItem,
} from "@/features/intelligence/types";

type AttributionHint = {
  attribution_status?: string | null;
  attribution_confidence?: number | null;
  source_type?: string | null;
} | null;

export function buildCustomerIntelligenceBrief(
  profile: CustomerProfile,
  contactId: string,
  attribution: AttributionHint = null
): IntelligenceBrief {
  const stage = (profile.lifecycle_stage as LifecycleStage) ?? "new_customer";
  const stageLabel = LIFECYCLE_STAGE_LABELS[stage] ?? stage;
  const score = profile.opportunity_score ?? profile.lead_score ?? 0;
  const tags = profile.tags ?? [];
  const risky = tags.some((t) => /risk|iptal/i.test(t));
  const awaitingDeposit =
    stage === "awaiting_deposit" || tags.some((t) => /kapora/i.test(t));

  const attrBand = bandFromAttributionStatus(attribution?.attribution_status);
  const evidence: IntelligenceEvidenceItem[] = [
    { label: "Aşama", value: stageLabel },
    { label: "Opportunity", value: `${score}/100` },
    { label: "Mesaj", value: String(profile.total_messages) },
    { label: "Konuşma", value: String(profile.total_conversations) },
    ...(profile.booking_probability != null
      ? [
          {
            label: "Rezervasyon ihtimali",
            value: `%${profile.booking_probability}`,
          },
        ]
      : []),
    ...(tags.length
      ? [{ label: "Etiketler", value: tags.slice(0, 5).join(", ") }]
      : []),
    ...(attribution?.attribution_status
      ? [
          {
            label: "Attribution",
            value: attribution.attribution_status,
          },
        ]
      : []),
    ...(attribution?.source_type
      ? [{ label: "Kaynak tipi", value: attribution.source_type }]
      : []),
  ];

  if (risky) {
    return makeBrief({
      id: `cust-risk-${contactId}`,
      domain: "sales",
      priority: "high",
      confidenceBand: attrBand === "exact" ? "exact" : "probable",
      title: "Riskli müşteri sinyali",
      summary: `Etiket/aşama risk gösteriyor (${stageLabel}).`,
      why: `CRM etiketlerinde risk sinyali var. İtiraz alanı: ${profile.objections?.trim() || "kayıt yok"}.`,
      whatNext:
        "AI tek başına fiyat/indirim vermemeli; müşteri soğuyabilir veya iptal edebilir.",
      doNow: "İnsan teması kurun; şikâyet/indirim talebini siz yönetin.",
      evidence,
      href: `/dashboard/customers/${contactId}`,
    });
  }

  if (awaitingDeposit) {
    return makeBrief({
      id: `cust-deposit-${contactId}`,
      domain: "sales",
      priority: "high",
      confidenceBand: "exact",
      title: "Kapora bekleniyor",
      summary: `Aşama ${stageLabel}; opportunity ${score}/100.`,
      why: `Lifecycle aşaması kapora bekliyor olarak kayıtlı.`,
      whatNext: "Hatırlatma yapılmazsa rezervasyon kesinleşmeyebilir.",
      doNow: "IBAN/kapora mesajını doğrulayın; gerekirse hatırlatma gönderin.",
      evidence,
      href: "/dashboard/payments",
      hrefLabel: "Ödemeler",
    });
  }

  if (stage === "negotiating" || score >= 70) {
    return makeBrief({
      id: `cust-hot-${contactId}`,
      domain: "sales",
      priority: "high",
      confidenceBand: attrBand === "insufficient" ? "probable" : attrBand,
      title: "Sıcak / pazarlık aşaması",
      summary: `Opportunity ${score}/100 · ${stageLabel}.`,
      why: `Skor ve lifecycle alanlarından sıcak/pazarlık sinyali okundu.`,
      whatNext: "Net teklif gecikirse skor düşebilir.",
      doNow: "Paket ve müsaitliği netleştirin; fiyatı katalogdan doğrulayın.",
      evidence: [
        ...evidence,
        ...(profile.budget
          ? [{ label: "Bütçe notu", value: profile.budget }]
          : []),
      ],
    });
  }

  if (stage === "shoot_completed" || stage === "delivery") {
    return makeBrief({
      id: `cust-delivery-${contactId}`,
      domain: "ops",
      priority: "medium",
      confidenceBand: "exact",
      title: "Teslim / çekim sonrası",
      summary: `Aşama: ${stageLabel}.`,
      why: `Lifecycle ${stageLabel} olarak kayıtlı.`,
      whatNext: "Teslim gecikirse şikâyet riski artabilir.",
      doNow: "Teslim ve kalan ödemeyi kontrol edin.",
      evidence,
    });
  }

  if (
    profile.total_messages === 0 &&
    profile.total_conversations === 0 &&
    !profile.last_summary
  ) {
    return makeBrief({
      id: `cust-empty-${contactId}`,
      domain: "sales",
      priority: "low",
      confidenceBand: "insufficient",
      title: "Müşteri sinyali yetersiz",
      summary: "Konuşma / özet verisi sınırlı.",
      why: "Mesaj ve konuşma sayıları 0 veya özet yok.",
      whatNext: "Veri artmadan kesin öneri verilemez.",
      doNow: "Inbox’tan konuşmayı açın veya kaynağı manuel işaretleyin.",
      evidence,
      href: `/dashboard/customers/${contactId}`,
    });
  }

  return makeBrief({
    id: `cust-default-${contactId}`,
    domain: "sales",
    priority: "medium",
    confidenceBand: attrBand === "exact" ? "exact" : "probable",
    title: "Müşteri durumu",
    summary: `Aşama ${stageLabel}; opportunity ${score}/100.`,
    why: `CRM profil alanlarından okunan aşama ve skor.`,
    whatNext: "Net sonraki adım yazılmazsa konuşma sürüncemede kalabilir.",
    doNow: "Son mesajı okuyup tek net soru / teklif / tarih adımı belirleyin.",
    evidence: [
      ...evidence,
      ...(profile.last_summary
        ? [
            {
              label: "Son özet",
              value: profile.last_summary.slice(0, 80),
            },
          ]
        : []),
    ],
  });
}
