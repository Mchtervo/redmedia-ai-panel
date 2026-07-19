"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_COLORS, formatNumberTr } from "@/components/charts/chart-theme";
import { ChartTooltipContent } from "@/components/charts/chart-tooltip";

export type DonutSlice = {
  name: string;
  value: number;
  color?: string;
};

type DonutChartProps = {
  data: DonutSlice[];
  height?: number;
  /** Ortadaki büyük değer (örn. toplam). */
  centerLabel?: string;
  centerValue?: string;
  valueFormatter?: (value: number) => string;
};

/**
 * Donut grafik + yanında legend listesi. 5'ten fazla kategori için
 * bar chart tercih edin (no-pie-overuse).
 */
export function DonutChart({
  data,
  height = 200,
  centerLabel,
  centerValue,
  valueFormatter = formatNumberTr,
}: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={(props) => (
                <ChartTooltipContent
                  active={props.active}
                  payload={props.payload}
                  valueFormatter={valueFormatter}
                />
              )}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="92%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((slice, index) => (
                <Cell
                  key={slice.name}
                  fill={slice.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {centerValue ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-semibold tabular-nums">
              {centerValue}
            </span>
            {centerLabel ? (
              <span className="text-muted-foreground text-[11px]">
                {centerLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
        {data.map((slice, index) => {
          const percent = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          return (
            <li
              key={slice.name}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{
                    background:
                      slice.color ?? CHART_COLORS[index % CHART_COLORS.length],
                  }}
                />
                <span className="truncate">{slice.name}</span>
              </span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {valueFormatter(slice.value)} · %{percent}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
