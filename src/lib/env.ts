import { z } from "zod";

/**
 * Environment doğrulama modülü (docs/45_ENVIRONMENT_CONFIGURATION.md).
 *
 * - Zorunlu sunucu değişkenleri eksikse startup'ta net hata verir
 *   (src/instrumentation.ts → assertServerEnv).
 * - Sır DEĞERLERİ asla loglanmaz; yalnızca değişken ADLARI raporlanır.
 * - NEXT_PUBLIC_ öneki ile sızdırılmış sır adayları tespit edilir.
 * - Kullanımdan kaldırılan değişkenler için development'ta uyarı üretir.
 */

/** Anahtar/sır içermediği bilinen, istemciye açık olması normal değişkenler. */
const SAFE_PUBLIC_VARS = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SITE_URL",
]);

/** Adında sır iması olan NEXT_PUBLIC_ değişkenlerini yakalar. */
const PUBLIC_SECRET_PATTERN =
  /^NEXT_PUBLIC_.*(SECRET|SERVICE_ROLE|API_KEY|ACCESS_TOKEN|PRIVATE|PASSWORD)/i;

/** Geçerli bir OpenAI model adı biçimi (değer değil, biçim doğrulanır). */
const MODEL_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9.:_/-]{1,63}$/;

const optionalModelName = z
  .string()
  .trim()
  .regex(MODEL_NAME_PATTERN, "Geçersiz model adı biçimi")
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalNonEmpty = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalUrl = z
  .string()
  .trim()
  .url("Geçerli bir URL olmalı")
  .optional()
  .or(z.literal("").transform(() => undefined));

/**
 * Sunucu environment şeması. Zorunlu alanlar uygulamanın hiç
 * çalışamayacağı değişkenlerdir; geri kalanı özellik bazında opsiyoneldir
 * (ilgili özellik kendini kapatır).
 */
