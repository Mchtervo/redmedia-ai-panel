import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * ChatPlace webhook imza doğrulaması.
 *
 * ChatPlace, isteğin ham gövdesi (raw body) üzerinden hesaplanan bir
 * HMAC-SHA256 imzasını bir header ile gönderir. İmza, paylaşılan gizli
 * anahtar (`CHATPLACE_WEBHOOK_SECRET`) ile doğrulanır (bkz.
 * `.cursor/rules/02-security.mdc`, `docs/CHATPLACE.md`).
 *
 * Not: Gerçek ChatPlace dokümantasyonu elde edildiğinde header adı ve imza
 * formatı (prefix, encoding) buna göre ayarlanmalıdır. Şu an yaygın konvansiyon
 * varsayılır: header `x-chatplace-signature`, değer `sha256=<hex>` veya `<hex>`.
 */
export const CHATPLACE_SIGNATURE_HEADER = "x-chatplace-signature";

/** İmza değeri hex digest üretir. Test araçları da bu fonksiyonu kullanır. */
export function computeChatPlaceSignature(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/**
 * Header'daki imzayı, gövdeden hesaplanan beklenen imzayla timing-safe
 * karşılaştırır. Secret tanımlı değilse veya imza yoksa/eşleşmezse `false`
 * döner (fail-closed).
 */
export function verifyChatPlaceSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string | undefined
): boolean {
  if (!secret || !signatureHeader) {
    return false;
  }

  // Yaygın `sha256=<hex>` prefix'ini destekle.
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;

  const expected = computeChatPlaceSignature(rawBody, secret);

  // timingSafeEqual, eşit uzunlukta buffer'lar gerektirir; farklı uzunlukta
  // ise (geçersiz format) kısa devre yapılır.
  const providedBuffer = Buffer.from(provided, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
