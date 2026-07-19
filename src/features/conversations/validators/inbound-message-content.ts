/**
 * ChatPlace / Meta üzerinden gelen metin temizliği.
 * UI değişkeni çözülmeden gelen "StoppedStatusLabel" gibi çöp içerikler
 * müşteri mesajı sanılmasın.
 */

/** Çözülmemiş şablon / UI label / boş gürültü. */
export function isJunkInboundMessageContent(content: string | null | undefined): boolean {
  const t = content?.trim() ?? "";
  if (!t) return true;

  // {{ variable }} çözülmemiş
  if (t.includes("{{") && t.includes("}}")) return true;

  // ChatPlace / builder UI label sızıntıları (örn. StoppedStatusLabel)
  if (/^[A-Z][A-Za-z0-9]*(StatusLabel|Label|Placeholder)$/.test(t)) {
    return true;
  }
  if (/StatusLabel|StoppedStatus/i.test(t) && t.length < 80 && !/\s/.test(t)) {
    return true;
  }

  // Tek kelime camelCase sistem string
  if (/^[A-Z][a-z]+([A-Z][a-z]+)+$/.test(t) && t.length < 64) {
    return true;
  }

  return false;
}
