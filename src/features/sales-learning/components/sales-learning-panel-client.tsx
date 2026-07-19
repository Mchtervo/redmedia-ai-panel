"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  generateWeeklyReportAction,
  resolveMistakeAction,
} from "@/features/sales-learning/actions/sales-learning-actions";

export function WeeklyReportButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      const result = await generateWeeklyReportAction();
      setMessage(result.success ? result.message ?? "Tamam." : result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" size="sm" disabled={isPending} onClick={run}>
        {isPending ? "Oluşturuluyor…" : "Haftalık raporu şimdi oluştur"}
      </Button>
      {message ? (
        <p className="text-muted-foreground text-sm">{message}</p>
      ) : null}
    </div>
  );
}

export function ResolveMistakeButton({ mistakeId }: { mistakeId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await resolveMistakeAction({ mistakeId });
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={run}
      >
        Çözüldü işaretle
      </Button>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
