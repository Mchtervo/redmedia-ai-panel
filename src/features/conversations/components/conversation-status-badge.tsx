import { Badge } from "@/components/ui/badge";
import type { ConversationStatus } from "@/features/conversations/types";

const STATUS_CONFIG: Record<ConversationStatus, { label: string; className: string }> = {
  open: {
    label: "Açık",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  pending: {
    label: "Bekliyor",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  closed: {
    label: "Kapalı",
    className: "border-border bg-muted text-muted-foreground",
  },
};

export function ConversationStatusBadge({ status }: { status: ConversationStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
