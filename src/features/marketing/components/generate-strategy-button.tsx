"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateStrategyAction } from "@/features/marketing/actions/marketing-actions";
import { Button } from "@/components/ui/button";

export function GenerateStrategyButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() => {
        start(async () => {
          await generateStrategyAction({
            title: `Günlük strateji ${new Date().toLocaleDateString("tr-TR")}`,
            budgetAmount: 1500,
            periodType: "daily",
          });
          router.refresh();
        });
      }}
    >
      {pending ? "Üretiliyor…" : "Strateji üret"}
    </Button>
  );
}
