import { Badge } from "@/components/ui/badge";
import type { ContactStatus } from "@/features/contacts/types";

const STATUS_CONFIG: Record<
  ContactStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Aktif",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  archived: {
    label: "Arşivlendi",
    className: "border-border bg-muted text-muted-foreground",
  },
  blocked: {
    label: "Engellendi",
    className: "border-red-500/30 bg-red-500/10 text-red-400",
  },
};

export function CustomerStatusBadge({ status }: { status: ContactStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
