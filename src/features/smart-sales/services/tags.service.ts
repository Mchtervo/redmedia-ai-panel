import { SALES_TAG_OPTIONS, type SalesTag } from "@/features/smart-sales/types";

export type TagSignals = {
  leadScore?: number;
  opportunityScore?: number;
  budget?: string | null;
  budgetRange?: string | null;
  negotiationTendency?: string | null;
  decisionSpeed?: string | null;
  priorReservation?: boolean;
  daysUntilEvent?: number | null;
  lifecycleStage?: string | null;
  objections?: string | null;
  tags?: string[];
};

/**
 * Otomatik etiket önerisi — mevcut etiketlerle birleştirilir; admin override eder.
 */
export function suggestSalesTags(signals: TagSignals): SalesTag[] {
  const out = new Set<SalesTag>();
  const opp = signals.opportunityScore ?? signals.leadScore ?? 0;

  if (opp >= 70 || signals.lifecycleStage === "awaiting_deposit") {
    out.add("sıcak müşteri");
  }
  if (/yüksek|vip|premium/i.test(`${signals.budget ?? ""} ${signals.budgetRange ?? ""}`)) {
    out.add("yüksek bütçe");
  }
  if (/düşük|dusuk|ucuz|bütçe yok/i.test(`${signals.budget ?? ""} ${signals.objections ?? ""}`)) {
    out.add("düşük bütçe");
  }
  if (/yüksek|pazarl/i.test(signals.negotiationTendency ?? "") || /indirim|pazarlık/i.test(signals.objections ?? "")) {
    out.add("pazarlıkçı");
  }
  if (/hızlı|hizli/i.test(signals.decisionSpeed ?? "")) {
    out.add("hızlı karar veren");
  }
  if (/kararsız|kararsiz|yavaş/i.test(signals.decisionSpeed ?? "")) {
    out.add("kararsız");
  }
  if (signals.priorReservation) {
    out.add("tekrar gelen");
  }
  if (signals.daysUntilEvent != null && signals.daysUntilEvent <= 21) {
    out.add("acil tarih");
  }
  if (opp >= 85) {
    out.add("VIP");
  }
  if (
    signals.lifecycleStage === "cancelled" ||
    /şikayet|sikayet|risk/i.test(signals.objections ?? "")
  ) {
    out.add("riskli müşteri");
  }

  // Bilinen etiketleri koru
  for (const t of signals.tags ?? []) {
    if ((SALES_TAG_OPTIONS as readonly string[]).includes(t)) {
      out.add(t as SalesTag);
    }
  }

  return [...out];
}
