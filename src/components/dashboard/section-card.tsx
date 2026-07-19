import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  description?: string;
  /** Başlığın sağındaki aksiyon (buton, link, filtre). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Dashboard bölüm kartı: başlık + açıklama + içerik.
 * Sayfalardaki tüm "Section" ihtiyaçları için tek bileşen.
 */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "bg-card flex flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("flex-1 p-4", contentClassName)}>{children}</div>
    </section>
  );
}
