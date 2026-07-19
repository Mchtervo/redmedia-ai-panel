"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  deleteAutomationRuleAction,
  toggleAutomationRuleAction,
} from "@/features/automations/actions/automation-actions";

export function AutomationRuleButtons({
  ruleId,
  isEnabled,
}: {
  ruleId: string;
  isEnabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleAutomationRuleAction({
        ruleId,
        isEnabled: !isEnabled,
      });
      if (!result.success) setError(result.error);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAutomationRuleAction({ ruleId });
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={toggle}
      >
        {isEnabled ? "Devre dışı bırak" : "Etkinleştir"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={remove}
      >
        Sil
      </Button>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
