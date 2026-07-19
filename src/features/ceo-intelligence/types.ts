/** CEO Intelligence — salt okuma tipler. Yazma/işlem yok. */

export type CeoNamedCount = {
  id: string;
  label: string;
  count: number;
  meta?: string;
};

export type CeoHotOpportunity = {
  contactId: string;
  name: string;
  opportunityScore: number;
  lifecycleStage: string;
  tags: string[];
  lastSeen: string | null;
};

export type CeoMetricsSnapshot = {
  reportDate: string;
  generatedAt: string;
  newCustomersToday: number;
  activeConversations: number;
  awaitingDeposit: number;
  awaitingReceiptReview: number;
  shootsToday: number;
  staffOnDutyToday: number;
  staffIdleToday: number;
  staffActiveTotal: number;
  estimatedRevenueToday: number;
  estimatedRevenueThisWeek: number;
  pendingCollections: number;
  pendingCollectionsCount: number;
  reservationsThisMonth: number;
  cancelledThisMonth: number;
  depositsVerifiedToday: number;
  conversionRateMonth: number | null;
  hotOpportunities: CeoHotOpportunity[];
  topPackages: CeoNamedCount[];
  topPlateaus: CeoNamedCount[];
  topStaffByShoots: CeoNamedCount[];
  topCampaignsByAttribution: CeoNamedCount[];
  topObjections: CeoNamedCount[];
  negotiatingLast30Days: number;
  freeDaysThisWeek: string[];
  busyDaysAhead: CeoNamedCount[];
  salesYesterday: number;
  salesToday: number;
  dataGaps: string[];
};

export type CeoRiskSeverity = "critical" | "high" | "medium" | "low";

export type CeoRiskItem = {
  id: string;
  severity: CeoRiskSeverity;
  title: string;
  detail: string;
  href?: string;
};

export type CeoRecommendationItem = {
  id: string;
  title: string;
  detail: string;
  category:
    | "campaign"
    | "sales"
    | "capacity"
    | "follow_up"
    | "ops"
    | "general";
};

export type CeoActionItem = {
  id: string;
  title: string;
  detail: string;
  href?: string;
};

export type CeoDashboardPayload = {
  metrics: CeoMetricsSnapshot;
  risks: CeoRiskItem[];
  recommendations: CeoRecommendationItem[];
  actionItems: CeoActionItem[];
  /** Neden / Sonra / Şimdi — ana AI Intelligence çıktısı */
  intelligenceBriefs: import("@/features/intelligence/types").IntelligenceBrief[];
  /** Son 7 gün — rezervasyona dönmeyen konuşma nedenleri */
  reservationBlockers: import("@/features/sales-learning/services/reservation-blockers.service").ReservationBlockersReport;
  summaryBullets: string[];
  narrative: string | null;
  briefGeneratedAt: string;
  latestDailyReport: {
    id: string;
    reportDate: string;
    contentMarkdown: string;
    generatedAt: string;
  } | null;
};

export const CEO_ASSISTANT_NO_DATA =
  "Bu soruya yanıt verebilecek yeterli veri sistemde yok. Tahmin üretmiyorum.";
