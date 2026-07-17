import Link from "next/link";
import { UserRound } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { ConversationStatusBadge } from "@/features/conversations/components/conversation-status-badge";
import type { ConversationWithRelations } from "@/features/conversations/types";

const CHANNEL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
};

type ConversationListItemProps = {
  conversation: ConversationWithRelations;
  isActive: boolean;
};

export function ConversationListItem({ conversation, isActive }: ConversationListItemProps) {
  const displayName = conversation.contact?.full_name ?? "İsimsiz müşteri";

  return (
    <Link
      href={`/dashboard/inbox/${conversation.id}`}
      className={cn(
        "flex flex-col gap-1.5 border-b border-border p-3 transition-colors hover:bg-muted/50",
        isActive && "bg-muted"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{displayName}</span>
        <ConversationStatusBadge status={conversation.status} />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{CHANNEL_LABELS[conversation.channel] ?? conversation.channel}</span>
        <span>{formatDateTime(conversation.last_message_at)}</span>
      </div>
      {conversation.assignee ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <UserRound className="size-3" />
          <span className="truncate">
            {conversation.assignee.full_name ?? conversation.assignee.email}
          </span>
        </div>
      ) : null}
    </Link>
  );
}
