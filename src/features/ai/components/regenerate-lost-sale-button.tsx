"use client";

import { useState, useTransition } from "react";
import { regenerateLostSaleAnalysisAction } from "@/features/ai/actions/correction-actions";

export function RegenerateLostSaleButton({
  conversationId,
}: {
  conversationId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="border-border hover:bg-muted rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await regenerateLostSaleAnalysisAction(
              conversationId
            );
            if (!result.success) setError(result.error.message);
          });
        }}
      >
        {pending ? "Analiz üretiliyor…" : "Kayıp analizi yenile"}
      </button>
      {error ? (
        <p className="text-destructive mt-2 text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
