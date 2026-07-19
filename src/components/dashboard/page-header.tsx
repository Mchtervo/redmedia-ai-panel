import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Sağa hizalanan aksiyonlar (buton, filtre). */
  actions?: ReactNode;
  /** Başlığın üstünde küçük bağlam etiketi (örn. "Pazarlama"). */
  eyebrow?: string;
  className?: string;
};

/**
 * Tüm dashboard sayfalarında ortak sayfa başlığı.
 * Hiyerarşi: eyebrow (bağlam) → h1 (iş) → açıklama (ne yapar).
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 pb-2 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <p className="text-primary text-xs font-medium tracking-wide uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
