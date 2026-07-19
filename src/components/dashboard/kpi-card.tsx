import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type KpiTrend = {
  /** Yüzde değişim; pozitif = artış. */
  changePercent: number;
  /** Artış iyi mi? (örn. maliyet için artış kötüdür.) */
  positiveIsGood?: boolean;
  /** Karşılaştırma bağlamı, örn. "önceki 30 güne göre". */
  label?: string;
};

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  trend?: KpiTrend;
  /** Sağ üstte küçük görsel (sparkline vb.). */
  visual?: ReactNode;
  className?: string;
};

/**
 * KPI kartı: büyük tabular sayı + isteğe bağlı trend oku ve sparkline.
 * Trend yönü renk + ok ikonu + metin ile birlikte verilir (renk tek başına değil).
 */
export function KpiCard({
  label,
  value,
  hint,
  trend,
  visual,
  className,
}: KpiCardProps) {
  const trendGood =
    trend !== undefined
      ? trend.changePercent === 0
        ? null
        : trend.changePercent > 0 === (trend.positiveIsGood ?? true)
      : null;

  return (
    <div
      className={cn(
        "group bg-card relative flex flex-col gap-1 overflow-hidden rounded-xl p-4 ring-1 ring-foreground/10 transition-shadow duration-200 hover:ring-foreground/20",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        {visual ? <div className="shrink-0 opacity-80">{visual}</div> : null}
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
              trendGood === null
                ? "text-muted-foreground"
                : trendGood
                  ? "text-success"
                  : "text-destructive"
            )}
          >
            {trend.changePercent === 0 ? (
              <Minus aria-hidden className="size-3" />
            ) : trend.changePercent > 0 ? (
              <ArrowUpRight aria-hidden className="size-3" />
            ) : (
              <ArrowDownRight aria-hidden className="size-3" />
            )}
            %{Math.abs(trend.changePercent).toLocaleString("tr-TR")}
            {trend.label ? (
              <span className="text-muted-foreground ml-1 font-normal">
                {trend.label}
              </span>
            ) : null}
          </span>
        ) : null}
        {hint ? (
          <span className="text-muted-foreground text-xs">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}
