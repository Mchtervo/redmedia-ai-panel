"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_AXIS_TICK,
  CHART_COLORS,
  CHART_GRID_STROKE,
  resolveLabelFormatter,
  resolveValueFormatter,
  type ChartLabelFormat,
  type ChartValueFormat,
} from "@/components/charts/chart-theme";
import { ChartTooltipContent } from "@/components/charts/chart-tooltip";

export type TrendSeries = {
  key: string;
  /** Tooltip ve legend'da görünen Türkçe ad. */
  name: string;
  /** Boşsa sıradaki tema rengi kullanılır. */
  color?: string;
};

export type TrendPoint = Record<string, string | number>;

type TrendChartProps = {
  data: TrendPoint[];
  series: TrendSeries[];
  /** X ekseni alanı (örn. "date"). */
  xKey: string;
  kind?: "line" | "area" | "bar";
  height?: number;
  /** Server Component'ten kullanılabilmesi için formatlar isimle seçilir. */
  valueFormat?: ChartValueFormat;
  /** X ekseni etiket formatı (örn. ISO tarih → "12 Tem"). */
  xFormat?: ChartLabelFormat;
};

/**
 * Zaman serisi / karşılaştırma grafiği (line, area, bar tek bileşende).
 * Renkler tema token'larından gelir; eksen ve grid düşük kontrastta kalır.
 */
export function TrendChart({
  data,
  series,
  xKey,
  kind = "area",
  height = 240,
  valueFormat = "compact",
  xFormat = "none",
}: TrendChartProps) {
  const valueFormatter = resolveValueFormatter(valueFormat);
  const xFormatter = resolveLabelFormatter(xFormat);
  const commonAxes = (
    <>
      <CartesianGrid stroke={CHART_GRID_STROKE} vertical={false} />
      <XAxis
        dataKey={xKey}
        tick={CHART_AXIS_TICK}
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        minTickGap={24}
        tickFormatter={xFormatter}
      />
      <YAxis
        tick={CHART_AXIS_TICK}
        tickLine={false}
        axisLine={false}
        width={44}
        tickFormatter={(v: number) => valueFormatter(v)}
      />
      <Tooltip
        cursor={{ stroke: CHART_GRID_STROKE }}
        content={(props) => (
          <ChartTooltipContent
            active={props.active}
            payload={props.payload}
            label={
              xFormatter && typeof props.label === "string"
                ? xFormatter(props.label)
                : props.label
            }
            valueFormatter={valueFormatter}
          />
        )}
      />
    </>
  );

  if (kind === "bar") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {commonAxes}
          {series.map((s, index) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={s.color ?? CHART_COLORS[index % CHART_COLORS.length]}
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (kind === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {commonAxes}
          {series.map((s, index) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color ?? CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, index) => {
            const color =
              s.color ?? CHART_COLORS[index % CHART_COLORS.length];
            return (
              <linearGradient
                key={s.key}
                id={`trend-fill-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            );
          })}
        </defs>
        {commonAxes}
        {series.map((s, index) => {
          const color = s.color ?? CHART_COLORS[index % CHART_COLORS.length];
          return (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={color}
              strokeWidth={2}
              fill={`url(#trend-fill-${s.key})`}
              activeDot={{ r: 4 }}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}
