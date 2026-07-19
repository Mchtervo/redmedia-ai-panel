import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import { listLearnings } from "@/features/marketing/services/marketing-learning.service";
import { LearningForm } from "@/features/marketing/components/learning-form";

export const metadata: Metadata = {
  title: "Marketing Memory — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

export default async function MarketingMemoryPage() {
  const supabase = createAdminClient();
  const learnings = await listLearnings(supabase);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Marketing Memory</h2>
        <p className="text-muted-foreground text-sm">
          Tek reklam sonucundan kalıcı validated öğrenim oluşturulmaz. Yeterli
          kanıt (deney desteği) olmadan validated yapılmaz.
        </p>
      </div>

      <LearningForm />

      {learnings.length === 0 ? (
        <p className="text-muted-foreground text-sm">Henüz öğrenim kaydı yok.</p>
      ) : (
        <ul className="space-y-3">
          {learnings.map((l) => (
            <li key={l.id} className="rounded-xl border p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">{l.title}</h3>
                <span className="text-xs">{l.status}</span>
              </div>
              <p className="text-muted-foreground mt-1">{l.description}</p>
              <p className="mt-2 text-xs">Gerekçe: {l.rationale}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Güven: %{l.confidence_level} · Destekleyen deney:{" "}
                {l.supporting_experiment_count}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
