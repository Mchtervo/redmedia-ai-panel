"use client";

import { useState, useTransition } from "react";
import {
  addStaffLeaveAction,
  setStaffActiveAction,
} from "@/features/team/actions/staff-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UNAVAILABILITY_TYPES } from "@/features/team/types";

export function StaffQuickActions({
  staffId,
  active,
}: {
  staffId: string;
  active: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggleActive() {
    startTransition(async () => {
      const result = await setStaffActiveAction(staffId, !active);
      setMessage(result.success ? result.message ?? "Tamam" : result.error);
    });
  }

  function onLeave(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const start = String(formData.get("startAt") ?? "");
      const end = String(formData.get("endAt") ?? "");
      const result = await addStaffLeaveAction({
        staffMemberId: staffId,
        startAt: new Date(start).toISOString(),
        endAt: new Date(end).toISOString(),
        reason: String(formData.get("reason") ?? "") || undefined,
        type: String(formData.get("type") ?? "leave") as (typeof UNAVAILABILITY_TYPES)[number],
      });
      setMessage(result.success ? result.message ?? "Tamam" : result.error);
    });
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={toggleActive}
      >
        {active ? "Pasif yap" : "Aktif yap"}
      </Button>
      <form action={onLeave} className="space-y-2 rounded-lg border p-3">
        <h3 className="text-sm font-medium">İzin ekle</h3>
        <label className="block space-y-1 text-sm">
          <span>Başlangıç</span>
          <Input name="startAt" type="datetime-local" required />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Bitiş</span>
          <Input name="endAt" type="datetime-local" required />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Tür</span>
          <select
            name="type"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            defaultValue="leave"
          >
            {UNAVAILABILITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span>Gerekçe</span>
          <Input name="reason" />
        </label>
        <Button type="submit" disabled={isPending}>
          İzin kaydet
        </Button>
      </form>
      {message ? (
        <p className="text-muted-foreground text-sm" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
