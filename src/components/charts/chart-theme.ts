/**
 * Chart tema sabitleri: tüm grafikler CSS değişkenlerinden renk alır,
 * böylece açık/koyu tema ve marka değişiklikleri tek yerden yönetilir.
 */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export const CHART_GRID_STROKE = "color-mix(in oklch, var(--foreground) 8%, transparent)";
export const CHART_AXIS_TICK = {
  fill: "var(--muted-foreground)",
  fontSize: 11,
} as const;

export function formatCompactTr(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumberTr(value: number): string {
  return new Intl.NumberFormat("tr-TR").format(value);
}

export function formatTryCompact(value: number): string {
  return `${formatCompactTr(value)} ₺`;
}

/** ISO tarih (YYYY-MM-DD) → kısa Türkçe etiket (örn. "12 Tem"). */
export function formatShortDateTr(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
  }).format(date);
}

/**
 * Server Component'ten Client Component'e fonksiyon geçirilemediği için
 * formatlar isimle seçilir; çözümleme client tarafında yapılır.
 */
export type ChartValueFormat = "number" | "compact" | "currency";
export type ChartLabelFormat = "none" | "shortDate";

export function resolveValueFormatter(
  format: ChartValueFormat
): (value: number) => string {
  switch (format) {
    case "currency":
      return formatTryCompact;
    case "number":
      return formatNumberTr;
    default:
      return formatCompactTr;
  }
}

export function resolveLabelFormatter(
  format: ChartLabelFormat
): ((value: string) => string) | undefined {
  return format === "shortDate" ? formatShortDateTr : undefined;
}
