import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import {
  estimateCostUsd,
  FALLBACK_MODEL,
  resolveModelRoute,
  type AiTaskKind,
} from "@/lib/ai/model-router";

/**
 * Paylaşılan OpenAI istemcisi + model router entegrasyonu.
 * Tüm AI servisleri OpenAI'ye buradan çıkar (docs/05_AI_CORE.md: modüller
 * LLM'e doğrudan gitmez). Birincil model hata verirse fallback model denenir
 * (docs/41 Fallback Rules). SDK seviyesinde timeout + retry uygulanır.
 */

const REQUEST_TIMEOUT_MS = 60_000;
const SDK_MAX_RETRIES = 2;

let cachedClient: OpenAI | null = null;
let cachedApiKey: string | null = null;

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY tanımlı değil.");
  }
  // Env hot-reload / anahtar değişiminde eski istemciyi kullanma.
  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new OpenAI({
      apiKey,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: SDK_MAX_RETRIES,
    });
    cachedApiKey = apiKey;
  }
  return cachedClient;
}

export type RoutedChatParams = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "model"
>;

export type RoutedChatResult = {
  completion: ChatCompletion;
  /** Cevabı üreten model (fallback devreye girdiyse fallback modeli). */
  modelUsed: string;
  /** Birincil model başarısız olup fallback kullanıldıysa true. */
  usedFallback: boolean;
  /** Token kullanımına göre tahmini USD maliyet (bilinmeyen model → null). */
  estimatedCostUsd: number | null;
};

/**
 * Hata normalizasyonu: OpenAI SDK hataları kısa, sır içermeyen tek tip
 * mesaja çevrilir (docs/38_ERROR_HANDLING.md).
 */
export class AiProviderError extends Error {
  readonly code: "auth" | "rate_limit" | "timeout" | "bad_request" | "provider";
  readonly status?: number;

  constructor(code: AiProviderError["code"], message: string, status?: number) {
    super(message);
    this.name = "AiProviderError";
    this.code = code;
    this.status = status;
  }
}

function openaiErrorBody(error: {
  message?: string;
  error?: unknown;
}): string {
  const raw = error.error;
  if (!raw || typeof raw !== "object") return error.message ?? "";
  const record = raw as Record<string, unknown>;
  const parts = [record.code, record.type, record.message, error.message]
    .filter((v): v is string => typeof v === "string")
    .join(" ");
  return parts.toLowerCase();
}

function normalizeOpenAiError(error: unknown): AiProviderError {
  if (error instanceof OpenAI.APIError) {
    const status = typeof error.status === "number" ? error.status : undefined;
    const body = openaiErrorBody(error);

    // Model yetkisi bazen 401 + "insufficient permissions" ile gelir.
    // Bunu auth sayıp fallback'i kesmeyelim — önce burayı kontrol et.
    if (
      body.includes("insufficient permissions") ||
      body.includes("missing_permissions") ||
      body.includes("model_not_found") ||
      status === 403
    ) {
      return new AiProviderError(
        "bad_request",
        "OpenAI bu modeli reddetti (yetki/model). Yedek model deneniyor.",
        status
      );
    }

    // Gerçek API anahtarı hatası — fallback anlamsız.
    if (
      status === 401 ||
      body.includes("invalid_api_key") ||
      body.includes("incorrect api key")
    ) {
      return new AiProviderError(
        "auth",
        "OpenAI kimlik doğrulaması başarısız.",
        status
      );
    }

    if (status === 429) {
      return new AiProviderError("rate_limit", "OpenAI rate limit aşıldı.", status);
    }
    if (status === 400 || status === 404) {
      return new AiProviderError(
        "bad_request",
        "OpenAI isteği reddetti (model/parametre).",
        status
      );
    }
    return new AiProviderError("provider", "OpenAI servis hatası.", status);
  }
  if (error instanceof Error && error.name === "APIConnectionTimeoutError") {
    return new AiProviderError("timeout", "OpenAI isteği zaman aşımına uğradı.");
  }
  return new AiProviderError("provider", "OpenAI'ye ulaşılamadı.");
}

/**
 * Görev tipine göre model seçer, birincil model hata verirse fallback ile
 * bir kez daha dener. Fallback da başarısız olursa normalize hata fırlatır.
 */
