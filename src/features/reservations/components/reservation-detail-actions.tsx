"use client";

import { useState, useTransition } from "react";
import {
  confirmDepositAction,
  markRemainingPaidAction,
  markShootCompletedAction,
  sendIbanAction,
} from "@/features/reservations/actions/reservation-actions";
import { Button } from "@/components/ui/button";

export function ReservationDetailActions({
  reservationId,
  canConfirmDeposit = false,
}: {
  reservationId: string;
  /** Vision ile doğrulanmış kapora dekontu var mı */
  canConfirmDeposit?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(
    action: () => Promise<{ success: boolean; message?: string; error?: string }>
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.success ? result.message ?? "Tamam" : result.error ?? "Hata");
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => run(() => sendIbanAction(reservationId))}
        >
          IBAN gönder
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPending || !canConfirmDeposit}
          title={
            canConfirmDeposit
              ? "Doğrulanmış dekont var — kapora onayı"
              : "Önce müşteri IBAN'a kapora yatırmalı ve dekont analizden geçmeli"
          }
          onClick={() => run(() => confirmDepositAction(reservationId))}
        >
          Ödeme Alındı
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={() => run(() => markShootCompletedAction(reservationId))}
        >
          Çekim tamamlandı
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => run(() => markRemainingPaidAction(reservationId))}
        >
          Kalan ödeme alındı
        </Button>
      </div>
      {!canConfirmDeposit ? (
        <p className="text-muted-foreground text-xs">
          Ödeme Alındı için: müşteri IBAN&apos;a kapora yatırmış olmalı, dekont
          ekran görüntüsü gelmeli ve analiz (receipt_verified) geçmeli. AI
          rezervasyonu kendisi kesinleştiremez.
        </p>
      ) : null}
      {message ? (
        <pre className="bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
          {message}
        </pre>
      ) : null}
    </div>
  );
}
