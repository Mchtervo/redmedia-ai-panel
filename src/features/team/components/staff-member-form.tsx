"use client";

import { useState, useTransition } from "react";
import { saveStaffMemberAction } from "@/features/team/actions/staff-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RoleOption = { id: string; name: string; slug: string };

export function StaffMemberForm({
  roles,
  initial,
}: {
  roles: RoleOption[];
  initial?: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    profilePhotoUrl: string | null;
    active: boolean;
    notes: string | null;
    defaultStartTime: string | null;
    defaultEndTime: string | null;
    roleIds: string[];
  };
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    initial?.roleIds ?? []
  );

  function toggleRole(id: string) {
    setSelectedRoles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function onSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await saveStaffMemberAction({
        id: initial?.id,
        fullName: String(formData.get("fullName") ?? ""),
        phone: String(formData.get("phone") ?? "") || undefined,
        email: String(formData.get("email") ?? "") || undefined,
        profilePhotoUrl:
          String(formData.get("profilePhotoUrl") ?? "") || undefined,
        notes: String(formData.get("notes") ?? "") || undefined,
        defaultStartTime:
          String(formData.get("defaultStartTime") ?? "") || undefined,
        defaultEndTime:
          String(formData.get("defaultEndTime") ?? "") || undefined,
        active: formData.get("active") === "on",
        roleIds: selectedRoles,
        primaryRoleId: selectedRoles[0],
      });
      setMessage(result.success ? result.message ?? "Tamam" : result.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-4 rounded-lg border p-4">
      <h2 className="font-medium">
        {initial ? "Personeli düzenle" : "Yeni personel"}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>Ad soyad</span>
          <Input
            name="fullName"
            required
            defaultValue={initial?.fullName ?? ""}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Telefon</span>
          <Input name="phone" defaultValue={initial?.phone ?? ""} />
        </label>
        <label className="space-y-1 text-sm">
          <span>E-posta</span>
          <Input
            name="email"
            type="email"
            defaultValue={initial?.email ?? ""}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Profil fotoğrafı URL</span>
          <Input
            name="profilePhotoUrl"
            defaultValue={initial?.profilePhotoUrl ?? ""}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Çalışma başlangıç</span>
          <Input
            name="defaultStartTime"
            type="time"
            defaultValue={initial?.defaultStartTime?.slice(0, 5) ?? ""}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Çalışma bitiş</span>
          <Input
            name="defaultEndTime"
            type="time"
            defaultValue={initial?.defaultEndTime?.slice(0, 5) ?? ""}
          />
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Görevler (roller)</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {roles.map((role) => (
            <label
              key={role.id}
              className="flex items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selectedRoles.includes(role.id)}
                onChange={() => toggleRole(role.id)}
              />
              {role.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="space-y-1 text-sm block">
        <span>Notlar</span>
        <textarea
          name="notes"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          rows={2}
          defaultValue={initial?.notes ?? ""}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={initial?.active ?? true}
        />
        Aktif
      </label>
      {message ? (
        <p className="text-muted-foreground text-sm" role="status">
          {message}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending || selectedRoles.length === 0}>
        {isPending ? "Kaydediliyor…" : "Kaydet"}
      </Button>
    </form>
  );
}
