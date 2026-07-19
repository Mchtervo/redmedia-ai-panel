"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  generatePlaybookDraftAction,
  setPlaybookStatusAction,
} from "@/features/playbooks/actions/playbook-actions";
import type { PlaybookStatus } from "@/features/playbooks/types";

export function GeneratePlaybookButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      const result = await generatePlaybookDraftAction();
      setMessage(result.success ? (result.message ?? "Tamam.") : result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" size="sm" disabled={isPending} onClick={run}>
        {isPending ? "Üretiliyor…" : "Kanıtlardan playbook taslağı üret"}
      </Button>
      {message ? (
        <p className="text-muted-foreground text-sm">{message}</p>
      ) : null}
    </div>
  );
}

export function PlaybookStatusButtons({
  playbookId,
  status,
}: {
  playbookId: string;
  status: PlaybookStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setStatus(next: PlaybookStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setPlaybookStatusAction({ playbookId, status: next });
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "active" && status !== "archived" ? (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => setStatus("active")}
        >
          Aktifleştir
        </Button>
      ) : null}
      {status === "active" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => setStatus("archived")}
        >
          Arşivle
        </Button>
      ) : null}
      {status === "archived" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => setStatus("draft")}
        >
          Taslağa geri al
        </Button>
      ) : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
