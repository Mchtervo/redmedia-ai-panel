"use client";

import { useState, useTransition } from "react";
import {
  applySuggestedReplyAction,
  scheduleCorrectionFollowUpAction,
} from "@/features/ai/actions/correction-actions";

type Props = {
  conversationId: string;
  initialText: string;
  lossReason: string;
  alreadyApplied: boolean;
  successHint: string | null;
};

export function ApplySuggestedReplyForm({
  conversationId,
  initialText,
  lossReason,
  alreadyApplied,
  successHint,
}: Props) {
  const [text, setText] = useState(initialText);
  const [scheduleFollowUp, setScheduleFollowUp] = useState(true);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {successHint ? (
        <p className="text-muted-foreground text-xs">{successHint}</p>
      ) : null}

      <label className="block text-sm font-medium" htmlFor="suggested-reply">
        Gönderilecek cevap
      </label>
      <textarea
        id="suggested-reply"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm leading-relaxed"
        disabled={pending}
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={scheduleFollowUp}
          onChange={(e) => setScheduleFollowUp(e.target.checked)}
          disabled={pending}
        />
        Gönderimden sonra otomatik takip görevi oluştur
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !text.trim()}
          className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
          onClick={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await applySuggestedReplyAction({
                conversationId,
                text,
                originalSuggestion: initialText,
                lossReason,
                scheduleFollowUp,
              });
              if (!result.success) {
                setError(result.error.message);
                return;
              }
              setMessage(
                result.data?.followUpTaskId
                  ? "Cevap gönderildi ve takip planlandı."
                  : "Cevap gönderildi."
              );
            });
          }}
        >
          {pending
            ? "Gönderiliyor…"
            : alreadyApplied
              ? "Tekrar gönder"
              : "Tek tıkla gönder"}
        </button>

        <button
          type="button"
          disabled={pending}
          className="border-border hover:bg-muted rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60"
          onClick={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result =
                await scheduleCorrectionFollowUpAction(conversationId);
              if (!result.success) {
                setError(result.error.message);
                return;
              }
              setMessage(
                result.data?.followUpTaskId
                  ? "Takip görevi oluşturuldu."
                  : "Takip oluşturulamadı (limit veya contact eksik)."
              );
            });
          }}
        >
          Yalnızca takip planla
        </button>
      </div>

      {message ? (
        <p className="text-sm" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
