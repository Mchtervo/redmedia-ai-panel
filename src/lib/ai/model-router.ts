/**
 * AI Model Router (docs/41_AI_MODEL_ROUTER.md, docs/42 §Model Routing).
 *
 * Her AI görevi maliyet/kalite profiline göre bir katmana (tier) eşlenir;
 * model adları environment üzerinden yapılandırılır ve biçim olarak
 * doğrulanır. Geçersiz/boş yapılandırmada güvenli varsayılana düşülür.
 *
 * Katman → environment değişkeni:
 * - fast:      OPENAI_MODEL_FAST      → default katmanı
 * - default:   OPENAI_MODEL_DEFAULT   → (deprecated: OPENAI_MODEL_BALANCED,
 *                                        OPENAI_MODEL) → sabit varsayılan
 * - reasoning: OPENAI_MODEL_REASONING → default katmanı
 * - complex:   OPENAI_MODEL_COMPLEX   → reasoning → default katmanı
 *
 * Embedding modeli openai-client.ts içinde OPENAI_MODEL_EMBEDDING ile seçilir.
 */

export type AiTaskKind =
  // FAST — kısa, düşük gecikmeli, düşük maliyetli görevler
  | "dm_reply"
  | "comment_reply"
  | "classification"
  | "tagging"
  | "notification_copy"
  | "short_summary"
  // DEFAULT — standart iş akışı görevleri
  | "extraction"
  | "crm_assist"
  | "reservation_assist"
  | "customer_summary"
  | "email_draft"
  | "workflow_decision"
  | "vision"
  // REASONING — strateji ve çok adımlı analiz
  | "reasoning"
  | "ceo_intelligence"
  | "marketing_strategy"
  | "campaign_analysis"
  | "sales_strategy"
  | "recommendation"
  // COMPLEX — derin teknik analiz
  | "architecture_analysis"
  | "database_analysis"
  | "security_analysis"
  | "migration_planning";

export type ModelTier = "fast" | "default" | "reasoning" | "complex";

/** Yapılandırma tamamen boşsa kullanılacak güvenli varsayılan. */
export const FALLBACK_MODEL = "gpt-4o-mini";

const TASK_TIER: Record<AiTaskKind, ModelTier> = {
  // Satış DM: uzun katalog prompt + GPT-5-mini reasoning kotası boş cevap
  // üretebiliyor → default (terra) daha güvenilir.
  dm_reply: "default",
  comment_reply: "fast",
  classification: "fast",
  tagging: "fast",
  notification_copy: "fast",
  short_summary: "fast",
  // JSON extraction: default (GPT-5*) boş içerik / yavaş; fast daha stabil.
  extraction: "fast",
  crm_assist: "default",
  reservation_assist: "default",
  customer_summary: "default",
  email_draft: "default",
  workflow_decision: "default",
  vision: "default",
  reasoning: "reasoning",
  ceo_intelligence: "reasoning",
  marketing_strategy: "reasoning",
  campaign_analysis: "reasoning",
  sales_strategy: "reasoning",
  recommendation: "reasoning",
  architecture_analysis: "complex",
  database_analysis: "complex",
  security_analysis: "complex",
  migration_planning: "complex",
};

/** Model adı biçim doğrulaması — bilinmeyen ada sessizce güvenilmez. */
const MODEL_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9.:_/-]{1,63}$/;

const warnedVars = new Set<string>();

function devWarnOnce(name: string, message: string): void {
  if (process.env.NODE_ENV === "production") return;
  if (warnedVars.has(name)) return;
  warnedVars.add(name);
  console.warn(`[model-router] ${message}`);
}

/** Env'den model adı okur; biçimi geçersizse yok sayar ve dev'de uyarır. */
function envModel(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  if (!MODEL_NAME_PATTERN.test(value)) {
    devWarnOnce(
      name,
      `${name} geçersiz model adı biçimi içeriyor; yok sayıldı.`
    );
    return undefined;
  }
  return value;
}

/** Deprecated env değişkeni; kullanılıyorsa development'ta uyarı üretir. */
function deprecatedEnvModel(name: string, replacement: string): string | undefined {
  const value = envModel(name);
  if (value) {
    devWarnOnce(
      `deprecated:${name}`,
      `${name} kullanımdan kaldırıldı; ${replacement} kullanın (docs/45).`
    );
  }
  return value;
}

function defaultTierModel(): string {
  return (
    envModel("OPENAI_MODEL_DEFAULT") ??
    deprecatedEnvModel("OPENAI_MODEL_BALANCED", "OPENAI_MODEL_DEFAULT") ??
    deprecatedEnvModel("OPENAI_MODEL", "OPENAI_MODEL_DEFAULT") ??
    FALLBACK_MODEL
  );
}

