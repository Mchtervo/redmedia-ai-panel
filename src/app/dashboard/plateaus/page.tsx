import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import { listPlateaus } from "@/features/plateaus/repositories/plateaus.repository";
import { PlateauForm } from "@/features/plateaus/components/plateau-form";

export const metadata: Metadata = { title: "Platolar — Redmedia AI Panel" };

export default async function PlateausPage() {
  const supabase = createAdminClient();
  const plateaus = await listPlateaus(supabase);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Platolar</h1>
        <p className="text-muted-foreground text-sm">
          AI yalnızca aktif plato kayıtlarını sunar.
        </p>
      </div>
      <PlateauForm />
      <ul className="space-y-2">
        {plateaus.map((p) => (
          <li key={p.id} className="border-border rounded-lg border p-3 text-sm">
            <div className="font-medium">
              {p.name} {p.active ? "" : "(pasif)"}
            </div>
            <div className="text-muted-foreground">
              {p.district ?? "—"} / {p.city} · {p.address ?? "adres yok"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
