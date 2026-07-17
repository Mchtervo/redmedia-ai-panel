import { ConversationActionsBar } from "@/features/conversations/components/conversation-actions-bar";
import type { ConversationWithRelations } from "@/features/conversations/types";

const CHANNEL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
};

type ConversationHeaderProps = {
  conversation: ConversationWithRelations;
  currentUserId: string;
  aiRunsCount: number;
};

export function ConversationHeader({
  conversation,
  currentUserId,
  aiRunsCount,
}: ConversationHeaderProps) {
  const displayName = conversation.contact?.full_name ?? "İsimsiz müşteri";

  return (
    <div className="flex flex-col gap-3 border-b border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{displayName}</h2>
          <p className="text-sm text-muted-foreground">
            {conversation.contact?.username ? `@${conversation.contact.username}` : "—"}
            {" · "}
            {CHANNEL_LABELS[conversation.channel] ?? conversation.channel}
          </p>
        </div>
      </div>

      <ConversationActionsBar
        conversationId={conversation.id}
        status={conversation.status}
        assigneeId={conversation.assigned_to}
        currentUserId={currentUserId}
      />

      <p className="text-xs text-muted-foreground">
        AI Geçmişi:{" "}
        {aiRunsCount === 0
          ? "Henüz AI etkileşimi yok."
          : `${aiRunsCount} etkileşim (OpenAI bağlanınca detaylandırılacak).`}
      </p>
    </div>
  );
}
