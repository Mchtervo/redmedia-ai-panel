import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import { listExperiments } from "@/features/marketing/services/experiment.service";
import { ExperimentForm } from "@/features/marketing/components/experiment-form";

export const metadata: Metadata = {
  title: "Deneyler — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

export default async function MarketingExperimentsPage() {
  const supabase = createAdminClient();
  const experiments = await listExperiments(supabase);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Deney Motoru</h2>
        <p className="text-muted-foreground text-sm">
          Aynı testte yalnızca bir ana değişken. Varsayılan başarı: kapora →
          rezervasyon → gelir → nitelikli müşteri → mesaj.
        </p>
      </div>

      <ExperimentForm />

      {experiments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Henüz deney yok.</p>
      ) : (
        <ul className="space-y-3">
          {experiments.map((e) => (
            <li key={e.id} className="rounded-xl border p-4 text-sm">
              <div className="font-medium">{e.title}</div>
              <div className="text-muted-foreground text-xs">
                {e.experiment_type} · değişken: {e.changed_variable} · metrik:{" "}
                {e.primary_success_metric} · {e.status}
              </div>
              <p className="mt-2">{e.hypothesis}</p>
              {e.rationale ? (
                <p className="mt-1 text-xs">Gerekçe: {e.rationale}</p>
              ) : null}
              <p className="text-muted-foreground mt-1 text-xs">
                Güven:{" "}
                {e.confidence_level != null ? `%${e.confidence_level}` : "—"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
