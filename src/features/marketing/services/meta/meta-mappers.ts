/** Meta effective_status → DB status */

export function mapMetaEntityStatus(
  raw: string | null | undefined
): "active" | "paused" | "archived" | "deleted" | null {
  if (!raw) return null;
  const s = raw.toUpperCase();
  if (s === "ACTIVE" || s === "ENABLED") return "active";
  if (
    s === "PAUSED" ||
    s === "CAMPAIGN_PAUSED" ||
    s === "ADSET_PAUSED" ||
    s === "WITH_ISSUES"
  ) {
    return "paused";
  }
  if (s === "ARCHIVED") return "archived";
  if (s === "DELETED" || s === "PENDING_REVIEW" || s === "DISAPPROVED") {
    return s === "DELETED" ? "deleted" : "paused";
  }
  return "paused";
}

/** Meta bütçe genelde kuruş/cent — major currency'ye çevir. */
export function metaBudgetToMajor(amount: string | number | null | undefined): number | null {
  if (amount === null || amount === undefined || amount === "") return null;
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return null;
  return Math.round((n / 100) * 100) / 100;
}

export function normalizeAdAccountId(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("act_")) return t;
  return `act_${t}`;
}

export function envAdAccountId(): string {
  return normalizeAdAccountId(process.env.META_AD_ACCOUNT_ID?.trim() ?? "");
}

export function envPageId(): string {
  return process.env.META_PAGE_ID?.trim() ?? "";
}

export function envIgAccountId(): string {
  return process.env.META_INSTAGRAM_ACCOUNT_ID?.trim() ?? "";
}

export function envBusinessId(): string {
  return process.env.META_BUSINESS_ID?.trim() ?? "";
}

export function envPixelId(): string {
  return process.env.META_PIXEL_ID?.trim() ?? "";
}