export const serverEnvSchema = z.object({
  // --- Zorunlu: Supabase (uygulamanın temeli) ---
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().url("Geçerli bir URL olmalı"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(20),

  // --- Opsiyonel: OpenAI / AI Model Router (docs/41) ---
  OPENAI_API_KEY: optionalNonEmpty,
  OPENAI_MODEL_FAST: optionalModelName,
  OPENAI_MODEL_DEFAULT: optionalModelName,
  OPENAI_MODEL_REASONING: optionalModelName,
  OPENAI_MODEL_COMPLEX: optionalModelName,
  OPENAI_MODEL_EMBEDDING: optionalModelName,
  AI_AUTO_REPLY_ENABLED: optionalNonEmpty,

  // --- Deprecated (bkz. docs/45; geçici fallback olarak okunur) ---
  OPENAI_MODEL: optionalModelName,
  OPENAI_MODEL_BALANCED: optionalModelName,
  OPENAI_MODEL_VISION: optionalModelName,

  // --- Opsiyonel: ChatPlace ---
  // Webhook secret/token yalnızca inbound webhook için gerekir; MCP salt
  // okuma senkronizasyonu için gerekmez (docs/44). Startup'ı bozmaz.
  CHATPLACE_WEBHOOK_SECRET: optionalNonEmpty,
  CHATPLACE_WEBHOOK_TOKEN: optionalNonEmpty,
  CHATPLACE_API_KEY: optionalNonEmpty,
  CHATPLACE_MCP_URL: optionalUrl,

  // --- Opsiyonel: Cron (yoksa cron endpoint'leri fail-closed reddeder) ---
  CRON_SECRET: optionalNonEmpty,

  // --- Opsiyonel: Meta / Marketing ---
  META_APP_ID: optionalNonEmpty,
  META_APP_SECRET: optionalNonEmpty,
  META_BUSINESS_ID: optionalNonEmpty,
  META_AD_ACCOUNT_ID: optionalNonEmpty,
  META_PAGE_ID: optionalNonEmpty,
  META_INSTAGRAM_ACCOUNT_ID: optionalNonEmpty,
  META_PIXEL_ID: optionalNonEmpty,
  META_CAPI_ACCESS_TOKEN: optionalNonEmpty,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type EnvValidationResult = {
  ok: boolean;
  /** Eksik/geçersiz ZORUNLU değişken adları + kısa neden (değer içermez). */
  errors: string[];
  /** Deprecated / şüpheli yapılandırma uyarıları (değer içermez). */
  warnings: string[];
};

const DEPRECATED_VARS: Array<{ name: string; hint: string }> = [
  {
    name: "OPENAI_MODEL",
    hint: "OPENAI_MODEL_DEFAULT kullanın (docs/45).",
  },
  {
    name: "OPENAI_MODEL_BALANCED",
    hint: "OPENAI_MODEL_DEFAULT olarak yeniden adlandırıldı.",
  },
  {
    name: "OPENAI_MODEL_VISION",
    hint: "Görsel görevler DEFAULT katmanını kullanır; özel gerekirse kalabilir.",
  },
];

/**
 * Saf doğrulama fonksiyonu (test edilebilir): verilen env kaydını
 * şemaya ve güvenlik kurallarına göre denetler. Değer içeriği asla
 * hata/uyarı metnine yazılmaz.
 */
export function validateEnv(
  env: Record<string, string | undefined>
): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const parsed = serverEnvSchema.safeParse(env);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const name = issue.path.join(".");
      errors.push(`${name}: ${issue.message}`);
    }
  }

  // NEXT_PUBLIC_ ile sızdırılmış sır adayları (fail hard).
  for (const key of Object.keys(env)) {
    if (!key.startsWith("NEXT_PUBLIC_")) continue;
    if (SAFE_PUBLIC_VARS.has(key)) continue;
    if (PUBLIC_SECRET_PATTERN.test(key) && env[key]?.trim()) {
      errors.push(
        `${key}: sır içeriği NEXT_PUBLIC_ öneki ile istemciye açılamaz. ` +
          "Değişkeni sunucu tarafına taşıyın."
      );
    }
  }

  // Deprecated değişken uyarıları.
  for (const { name, hint } of DEPRECATED_VARS) {
    if (env[name]?.trim()) {
      warnings.push(`${name} kullanımdan kaldırıldı: ${hint}`);
    }
  }

  // Production'da CRON_SECRET yoksa cron uçları çalışmaz — uyarı.
  if (env.NODE_ENV === "production" && !env.CRON_SECRET?.trim()) {
    warnings.push(
      "CRON_SECRET tanımlı değil: cron endpoint'leri tüm istekleri reddedecek."
    );
  }

  // ChatPlace MCP kısmi yapılandırma uyarısı.
  const hasKey = Boolean(env.CHATPLACE_API_KEY?.trim());
  const hasUrl = Boolean(env.CHATPLACE_MCP_URL?.trim());
  if (hasKey !== hasUrl) {
    warnings.push(
      "CHATPLACE_API_KEY ve CHATPLACE_MCP_URL birlikte tanımlanmalı; " +
        "biri eksik olduğu için MCP senkronizasyonu devre dışı."
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}

let alreadyAsserted = false;

/**
 * Startup doğrulaması (src/instrumentation.ts'ten çağrılır).
 * Zorunlu değişken eksikse net bir hata ile süreç durdurulur;
 * uyarılar yalnızca development'ta konsola yazılır.
 */
export function assertServerEnv(): void {
  if (alreadyAsserted) return;
  alreadyAsserted = true;

  const result = validateEnv(process.env);

  if (process.env.NODE_ENV !== "production" || !result.ok) {
    for (const warning of result.warnings) {
      console.warn(`[env] UYARI: ${warning}`);
    }
  }

  if (!result.ok) {
    const detail = result.errors.map((e) => `  - ${e}`).join("\n");
    throw new Error(
      `Environment doğrulaması başarısız. Eksik/geçersiz değişkenler:\n${detail}\n` +
        "Gerçek değerleri .env.local dosyasına yazın (bkz. .env.example)."
    );
  }
}
