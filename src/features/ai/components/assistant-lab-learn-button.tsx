"use client";

import { useState, useTransition } from "react";
import { runLearningBatchAction } from "@/features/learning/actions/learning-actions";

export function AssistantLabLearnButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      const result = await runLearningBatchAction();
      setMessage(
        result.success
          ? (result.message ?? "Öğrenme tamamlandı. Sayfayı yenileyin.")
          : result.error
      );
      if (result.success) {
        // Hafıza kartlarının güncellenmesi için soft reload.
        window.location.reload();
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="bg-foreground text-background hover:opacity-90 disabled:opacity-40 rounded-md px-4 py-2 text-sm font-medium"
      >
        {pending ? "Öğreniyor…" : "Şimdi öğren (geçmiş konuşmalar)"}
      </button>
      {message ? (
        <p className="text-muted-foreground text-xs" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
