import { cn } from "@/lib/utils";

type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  /** Varsayılan marka rengi; "auto" son değer ilk değerden düşükse kırmızı. */
  tone?: "brand" | "auto" | "muted";
  className?: string;
  /** Ekran okuyucular için kısa özet. */
  label?: string;
};

/**
 * Saf SVG sparkline — Server Component uyumlu, KPI kartlarının köşesinde
 * mini trend göstermek için.
 */
export function Sparkline({
  values,
  width = 72,
  height = 24,
  tone = "brand",
  className,
  label,
}: SparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - 2 - ((value - min) / range) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const declining = values[values.length - 1] < values[0];
  const stroke =
    tone === "muted"
      ? "var(--muted-foreground)"
      : tone === "auto" && declining
        ? "var(--destructive)"
        : tone === "auto"
          ? "var(--success)"
          : "var(--chart-1)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("overflow-visible", className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
