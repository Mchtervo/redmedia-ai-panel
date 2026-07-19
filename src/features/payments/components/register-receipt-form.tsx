"use client";

import { useState, useTransition } from "react";
import { registerReceiptAction } from "@/features/reservations/actions/reservation-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RegisterReceiptForm({
  reservations,
}: {
  reservations: Array<{ id: string; label: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="border-border space-y-2 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await registerReceiptAction({
            reservationId: String(fd.get("reservationId") ?? ""),
            fileUrl: String(fd.get("fileUrl") ?? ""),
            originalFilename:
              String(fd.get("originalFilename") ?? "") || undefined,
          });
          setMsg(result.success ? result.message ?? "OK" : result.error);
        });
      }}
    >
      <h2 className="font-medium">Dekont kaydı</h2>
      <select
        name="reservationId"
        required
        className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
      >
        <option value="">Rezervasyon seç</option>
        {reservations.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <Input name="fileUrl" placeholder="Dosya URL (Supabase Storage)" required />
      <Input name="originalFilename" placeholder="Dosya adı" />
      <Button type="submit" disabled={isPending}>
        Kaydet
      </Button>
      {msg ? <p className="text-muted-foreground text-sm">{msg}</p> : null}
    </form>
  );
}