function modelForTier(tier: ModelTier): string {
  switch (tier) {
    case "fast":
      return envModel("OPENAI_MODEL_FAST") ?? defaultTierModel();
    case "default":
      return defaultTierModel();
    case "reasoning":
      return envModel("OPENAI_MODEL_REASONING") ?? defaultTierModel();
    case "complex":
      return (
        envModel("OPENAI_MODEL_COMPLEX") ??
        envModel("OPENAI_MODEL_REASONING") ??
        defaultTierModel()
      );
  }
}

export type ModelRoute = {
  /** Görevin eşlendiği tier. */
  tier: ModelTier;
  /** Birincil model. */
  model: string;
  /** Birincil model hata verirse denenecek model (aynıysa fallback yok). */
  fallbackModel: string;
};

/** Görev tipine göre model rotası döner. Bilinmeyen görev default'a düşer. */
export function resolveModelRoute(task: AiTaskKind): ModelRoute {
  const tier: ModelTier = TASK_TIER[task] ?? "default";

  // Görsel görevler default katmanı kullanır; deprecated OPENAI_MODEL_VISION
  // tanımlıysa geçiş dönemi boyunca ona saygı gösterilir.
  const visionOverride =
    task === "vision"
      ? deprecatedEnvModel("OPENAI_MODEL_VISION", "OPENAI_MODEL_DEFAULT")
      : undefined;

  // DM öğrenme / JSON extraction: GPT-5* sık boş content → gpt-4o-mini.
  if (task === "extraction") {
    const extractionModel =
      envModel("OPENAI_MODEL_EXTRACTION") ?? FALLBACK_MODEL;
    return {
      tier: "fast",
      model: extractionModel,
      fallbackModel:
        extractionModel === FALLBACK_MODEL
          ? defaultTierModel()
          : FALLBACK_MODEL,
    };
  }

  const model = visionOverride ?? modelForTier(tier);

  // Fallback stratejisi: katman modeli başarısız olursa default katmanına,
  // o da aynıysa sabit güvenli modele düş (docs/41 Fallback Rules).
  const tierDefault = defaultTierModel();
  const fallbackModel = model === tierDefault ? FALLBACK_MODEL : tierDefault;

  return { tier, model, fallbackModel };
}

/**
 * Yaklaşık maliyet tablosu (USD / 1M token). Kesin faturalama değildir;
 * ai_runs.estimated_cost ve panel raporları için tahmindir.
 * Bilinmeyen modellerde null döner (yanlış rakam göstermek yerine).
 */
const MODEL_PRICES_PER_MTOK: Array<{
  match: RegExp;
  input: number;
  output: number;
}> = [
  { match: /^gpt-4o-mini/, input: 0.15, output: 0.6 },
  { match: /^gpt-4o/, input: 2.5, output: 10 },
  { match: /^gpt-4\.1-nano/, input: 0.1, output: 0.4 },
  { match: /^gpt-4\.1-mini/, input: 0.4, output: 1.6 },
  { match: /^gpt-4\.1/, input: 2, output: 8 },
  // GPT-5.6 ailesi (yaklaşık API fiyatları; fatura kesin değildir)
  { match: /^gpt-5\.6-luna/, input: 1, output: 6 },
  { match: /^gpt-5\.6-terra/, input: 2.5, output: 15 },
  { match: /^gpt-5\.6-sol/, input: 5, output: 30 },
  { match: /^gpt-5\.6/, input: 5, output: 30 }, // alias → sol
  { match: /^gpt-5\.5/, input: 5, output: 30 },
  { match: /^gpt-5-nano/, input: 0.05, output: 0.4 },
  { match: /^gpt-5-mini/, input: 0.25, output: 2 },
  { match: /^gpt-5/, input: 1.25, output: 10 },
  { match: /^o[34](-mini)?/, input: 1.1, output: 4.4 },
  { match: /^text-embedding-3-small/, input: 0.02, output: 0 },
  { match: /^text-embedding-3-large/, input: 0.13, output: 0 },
];

/** Token sayımlarından tahmini USD maliyeti hesaplar (bilinmeyen model → null). */
export function estimateCostUsd(
  model: string,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined
): number | null {
  const price = MODEL_PRICES_PER_MTOK.find((p) => p.match.test(model));
  if (!price) return null;
  const input = Math.max(0, inputTokens ?? 0);
  const output = Math.max(0, outputTokens ?? 0);
  const cost = (input * price.input + output * price.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
