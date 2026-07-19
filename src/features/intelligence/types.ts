/**
 * AI Intelligence — kanıtlı, tek tip brief.
 * Kanıtı olmayan bilgi kesin gibi yazılmaz. Veri uydurulmaz.
 */

export const INTELLIGENCE_QUESTIONS = {
  why: "Neden oldu?",
  whatNext: "Sonra ne olacak?",
  doNow: "Ben şimdi ne yapmalıyım?",
} as const;

export const INSUFFICIENT_EVIDENCE_MESSAGE = "Yeterli veri bulunamadı.";

export type IntelligenceDomain =
  | "ceo"
  | "sales"
  | "marketing"
  | "ops"
  | "learning"
  | "attribution"
  | "general";

export type IntelligencePriority = "critical" | "high" | "medium" | "low";

export const INTELLIGENCE_PRIORITY_LABELS: Record<
  IntelligencePriority,
  string
> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Tek kanıt satırı — yalnızca gerçek sayılan veriden. */
export type IntelligenceEvidenceItem = {
  label: string;
  value: string;
};

/**
 * Attribution / veri kalitesine göre güven bandı.
 * Exact = yüksek · Olası = orta · Yetersiz = düşük
 */
export type ConfidenceBand = "exact" | "probable" | "insufficient";

export type IntelligenceBrief = {
  id: string;
  title: string;
  /** Kısa özet — kesin iddia yoksa yumuşak dil */
  summary: string;
  domain: IntelligenceDomain;
  priority: IntelligencePriority;
  why: string;
  whatNext: string;
  doNow: string;
  /** 0–100, zorunlu */
  confidence: number;
  confidenceBand: ConfidenceBand;
  /** Boşsa UI "Yeterli veri bulunamadı." gösterir */
  evidence: IntelligenceEvidenceItem[];
  href?: string;
  hrefLabel?: string;
};

export function clampConfidence(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Exact attribution → yüksek (75–95)
 * Olası kaynak → orta (40–65)
 * Yetersiz veri → düşük (10–35)
 */
export function confidenceFromBand(
  band: ConfidenceBand,
  evidenceCount: number,
  nudge = 0
): number {
  const base =
    band === "exact" ? 82 : band === "probable" ? 52 : 22;
  const evidenceBoost = Math.min(10, evidenceCount * 2);
  return clampConfidence(base + evidenceBoost + nudge);
}

export function bandFromAttributionStatus(
  status: string | null | undefined
): ConfidenceBand {
  if (status === "exact" || status === "manual") return "exact";
  if (status === "probable") return "probable";
  return "insufficient";
}

/** Kanıt yoksa boş dizi — UI mesajı gösterir. Uydurma yok. */
export function evidenceOrEmpty(
  items: Array<IntelligenceEvidenceItem | null | undefined | false>
): IntelligenceEvidenceItem[] {
  const out: IntelligenceEvidenceItem[] = [];
  for (const x of items) {
    if (!x || typeof x !== "object") continue;
    const label = x.label?.trim();
    const value = x.value?.trim();
    if (!label || !value) continue;
    if (value === INSUFFICIENT_EVIDENCE_MESSAGE) continue;
    out.push({ label, value });
  }
  return out;
}

export function makeBrief(input: {
  id: string;
  title: string;
  summary: string;
  why: string;
  whatNext: string;
  doNow: string;
  priority: IntelligencePriority;
  domain: IntelligenceDomain;
  confidenceBand: ConfidenceBand;
  evidence: IntelligenceEvidenceItem[];
  confidenceNudge?: number;
  href?: string;
  hrefLabel?: string;
}): IntelligenceBrief {
  const evidence = evidenceOrEmpty(input.evidence);
  const band =
    evidence.length === 0 ? "insufficient" : input.confidenceBand;
  const confidence = confidenceFromBand(
    band,
    evidence.length,
    input.confidenceNudge ?? 0
  );

  const soften =
    band === "insufficient"
      ? {
          why:
            evidence.length === 0
              ? INSUFFICIENT_EVIDENCE_MESSAGE
              : `Mevcut sinyaller sınırlı: ${input.why}`,
          whatNext:
            evidence.length === 0
              ? "Veri artmadan kesin tahmin yapılamaz."
              : input.whatNext,
          summary:
            evidence.length === 0
              ? INSUFFICIENT_EVIDENCE_MESSAGE
              : input.summary,
        }
      : band === "probable"
        ? {
            why: `Olası değerlendirme (doğrulanmadı): ${input.why}`,
            summary: `Olası: ${input.summary}`,
            whatNext: input.whatNext,
          }
        : {
            why: input.why,
            summary: input.summary,
            whatNext: input.whatNext,
          };

  return {
    id: input.id,
    title: input.title,
    summary: soften.summary,
    domain: input.domain,
    priority: input.priority,
    why: soften.why,
    whatNext: soften.whatNext,
    doNow: input.doNow,
    confidence,
    confidenceBand: band,
    evidence,
    href: input.href,
    hrefLabel: input.hrefLabel,
  };
}