/**
 * GPT-5 / o-series: `max_tokens` → `max_completion_tokens`.
 * Bu ailede çoğu model yalnızca varsayılan temperature (1) kabul eder;
 * 0.55 gibi değerler 400 verir — parametreyi kaldırırız.
 */
function adaptParamsForModel(
  model: string,
  params: RoutedChatParams
): ChatCompletionCreateParamsNonStreaming {
  const body: ChatCompletionCreateParamsNonStreaming = { ...params, model };
  const isGpt5Family =
    /gpt-5/i.test(model) || /o[1-9]/i.test(model) || /5\.6/i.test(model);

  if (isGpt5Family) {
    if (body.max_tokens != null && body.max_completion_tokens == null) {
      body.max_completion_tokens = body.max_tokens;
      delete body.max_tokens;
    }
    // Yalnızca default (1) desteklenir; custom temperature → invalid_request.
    if (body.temperature != null && body.temperature !== 1) {
      delete body.temperature;
    }
    if (body.top_p != null) {
      delete body.top_p;
    }
  }

  return body;
}

function messageContentEmpty(completion: ChatCompletion): boolean {
  const content = completion.choices[0]?.message?.content;
  return !content || !String(content).trim();
}

export async function createRoutedChatCompletion(
  task: AiTaskKind,
  params: RoutedChatParams
): Promise<RoutedChatResult> {
  const route = resolveModelRoute(task);
  const client = getClient();

  const run = async (model: string): Promise<ChatCompletion> =>
    client.chat.completions.create(adaptParamsForModel(model, params));

  const wrap = (
    completion: ChatCompletion,
    model: string,
    usedFallback: boolean
  ): RoutedChatResult => {
    const modelUsed = completion.model || model;
    return {
      completion,
      modelUsed,
      usedFallback,
      estimatedCostUsd: estimateCostUsd(
        modelUsed,
        completion.usage?.prompt_tokens,
        completion.usage?.completion_tokens
      ),
    };
  };

  const tryModel = async (
    model: string,
    reason: string
  ): Promise<RoutedChatResult> => {
    console.error("[openai-client] fallback:", {
      from: route.model,
      to: model,
      reason,
    });
    const completion = await run(model);
    return wrap(completion, model, true);
  };

  try {
    const completion = await run(route.model);
    // GPT-5* reasoning bazen content boş bırakır → güvenli modele düş.
    if (messageContentEmpty(completion)) {
      const emptyFallback =
        route.model === FALLBACK_MODEL
          ? route.fallbackModel
          : FALLBACK_MODEL;
      if (emptyFallback === route.model) {
        throw new AiProviderError(
          "provider",
          "Model boş cevap üretti ve fallback yok"
        );
      }
      return await tryModel(emptyFallback, "empty_content");
    }
    return wrap(completion, route.model, false);
  } catch (primaryError) {
    if (primaryError instanceof AiProviderError) {
      throw primaryError;
    }
    const normalized = normalizeOpenAiError(primaryError);
    console.error("[openai-client] birincil model hata:", {
      model: route.model,
      code: normalized.code,
      status: normalized.status,
      message: normalized.message,
    });

    // Gerçek invalid_api_key dışında yedek modele düş.
    if (normalized.code === "auth") {
      throw normalized;
    }
    const next =
      route.fallbackModel !== route.model
        ? route.fallbackModel
        : FALLBACK_MODEL;
    if (next === route.model) {
      throw normalized;
    }
    try {
      return await tryModel(next, normalized.code);
    } catch (fallbackError) {
      throw normalizeOpenAiError(fallbackError);
    }
  }
}

/** Görev için seçilecek birincil modeli döner (loglama/raporlama için). */
export function getRoutedModel(task: AiTaskKind): string {
  return resolveModelRoute(task).model;
}

/** knowledge_chunks.embedding vector(1536) ile uyumlu boyut. */
export const EMBEDDING_DIMENSIONS = 1536;

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export function getEmbeddingModel(): string {
  return process.env.OPENAI_MODEL_EMBEDDING?.trim() || DEFAULT_EMBEDDING_MODEL;
}

/**
 * RAG Engine (docs/29): metin(ler) için embedding üretir.
 * Dönen vektörler girişle aynı sıradadır.
 */
export async function createEmbeddings(
  inputs: string[]
): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const client = getClient();
  try {
    const response = await client.embeddings.create({
      model: getEmbeddingModel(),
      input: inputs,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  } catch (error) {
    throw normalizeOpenAiError(error);
  }
}
