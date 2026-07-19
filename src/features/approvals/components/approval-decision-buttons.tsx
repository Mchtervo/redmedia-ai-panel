"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { decideApprovalAction } from "@/features/approvals/actions/approval-actions";

export function ApprovalDecisionButtons({ approvalId }: { approvalId: string }) {
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const result = await decideApprovalAction({
        approvalId,
        decision,
        note: note.trim() || undefined,
      });
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-muted-foreground text-xs">
          Karar notu (opsiyonel)
        </span>
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          className="border-input bg-background mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
          placeholder="Örn. %10 indirim onaylandı, müşteri arandı"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => decide("approved")}
        >
          Onayla
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => decide("rejected")}
        >
          Reddet
        </Button>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
    </div>
  );
}
