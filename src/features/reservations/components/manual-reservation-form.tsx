"use client";

import { useState, useTransition } from "react";
import { createReservationAction } from "@/features/reservations/actions/reservation-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ServiceOption = { id: string; name: string; base_price: number };
type PlatoOption = { id: string; name: string };

export function ManualReservationForm({
  services,
  plateaus,
}: {
  services: ServiceOption[];
  plateaus: PlatoOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function onSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await createReservationAction({
        customerFullName: String(formData.get("customerFullName") ?? ""),
        customerPhone: String(formData.get("customerPhone") ?? "") || undefined,
        eventType: String(formData.get("eventType") ?? "") || undefined,
        eventDate: String(formData.get("eventDate") ?? ""),
        startTime: String(formData.get("startTime") ?? "") || undefined,
        endTime: String(formData.get("endTime") ?? "") || undefined,
        venueName: String(formData.get("venueName") ?? "") || undefined,
        selectedPlatoId:
          String(formData.get("selectedPlatoId") ?? "") || undefined,
        serviceIds: selected,
        depositAmount: formData.get("depositAmount")
          ? Number(formData.get("depositAmount"))
          : undefined,
        customerNotes: String(formData.get("customerNotes") ?? "") || undefined,
        internalNotes: String(formData.get("internalNotes") ?? "") || undefined,
        conflictOverride: formData.get("conflictOverride") === "on",
        conflictOverrideReason:
          String(formData.get("conflictOverrideReason") ?? "") || undefined,
      });
      setMessage(
        result.success
          ? `${result.message}${result.id ? ` (#${result.id.slice(0, 8)})` : ""}`
          : result.error
      );
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>Ad Soyad</span>
          <Input name="customerFullName" required />
        </label>
        <label className="space-y-1 text-sm">
          <span>Telefon</span>
          <Input name="customerPhone" />
        </label>
        <label className="space-y-1 text-sm">
          <span>Etkinlik türü</span>
          <Input name="eventType" placeholder="nişan / düğün / kına" />
        </label>
        <label className="space-y-1 text-sm">
          <span>Tarih</span>
          <Input name="eventDate" type="date" required />
        </label>
        <label className="space-y-1 text-sm">
          <span>Başlangıç</span>
          <Input name="startTime" type="time" />
        </label>
        <label className="space-y-1 text-sm">
          <span>Bitiş</span>
          <Input name="endTime" type="time" />
        </label>
        <label className="space-y-1 text-sm">
          <span>Mekân adı</span>
          <Input name="venueName" />
        </label>
        <label className="space-y-1 text-sm">
          <span>Plato</span>
          <select
            name="selectedPlatoId"
            className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
          >
            <option value="">—</option>
            {plateaus.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Kapora (TL)</span>
          <Input name="depositAmount" type="number" defaultValue={1000} />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Hizmetler</legend>
        <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
          {services.map((service) => (
            <label key={service.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(service.id)}
                onChange={() => toggle(service.id)}
              />
              <span>
                {service.name} —{" "}
                {Number(service.base_price).toLocaleString("tr-TR")} TL
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="space-y-1 text-sm">
        <span>Müşteri notu</span>
        <Input name="customerNotes" />
      </label>
      <label className="space-y-1 text-sm">
        <span>Admin notu</span>
        <Input name="internalNotes" />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="conflictOverride" />
        Çakışmaya rağmen devam et (gerekçe zorunlu)
      </label>
      <Input
        name="conflictOverrideReason"
        placeholder="Override gerekçesi"
      />

      <Button type="submit" disabled={isPending || selected.length === 0}>
        Rezervasyon oluştur
      </Button>
      {message ? (
        <p className="text-muted-foreground text-sm">{message}</p>
      ) : null}
    </form>
  );
}
