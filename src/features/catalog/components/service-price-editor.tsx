"use client";

import { useState, useTransition } from "react";
import { updateServicePriceAction } from "@/features/reservations/actions/reservation-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ServicePriceEditor({
  serviceId,
  initialPrice,
}: {
  serviceId: string;
  initialPrice: number;
}) {
  const [price, setPrice] = useState(String(initialPrice));
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Input
        className="w-28"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        type="number"
      />
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await updateServicePriceAction(
              serviceId,
              Number(price)
            );
            setMsg(result.success ? "Kaydedildi" : result.error);
          });
        }}
      >
        Kaydet
      </Button>
      {msg ? <span className="text-muted-foreground text-xs">{msg}</span> : null}
    </div>
  );
}
