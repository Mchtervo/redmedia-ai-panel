import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "brand";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success/12 text-success",
  warning: "bg-warning/14 text-warning",
  danger: "bg-destructive/12 text-destructive",
  info: "bg-info/12 text-info",
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-primary/12 text-primary",
};

const DOT_CLASSES: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground",
  brand: "bg-primary",
};

type StatusBadgeProps = {
  tone: StatusTone;
  children: ReactNode;
  /** Renk körlüğü için renk + nokta + metin birlikte kullanılır. */
  withDot?: boolean;
  className?: string;
};

/** Anlamsal durum rozeti: durum bilgisi renk + metin (+nokta) ile iletilir. */
export function StatusBadge({
  tone,
  children,
  withDot = true,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5.5 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
    >
      {withDot ? (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", DOT_CLASSES[tone])}
        />
      ) : null}
      {children}
    </span>
  );
}
