import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/server/supabase/admin";
import { buildAiBrainDashboard } from "@/features/ai-brain/services/ai-brain.service";
import { BrainCandidateCard } from "@/features/ai-brain/components/brain-candidate-card";

export const metadata: Metadata = {
  title: "AI Brain — Redmedia AI Panel",
};

export default async function AiBrainPage() {
  const supabase = createAdminClient();
  const dash = await buildAiBrainDashboard(supabase);
  const r = dash.report;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Redmedia AI Brain
        </h1>
        <p className="text-muted-foreground text-sm">
          Kontrollü öğrenme: öneriler admin onayı olmadan fiyata/kampanyaya/IBAN
          dokunamaz.{" "}
          <Link href="/dashboard/ai" className="underline-offset-4 hover:underline">
            Konuşma öğrenmesine git
          </Link>
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Toplam sonuç" value={String(r.totalOutcomes)} />
        <Stat label="Satış" value={String(r.sales)} />
        <Stat label="Dönüşüm %" value={String(r.conversionRate)} />
        <Stat label="Bekleyen öğrenme" value={String(r.pendingLearningCount)} />
        <Stat label="Kapora istendi" value={String(r.depositRequested)} />
        <Stat label="Kapora gönderildi" value={String(r.depositSent)} />
        <Stat label="Admin müdahale" value={String(r.adminTookOver)} />
        <Stat label="AI düzeltmesi" value={String(r.adminCorrected)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Yeni öğrenme önerileri</h2>
        {dash.pendingCandidates.length === 0 ? (
          <p className="text-muted-foreground text-sm">Bekleyen öneri yok.</p>
        ) : (
          dash.pendingCandidates.map((c) => (
            <BrainCandidateCard
              key={c.id}
              candidate={{
                id: c.id,
                title: c.title,
                category: c.category,
                proposed_rule: c.proposed_rule,
                evidence_summary: c.evidence_summary,
                confidence_score: Number(c.confidence_score),
                expected_impact: c.expected_impact,
                evidence_count: c.evidence_count,
                source_count: c.source_count,
              }}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Onaylı satış öğrenimleri</h2>
        <ul className="space-y-2 text-sm">
          {dash.salesLearnings.map((l) => (
            <li key={l.id} className="rounded border px-3 py-2">
              <div className="font-medium">{l.title}</div>
              <div className="text-muted-foreground">{l.content.slice(0, 240)}</div>
            </li>
          ))}
          {dash.salesLearnings.length === 0 ? (
            <li className="text-muted-foreground">Henüz yok</li>
          ) : null}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Admin düzeltmelerinden dersler</h2>
        <ul className="space-y-2 text-sm">
          {dash.recentCorrections.map((c) => (
            <li key={c.id} className="rounded border px-3 py-2">
              <div className="text-muted-foreground text-xs">
                {new Date(c.created_at).toLocaleString("tr-TR")}
              </div>
              <div>
                <span className="font-medium">AI:</span> {c.ai_text.slice(0, 160)}
              </div>
              <div>
                <span className="font-medium">Admin:</span>{" "}
                {c.staff_text.slice(0, 160)}
              </div>
            </li>
          ))}
          {dash.recentCorrections.length === 0 ? (
            <li className="text-muted-foreground">Henüz düzeltme yok</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
