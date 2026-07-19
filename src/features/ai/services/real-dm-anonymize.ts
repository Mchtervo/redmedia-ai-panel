/**
 * Gerçek DM anonimleştirme — raporlarda PII görünmez.
 */

import { maskPii } from "@/features/learning/utils/pii-mask";

const ADDRESS_PATTERN =
  /\b(mah\.|mahallesi|cad\.|caddesi|sok\.|sokak|bulvar|no\s*:?\s*\d+|kat\s*:?\s*\d+|daire\s*:?\s*\d+)\b/gi;

const TURKISH_NAME_HINT =
  /\b(benim adım|adım|ismim|ben)\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,20})(\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,20})?/gi;

const IBAN_PATTERN = /\bTR\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2}\b/gi;

/** Rapor/UI için metin anonimleştir. */
export function anonymizeDmText(text: string): string {
  if (!text) return text;
  return maskPii(text)
    .replace(IBAN_PATTERN, "[iban-gizli]")
    .replace(ADDRESS_PATTERN, "[adres-gizli]")
    .replace(TURKISH_NAME_HINT, "benim adım [isim-gizli]")
    .replace(/\b\d{5,}\b/g, "[sayi-gizli]");
}

/** Müşteri etiket adı — gerçek isim/username yok. */
export function anonymizeCustomerLabel(params: {
  conversationId: string;
  index?: number;
}): string {
  const short = params.conversationId.replace(/-/g, "").slice(0, 6);
  const n = params.index != null ? String(params.index + 1).padStart(3, "0") : short;
  return `Müşteri #${n}`;
}
