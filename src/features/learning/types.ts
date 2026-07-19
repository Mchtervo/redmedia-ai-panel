/**
 * Conversation Learning — bilgi kategorileri ve ortak tipler.
 */

export const KNOWLEDGE_CATEGORIES = [
  "hizmetler",
  "paket_icerigi",
  "fiyatlandirma_kurallari",
  "album_bilgileri",
  "drone",
  "sinematik_klip",
  "teslim_suresi",
  "rezervasyon",
  "odeme",
  "musaitlik",
  "iptal",
  "indirim_pazarlik",
  "telefon_alma",
  "itiraz_karsilama",
  "sik_sorulan_sorular",
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  hizmetler: "Hizmetler",
  paket_icerigi: "Paket içeriği",
  fiyatlandirma_kurallari: "Fiyatlandırma kuralları",
  album_bilgileri: "Albüm bilgileri",
  drone: "Drone",
  sinematik_klip: "Sinematik klip",
  teslim_suresi: "Teslim süresi",
  rezervasyon: "Rezervasyon",
  odeme: "Ödeme",
  musaitlik: "Müsaitlik",
  iptal: "İptal",
  indirim_pazarlik: "İndirim / pazarlık",
  telefon_alma: "Telefon alma",
  itiraz_karsilama: "İtiraz karşılama",
  sik_sorulan_sorular: "Sık sorulan sorular",
};

export type KnowledgeReviewStatus =
  | "pending_review"
  | "approved"
  | "rejected";

export type SaleOutcome = "won" | "lost" | "open" | "unknown";

export type LeadTemperature = "cold" | "warm" | "hot";

export type LearningTriggerSource =
  | "manual"
  | "cron"
  | "conversation_closed"
  | "idle_24h"
  | "import";

export type ConversationAnalysisRow =
  import("@/types/database").Database["public"]["Tables"]["conversation_analyses"]["Row"];

export type KnowledgeDocumentRow =
  import("@/types/database").Database["public"]["Tables"]["knowledge_documents"]["Row"];

export type LearningRunRow =
  import("@/types/database").Database["public"]["Tables"]["conversation_learning_runs"]["Row"];

export type LearningDashboardStats = {
  analyzedConversationCount: number;
  pendingKnowledgeCount: number;
  approvedKnowledgeCount: number;
  rejectedKnowledgeCount: number;
  proposedKnowledgeCount: number;
};

export type LearningDashboardData = {
  stats: LearningDashboardStats;
  pendingKnowledge: KnowledgeDocumentRow[];
  faqs: KnowledgeDocumentRow[];
  objections: KnowledgeDocumentRow[];
  goodReplies: KnowledgeDocumentRow[];
  badReplies: KnowledgeDocumentRow[];
  recentAnalyses: ConversationAnalysisRow[];
};
