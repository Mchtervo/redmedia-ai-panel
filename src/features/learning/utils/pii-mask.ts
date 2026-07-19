/**
 * Telefon, e-posta ve benzeri kişisel verileri eğitim/knowledge metninden maskeler.
 * Hassas değerler loglanmaz.
 */

const PHONE_PATTERN =
  /(?:\+90[\s.-]?)?0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}|\b0\d{10}\b|\b\d{10,13}\b/g;

const EMAIL_PATTERN =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const INSTAGRAM_HANDLE_IN_TEXT = /(?<![/@\w])@([a-zA-Z0-9._]{2,30})\b/g;

export function maskPii(text: string): string {
  if (!text) {
    return text;
  }

  return text
    .replace(EMAIL_PATTERN, "[e-posta-gizli]")
    .replace(PHONE_PATTERN, "[telefon-gizli]")
    .replace(INSTAGRAM_HANDLE_IN_TEXT, "@[kullanici-gizli]");
}

export function maskPiiDeep<T>(value: T): T {
  if (typeof value === "string") {
    return maskPii(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskPiiDeep(item)) as T;
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = maskPiiDeep(nested);
    }
    return result as T;
  }

  return value;
}
