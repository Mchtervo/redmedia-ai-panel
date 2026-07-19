import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Kullanıcıyı harekete davet eden buton/link. */
  action?: ReactNode;
  /** Kart içinde daha kompakt görünüm. */
  compact?: boolean;
  className?: string;
};

/**
 * Panel genelinde boş liste/tablo durumları için paylaşılan bileşen.
 * Boş ekran bir davettir: ne olmadığını ve ne yapılabileceğini söyler.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 text-center",
        compact ? "py-8" : "py-16",
        className
      )}
    >
      <div className="bg-muted flex size-10 items-center justify-center rounded-full">
        <Icon aria-hidden className="text-muted-foreground size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
