/**
 * Müşteri mesajı intent — fiyat/selamlama kapıları (kod, GPT değil).
 */

const PRICE_INTENT_RE =
  /\b(fiyat|fiyati|fiyatı|ücret|ucret|kaç\s*para|kac\s*para|ne\s*kadar|kaç\s*tl|kac\s*tl|paket\s*fiyat|bütçe|butce|fiyatlar|ücretler|ucretler)\b/i;

const GREETING_ONLY_RE =
  /^(merhaba|merhabalar|selam|selamlar|selamm+|hey|hi|hello|günaydın|gunaydin|iyi\s*akşamlar|iyi\s*aksamlar|iyi\s*günler|iyi\s*gunler|slm|mrb|naber|nbr|sa|as)([\s!.?,🙂😊]*)?$/i;

const INFORMAL_CHITCHAT_RE =
  /^(ne\s*diyorsun|ne\s*haber|naber|nbr|nasılsın|nasilsin|iyi\s*misin|iyimisin|ne\s*var|ne\s*yapıyorsun|ne\s*yapiyorsun)([\s\w!.?,🙂😊]*)?$/i;

/** Açık fiyat niyeti — yoksa GIVE_PRICE yasak. */
export function hasExplicitPriceIntent(message: string): boolean {
  return PRICE_INTENT_RE.test(message.trim());
}

/** Sadece selamlama / belirsiz giriş — fiyat/paket yasak. */
export function isGreetingOnly(message: string): boolean {
  const t = message.trim();
  if (!t || t.length > 48) return false;
  return GREETING_ONLY_RE.test(t);
}

/** Samimi sohbet / alakasız giriş — paket satma. */
export function isInformalChitchat(message: string): boolean {
  const t = message.trim();
  if (!t || t.length > 80) return false;
  if (hasExplicitPriceIntent(t)) return false;
  if (isGreetingOnly(t)) return false;
  return INFORMAL_CHITCHAT_RE.test(t) || /\baga\b/i.test(t);
}

/** Selamlama veya sohbet — discovery öncesi, fiyat kapalı. */
export function isNonSalesOpen(message: string): boolean {
  return isGreetingOnly(message) || isInformalChitchat(message);
}

/** İki metin aşırı benzer mi (duplicate reply). */
export function isNearDuplicateReply(a: string, b: string): boolean {
  const na = normalizeForDup(a);
  const nb = normalizeForDup(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length < 12) return false;
  if (longer.includes(shorter) && shorter.length / longer.length >= 0.85) {
    return true;
  }
  // Basit token overlap
  const ta = new Set(shorter.split(" ").filter((w) => w.length > 2));
  const tb = longer.split(" ").filter((w) => w.length > 2);
  if (ta.size === 0) return false;
  let hit = 0;
  for (const w of tb) if (ta.has(w)) hit += 1;
  return hit / ta.size >= 0.9;
}

function normalizeForDup(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
