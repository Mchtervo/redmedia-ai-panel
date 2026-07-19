import {
  makeBrief,
  type IntelligenceBrief,
} from "@/features/intelligence/types";

type AnalysisLike = {
  id: string;
  customer_intent: string | null;
  lead_score: number | null;
  lead_temperature: string | null;
  sale_outcome: string | null;
  next_action: string | null;
  loss_reason?: string | null;
  summary?: string | null;
};

function normalizeClusterText(text: string | null | undefined): string {
  if (!text?.trim()) return "—";
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[.,!?;:"'()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Aynı niyet + sonuç + aksiyon tipi → tek küme (UI tekrarını keser). */
export function learningClusterKey(row: AnalysisLike): string {
  const intent = normalizeClusterText(row.customer_intent);
  const outcome = normalizeClusterText(row.sale_outcome);
  const action = row.next_action?.trim()
    ? normalizeClusterText(row.next_action)
    : "aksiyon-yok";
  return `${intent}|${outcome}|${action}`;
}

function avgScore(rows: AnalysisLike[]): number | null {
  const scores = rows
    .map((r) => r.lead_score)
    .filter((n): n is number => n != null);
  if (scores.length === 0) return null;
  return Math.round(
    scores.reduce((sum, n) => sum + n, 0) / scores.length
  );
}

function dominantTemp(
  rows: AnalysisLike[]
): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.lead_temperature) continue;
    counts.set(
      row.lead_temperature,
      (counts.get(row.lead_temperature) ?? 0) + 1
    );
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [temp, n] of counts) {
    if (n > bestN) {
      best = temp;
      bestN = n;
    }
  }
  return best;
}

/**
 * Tek satır brief (geriye uyum). Tercihen buildLearningIntelligenceBriefs kullan.
 */
export function buildLearningIntelligenceBrief(
  row: AnalysisLike
): IntelligenceBrief {
  return buildLearningIntelligenceBriefs([row])[0]!;
}

/**
 * Benzer konuşma analizlerini gruplar — aynı "fiyat sorusu / aksiyon yok"
 * kartından 5 tane yerine 1 özet kart.
 */
export function buildLearningIntelligenceBriefs(
  rows: AnalysisLike[],
  options?: { maxClusters?: number }
): IntelligenceBrief[] {
  const maxClusters = options?.maxClusters ?? 5;
  const groups = new Map<string, AnalysisLike[]>();

  for (const row of rows) {
    const key = learningClusterKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const clusters = [...groups.entries()]
    .map(([key, items]) => ({ key, items }))
    // Önce aksiyonlu / kayıp / sıcak, sonra adet
    .sort((a, b) => {
      const score = (items: AnalysisLike[]) => {
        let s = items.length * 10;
        if (items.some((i) => i.next_action)) s += 40;
        if (items.some((i) => i.sale_outcome === "lost")) s += 25;
        if (items.some((i) => i.lead_temperature === "hot")) s += 20;
        return s;
      };
      return score(b.items) - score(a.items);
    })
    .slice(0, maxClusters);

  return clusters.map(({ items }) => {
    const sample = items[0]!;
    const count = items.length;
    const score = avgScore(items);
    const temp = dominantTemp(items);
    const hasAction = Boolean(sample.next_action?.trim());
    const intent = sample.customer_intent?.trim() || "Belirsiz niyet";
    const outcome = sample.sale_outcome ?? "unknown";

    const priority =
      temp === "hot" || (score != null && score >= 70)
        ? "high"
        : temp === "cold" || outcome === "lost"
          ? "low"
          : "medium";

    const title = hasAction
      ? `Tekrarlayan aksiyon · ${count} konuşma`
      : `Tekrarlayan konuşma tipi · ${count}`;

    const summary = hasAction
      ? `${intent} → ${sample.next_action!.slice(0, 100)}`
      : `${intent} · sonuç: ${outcome} · net aksiyon çoğu kayıtta boş`;

    return makeBrief({
      id: `learn-cluster-${learningClusterKey(sample)}`,
      domain: "learning",
      priority,
      confidenceBand: count >= 3 || hasAction ? "probable" : "insufficient",
      title,
      summary,
      why: [
        `Niyet: ${intent}`,
        `Sonuç: ${outcome}`,
        score != null ? `Ort. skor ${score}` : null,
        sample.loss_reason ? `Kayıp: ${sample.loss_reason}` : null,
        `${count} benzer analiz birleştirildi`,
      ]
        .filter(Boolean)
        .join(" · "),
      whatNext: hasAction
        ? "Bu aksiyon uygulanmazsa aynı konuşma tipi tekrar sürüncemede kalır."
        : "Bu tipte net aksiyon tanımlı değil; ekip için tek standart adım yazılmalı.",
      doNow: hasAction
        ? sample.next_action!.slice(0, 200)
        : "Bu küme için tek net sonraki adımı (takip / fiyat pitch / kapora) personel olarak belirleyin.",
      evidence: [
        { label: "Benzer konuşma", value: String(count) },
        ...(score != null
          ? [{ label: "Ort. lead skor", value: String(score) }]
          : []),
        ...(temp ? [{ label: "Sıcaklık", value: temp }] : []),
        { label: "Sonuç", value: outcome },
        { label: "Niyet", value: intent.slice(0, 60) },
      ],
    });
  });
}
