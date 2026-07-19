"use client";

import { useTransition } from "react";
import { toggleCampaignAction } from "@/features/reservations/actions/reservation-actions";
import { Button } from "@/components/ui/button";

export function CampaignToggle({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await toggleCampaignAction(id, !active);
        })
      }
    >
      {active ? "Aktif" : "Pasif"}
    </Button>
  );
}
