/**
 * AI Sales Learning Engine — ortak tipler ve Türkçe etiketler.
 *
 * Redmedia'nın satış danışmanı gibi konuşan, her konuşmadan öğrenen AI:
 * - sales_patterns: başarılı/başarısız satış kalıpları (Learning Engine)
 * - company_personality_traits: şirket kişiliği (AI Memory)
 * - ai_mistakes: AI'nin kendi hatalarının kaydı (Self Improvement)
 * - ai_weekly_reports: haftalık öz değerlendirme (Quality Control)
 */

import type { Database } from "@/types/database";

export type SalesPatternRow =
  Database["public"]["Tables"]["sales_patterns"]["Row"];

export type CompanyPersonalityTraitRow =
  Database["public"]["Tables"]["company_personality_traits"]["Row"];

export type AiMistakeRow = Database["public"]["Tables"]["ai_mistakes"]["Row"];

export type AiWeeklyReportRow =
  Database["public"]["Tables"]["ai_weekly_reports"]["Row"];

export type SalesPatternType = SalesPatternRow["pattern_type"];
export type PersonalityTraitType = CompanyPersonalityTraitRow["trait_type"];
export type AiMistakeType = AiMistakeRow["mistake_type"];

export const SALES_PATTERN_TYPE_LABELS: Record<SalesPatternType, string> = {
  opening: "Açılış cümlesi",
  price_explanation: "Fiyat anlatımı",
  trust_building: "Güven oluşturma",
  objection_response: "İtiraz cevabı",
  closing: "Rezervasyon kapatma",
  failure: "Başarısız yaklaşım",
  leave_reason: "Ayrılma sebebi",
  human_feedback: "İnsan düzeltmesi (Human Feedback)",
};

export const PERSONALITY_TRAIT_TYPE_LABELS: Record<
  PersonalityTraitType,
  string
> = {
  tone: "Konuşma tarzı",
  pricing_style: "Fiyat verme şekli",
  phone_timing: "Telefon isteme zamanı",
  service_offering: "Hizmet önerme",
  vocabulary: "Kelime seçimi",
  trust_style: "Güven verme şekli",
};

export const AI_MISTAKE_TYPE_LABELS: Record<AiMistakeType, string> = {
  premature_detail_question: "Yardım etmeden detay sorma",
  premature_phone_request: "Erken telefon isteme",
  wrong_information: "Yanlış bilgi",
  missed_buying_signal: "Satın alma sinyalini kaçırma",
  repeated_question: "Soru tekrarı",
  tone_mismatch: "Ton uyumsuzluğu",
  other: "Diğer",
};

/** Best Conversation Library girdisi (analiz + konuşma bilgisi). */
export type BestConversationEntry = {
  analysisId: string;
  conversationId: string;
  summary: string | null;
  customerIntent: string | null;
  firstCustomerQuestion: string | null;
  firstReplyGiven: string | null;
  advancingReply: string | null;
  scoreSalesQuality: number | null;
  saleOutcome: string;
  reservationCreated: boolean;
  depositReceived: boolean;
  analyzedAt: string;
};

/** Assistant cevabı öncesi yüklenen öğrenilmiş satış bağlamı. */
export type SalesLearningContext = {
  patterns: SalesPatternRow[];
  personality: CompanyPersonalityTraitRow[];
  activeMistakes: AiMistakeRow[];
  bestConversations: BestConversationEntry[];
  /** Onaylanmış (aktif) playbook'lar — docs/27 Playbook Engine. */
  playbooks?: import("@/features/playbooks/types").AiPlaybookRow[];
};

export type SalesLearningDashboardData = {
  patternCount: number;
  personalityCount: number;
  activeMistakeCount: number;
  bestConversationCount: number;
  topPatterns: SalesPatternRow[];
  personality: CompanyPersonalityTraitRow[];
  activeMistakes: AiMistakeRow[];
  bestConversations: BestConversationEntry[];
  scoredAnalyses: Array<{
    id: string;
    conversationId: string;
    customerIntent: string | null;
    scoreSalesQuality: number | null;
    scoreEmpathy: number | null;
    scoreSpeed: number | null;
    scorePersuasion: number | null;
    scoreClosing: number | null;
    scoreNotes: string | null;
    saleOutcome: string;
    analyzedAt: string;
  }>;
  latestWeeklyReport: AiWeeklyReportRow | null;
  playbooks: import("@/features/playbooks/types").AiPlaybookRow[];
  reservationBlockers: import("@/features/sales-learning/services/reservation-blockers.service").ReservationBlockersReport;
};
