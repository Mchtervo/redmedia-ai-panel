"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  assignToMeAction,
  syncChatPlaceMessagesAction,
  unassignConversationAction,
  updateConversationStatusAction,
} from "@/features/conversations/actions/conversation-actions";
import { CONVERSATION_STATUS_VALUES, type ConversationStatus } from "@/features/conversations/types";

const STATUS_LABELS: Record<ConversationStatus, string> = {
  open: "Açık",
  pending: "Bekleyen",
  closed: "Kapalı",
};

type ConversationActionsBarProps = {
  conversationId: string;
  status: ConversationStatus;
  assigneeId: string | null;
  currentUserId: string;
};

export function ConversationActionsBar({
  conversationId,
  status,
  assigneeId,
  currentUserId,
}: ConversationActionsBarProps) {
  const [isPending, setIsPending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);

  const isAssignedToMe = assigneeId === currentUserId;

  async function handleStatusChange(next: ConversationStatus) {
    if (next === status || isPending) {
      return;
    }
    setIsPending(true);
    setError(null);
    const result = await updateConversationStatusAction(conversationId, next);
    if (!result.success) {
      setError(result.error);
    }
    setIsPending(false);
  }

  async function handleAssignToggle() {
    if (isPending) {
      return;
    }
    setIsPending(true);
    setError(null);
    const result = isAssignedToMe
      ? await unassignConversationAction(conversationId)
      : await assignToMeAction(conversationId);
    if (!result.success) {
      setError(result.error);
    }
    setIsPending(false);
  }

  async function handleSyncMessages() {
    if (isSyncing || isPending) return;
    setIsSyncing(true);
    setError(null);
    setSyncInfo(null);
    const result = await syncChatPlaceMessagesAction(conversationId);
    if (!result.success) {
      setError(result.error);
    } else {
      const n = result.imported ?? 0;
      setSyncInfo(
        n > 0
          ? `${n} mesaj ChatPlace'ten çekildi.`
          : "Yeni mesaj yok; kayıtlar güncel görünüyor."
      );
    }
    setIsSyncing(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {CONVERSATION_STATUS_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              disabled={isPending}
              onClick={() => void handleStatusChange(value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                status === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {STATUS_LABELS[value]}
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => void handleAssignToggle()}
        >
          {isAssignedToMe ? "Atamayı Kaldır" : "Bana Ata"}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending || isSyncing}
          onClick={() => void handleSyncMessages()}
        >
          {isSyncing ? "Çekiliyor…" : "Mesajları Yenile"}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {syncInfo ? (
        <p className="text-xs text-muted-foreground">{syncInfo}</p>
      ) : null}
    </div>
  );
}
