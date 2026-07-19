/** AI Marketing Director — tipler. AI kampanya/bütçe DEĞİŞTİRMEZ. */

export const META_CONNECTION_TYPES = [
  "meta_business",
  "meta_ad_account",
  "facebook_page",
  "instagram_business",
  "meta_pixel",
  "conversions_api",
] as const;

export type MetaConnectionType = (typeof META_CONNECTION_TYPES)[number];

export const META_CONNECTION_LABELS: Record<MetaConnectionType, string> = {
  meta_business: "Meta Business",
  meta_ad_account: "Meta reklam hesabı",
  facebook_page: "Facebook sayfası",
  instagram_business: "Instagram Business hesabı",
  meta_pixel: "Meta Pixel",
  conversions_api: "Conversions API",
};

export const CONNECTION_STATUSES = [
  "connected",
  "disconnected",
  "error",
  "token_expired",
  "configured",
] as const;

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: "Bağlı",
  disconnected: "Bağlı değil",
  error: "Hata",
  token_expired: "Token süresi doldu",
  configured: "Yapılandırıldı, henüz olayla doğrulanmadı",
};

export const ATTRIBUTION_STATUSES = [
  "exact",
  "probable",
  "manual",
  "unknown",
] as const;

export type AttributionStatus = (typeof ATTRIBUTION_STATUSES)[number];

export const ATTRIBUTION_STATUS_LABELS: Record<AttributionStatus, string> = {
  exact: "Kesin (exact)",
  probable: "Olası Kaynak",
  manual: "Manuel",
  unknown: "Bilinmiyor",
};

export const SOURCE_TYPES = [
  "instagram_organic",
  "instagram_ad",
  "facebook_ad",
  "referral",
  "google",
  "website",
  "phone",
  "whatsapp",
  "returning_customer",
  "other",
  "unknown",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  instagram_organic: "Instagram organik",
  instagram_ad: "Instagram reklamı",
  facebook_ad: "Facebook reklamı",
  referral: "Tavsiye",
  google: "Google",
  website: "Web sitesi",
  phone: "Telefon",
  whatsapp: "WhatsApp",
  returning_customer: "Eski müşteri",
  other: "Diğer",
  unknown: "Bilinmiyor",
};

export const DATE_PRESETS = [
  "today",
  "last_7",
  "last_30",
  "last_90",
  "custom",
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number];

export type MarketingDateRange = {
  preset: DatePreset;
  start: string;
  end: string;
};

export type MarketingOverviewMetrics = {
  connected: boolean;
  hasData: boolean;
  emptyMessage: string;
  totalSpend: number | null;
  customersFromAds: number | null;
  reservations: number | null;
  deposits: number | null;
  costPerCustomer: number | null;
  costPerReservation: number | null;
  costPerDeposit: number | null;
  bestCampaign: { id: string; name: string; deposits: number } | null;
  bestAd: { id: string; name: string; deposits: number } | null;
  unknownSourceCount: number | null;
  range: MarketingDateRange;
};

export type DualPerformanceRow = {
  id: string;
  name: string;
  level: "campaign" | "adset" | "ad" | "creative";
  parentId: string | null;
  meta: {
    spend: number;
    impressions: number;
    reach: number;
    frequency: number | null;
    cpm: number | null;
    cpc: number | null;
    ctr: number | null;
    messages: number;
    leads: number;
  };
  business: {
    crmCustomers: number;
    reservations: number;
    deposits: number;
    revenue: number;
    roas: number | null;
    costPerCustomer: number | null;
    costPerReservation: number | null;
    costPerDeposit: number | null;
  };
};

export type RecommendationFields = {
  recommendation: string;
  suggestedBudget: number | null;
  expectedGoal: string;
  rationale: string;
  dataRangeLabel: string;
  dataSufficiency: "sufficient" | "partial" | "insufficient";
  confidenceLevel: number;
};

export const INSUFFICIENT_DATA_MESSAGE =
  "Henüz güvenilir karar vermek için yeterli veri bulunmuyor.";

export const AI_MARKETING_HARD_RULES = `
AI Marketing Director kuralları:
- Kampanyayı otomatik kapatma / duraklatma YOK.
- Bütçeyi otomatik değiştirme YOK.
- Yalnızca öneri üret; uygulama admin onayına bırakılır.
- Her öneride güven seviyesi ve gerekçe zorunlu.
- Yeterli veri yoksa kesin öneri verme; "${INSUFFICIENT_DATA_MESSAGE}" de.
- Probable attribution'ı exact gibi gösterme.
`.trim();
