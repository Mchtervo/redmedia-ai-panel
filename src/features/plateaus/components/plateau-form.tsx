"use client";

import { useState, useTransition } from "react";
import { savePlateauAction } from "@/features/reservations/actions/reservation-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PlateauForm() {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="border-border grid gap-2 rounded-lg border p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await savePlateauAction({
            name: String(fd.get("name") ?? ""),
            description: String(fd.get("description") ?? "") || undefined,
            address: String(fd.get("address") ?? "") || undefined,
            district: String(fd.get("district") ?? "") || undefined,
          });
          setMsg(result.success ? "Plato eklendi" : result.error);
          if (result.success) e.currentTarget.reset();
        });
      }}
    >
      <Input name="name" placeholder="Plato adı" required />
      <Input name="district" placeholder="İlçe" />
      <Input name="address" placeholder="Adres" className="sm:col-span-2" />
      <Input
        name="description"
        placeholder="Açıklama"
        className="sm:col-span-2"
      />
      <Button type="submit" disabled={isPending}>
        Ekle
      </Button>
      {msg ? <p className="text-muted-foreground text-sm">{msg}</p> : null}
    </form>
  );
}
