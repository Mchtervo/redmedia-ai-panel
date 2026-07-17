"use client";

import { useState, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendStaffMessageAction } from "@/features/conversations/actions/conversation-actions";

export function ReplyBox({ conversationId }: { conversationId: string }) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    const result = await sendStaffMessageAction(conversationId, trimmed);

    if (result.success) {
      setContent("");
    } else {
      setError(result.error);
    }

    setIsSending(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border p-3">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex items-end gap-2">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          placeholder="Mesaj yaz… (Enter ile gönder, Shift+Enter ile yeni satır)"
          rows={2}
          className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          type="button"
          size="sm"
          disabled={isSending || content.trim().length === 0}
          onClick={() => void handleSend()}
        >
          <Send />
          {isSending ? "Gönderiliyor…" : "Gönder"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Not: Bu mesaj yalnızca panelde kaydedilir; ChatPlace entegrasyonu
        henüz bağlanmadığı için gerçek müşteriye iletilmez.
      </p>
    </div>
  );
}
