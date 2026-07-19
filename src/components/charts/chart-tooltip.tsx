"use client";

import type { TooltipContentProps } from "recharts";

type ValueFormatter = (value: number) => string;

/**
 * Tüm grafiklerde ortak, tema uyumlu tooltip içeriği.
 * recharts'ın varsayılan beyaz kutusu yerine kart yüzeyi kullanılır.
 */
export function ChartTooltipContent({
  active,
  payload,
  label,
  valueFormatter,
}: Pick<TooltipContentProps<number, string>, "active" | "payload" | "label"> & {
  valueFormatter?: ValueFormatter;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-popover text-popover-foreground min-w-32 rounded-lg border border-border px-3 py-2 text-xs shadow-lg">
      {label !== undefined && label !== "" ? (
        <p className="text-muted-foreground mb-1 font-medium">{String(label)}</p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((entry) => (
          <li
            key={String(entry.dataKey ?? entry.name)}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: entry.color ?? "var(--chart-1)" }}
              />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums">
              {typeof entry.value === "number"
                ? (valueFormatter ?? ((v: number) => v.toLocaleString("tr-TR")))(
                    entry.value
                  )
                : String(entry.value ?? "—")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
