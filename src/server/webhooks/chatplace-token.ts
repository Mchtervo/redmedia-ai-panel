import { createHash, timingSafeEqual } from "node:crypto";

/**
 * ChatPlace webhook statik token doğrulaması.
 *
 * ChatPlace External API Request ekranı dinamik HMAC üretemiyorsa, paylaşılan
 * sabit bir token header ile gönderilir ve burada timing-safe karşılaştırılır.
 * HMAC doğrulaması (`chatplace-signature.ts`) kaldırılmaz; ikisi de kabul
 * yoludur (bkz. docs/CHATPLACE.md).
 */
export const CHATPLACE_TOKEN_HEADER = "x-chatplace-token";

/**
 * Header'daki token'ı `CHATPLACE_WEBHOOK_TOKEN` ile timing-safe karşılaştırır.
 * Env veya header boşsa `false` (fail-closed).
 */
export function verifyChatPlaceToken(
  tokenHeader: string | null | undefined,
  expectedToken: string | undefined
): boolean {
  const provided = tokenHeader?.trim();
  const expected = expectedToken?.trim();

  if (!expected || !provided) {
    return false;
  }

  // Uzunluk farkında timingSafeEqual hata verir; her iki tarafı da SHA-256
  // ile sabitleyerek sabit uzunlukta karşılaştırma yapılır.
  // Token değeri asla loglanmaz.
  const providedDigest = createHash("sha256").update(provided, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();

  return timingSafeEqual(providedDigest, expectedDigest);
}
