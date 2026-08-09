"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  runAutopilotAction,
  setAutopilotUiEnabledAction,
} from "@/features/marketing/actions/marketing-actions";
import { Button } from "@/components/ui/button";

export function AutopilotControls({
  envEnabled,
  uiEnabled,
  armed,
}: {
  envEnabled: boolean;
  uiEnabled: boolean;
  armed: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant={uiEnabled ? "destructive" : "default"}
        disabled={pending}
        onClick={() => {
          start(async () => {
            await setAutopilotUiEnabledAction(!uiEnabled);
            router.refresh();
          });
        }}
      >
        {uiEnabled ? "Acil durdur (UI)" : "UI kill-switch aç"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          start(async () => {
            await runAutopilotAction({ dryRun: true });
            router.refresh();
          });
        }}
      >
        Dry-run çalıştır
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={pending || !armed}
        onClick={() => {
          start(async () => {
            await runAutopilotAction({ dryRun: false });
            router.refresh();
          });
        }}
      >
        {armed ? "Canlı Autopilot çalıştır" : "Canlı kapalı (env+UI)"}
      </Button>
      <p className="text-muted-foreground w-full text-xs">
        ENV Autopilot: {envEnabled ? "açık" : "kapalı"} · UI:{" "}
        {uiEnabled ? "açık" : "kapalı"} · Silahlı: {armed ? "evet" : "hayır"}
      </p>
    </div>
  );
}
