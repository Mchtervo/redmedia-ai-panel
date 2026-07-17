/**
 * Basit, bağımlılıksız, sabit-pencere (fixed-window) rate limiter.
 *
 * UYARI: Bu limiter süreç-içi (in-memory) bir Map kullanır — yalnızca tek
 * instance için ve süreç yeniden başlayınca sıfırlanır. Serverless/çok
 * instance'lı ortamda tam koruma sağlamaz; "best-effort" bir katmandır
 * (bkz. `.cursor/rules/02-security.mdc`). Üretimde paylaşımlı bir depo
 * (örn. Upstash Redis) ile değiştirilmesi önerilir. Gerçek dağıtım kararı
 * verilene kadar ek bağımlılık eklenmemiştir.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}
