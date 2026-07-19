"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateMarketingDailyReportAction,
  rebuildAttributionFunnelAction,
} from "@/features/marketing/actions/marketing-actions";
import { Button } from "@/components/ui/button";

export function GenerateMarketingReportButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        start(async () => {
          await generateMarketingDailyReportAction();
          router.refresh();
        });
      }}
    >
      {pending ? "Üretiliyor…" : "Günlük rapor üret"}
    </Button>
  );
}

export function RebuildFunnelButton({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        start(async () => {
          await rebuildAttributionFunnelAction(contactId);
          router.refresh();
        });
      }}
    >
      {pending ? "Yenileniyor…" : "Funnel yenile"}
    </Button>
  );
}
