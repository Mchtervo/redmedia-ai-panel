"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateCeoDailyReportAction } from "@/features/ceo-intelligence/actions/ceo-actions";
import { Button } from "@/components/ui/button";

export function CeoRegenerateReportButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await regenerateCeoDailyReportAction();
          router.refresh();
        });
      }}
    >
      {pending ? "Üretiliyor…" : "Bugünkü raporu üret"}
    </Button>
  );
}
