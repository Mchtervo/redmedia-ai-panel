import { cn } from "@/lib/utils";
import { formatNumberTr } from "@/components/charts/chart-theme";

export type FunnelStep = {
  label: string;
  value: number;
};

type FunnelChartProps = {
  steps: FunnelStep[];
  className?: string;
  valueFormatter?: (value: number) => string;
};

/**
 * Dönüşüm hunisi: her adım en yüksek değere oranlı yatay bar.
 * Adımlar arası dönüşüm yüzdesi metin olarak da verilir (renk tek başına değil).
 * Server Component uyumludur (SVG kütüphanesi gerekmez).
 */
export function FunnelChart({
  steps,
  className,
  valueFormatter = formatNumberTr,
}: FunnelChartProps) {
  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <ol className={cn("space-y-2.5", className)}>
      {steps.map((step, index) => {
        const widthPercent = Math.max((step.value / max) * 100, 2);
        const prev = index > 0 ? steps[index - 1] : null;
        const conversion =
          prev && prev.value > 0
            ? Math.round((step.value / prev.value) * 100)
            : null;

        return (
          <li key={step.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted-foreground font-medium">
                {step.label}
              </span>
              <span className="tabular-nums">
                <span className="font-semibold">
                  {valueFormatter(step.value)}
                </span>
                {conversion !== null ? (
                  <span className="text-muted-foreground ml-1.5">
                    %{conversion} geçiş
                  </span>
                ) : null}
              </span>
            </div>
            <div className="bg-muted h-2.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${widthPercent}%`,
                  background: `color-mix(in oklch, var(--chart-1) ${
                    100 - index * 12
                  }%, var(--chart-2))`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
