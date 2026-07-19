import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import {
  listStrategies,
  listStrategyHistory,
} from "@/features/marketing/services/marketing-strategy.service";
import { StrategyForm } from "@/features/marketing/components/strategy-form";
import { INSUFFICIENT_DATA_MESSAGE } from "@/features/marketing/types";

export const metadata: Metadata = {
  title: "AI Stratejileri — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

export default async function MarketingStrategiesPage() {
  const supabase = createAdminClient();
  const [strategies, history] = await Promise.all([
    listStrategies(supabase),
    listStrategyHistory(supabase, 20),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">AI Stratejileri</h2>
        <p className="text-muted-foreground text-sm">
          Yalnızca öneri. Kampanya kapatılmaz, bütçe değiştirilmez. Her öneride
          güven seviyesi ve gerekçe zorunlu.
        </p>
      </div>

      <StrategyForm />

      <section className="space-y-3">
        <h3 className="font-medium">Kayıtlı stratejiler</h3>
        {strategies.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {INSUFFICIENT_DATA_MESSAGE}
          </p>
        ) : (
          strategies.map((s) => (
            <article key={s.id} className="rounded-xl border p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="font-medium">{s.title}</h4>
                <span className="text-muted-foreground text-xs">
                  Güven: %{s.overall_confidence ?? 0} · {s.data_sufficiency}
                </span>
              </div>
              <p className="text-muted-foreground mt-1">{s.summary}</p>
              <ul className="mt-3 space-y-2">
                {(s.marketing_strategy_items ?? []).map(
                  (item: {
                    id: string;
                    recommendation: string;
                    rationale: string;
                    confidence_level: number;
                    suggested_budget: number | null;
                    expected_goal: string;
                    data_range_label: string;
                    data_sufficiency: string;
                  }) => (
                    <li key={item.id} className="rounded-lg bg-muted/40 p-3">
                      <div className="font-medium">{item.recommendation}</div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        Amaç: {item.expected_goal}
                      </div>
                      <div className="mt-1 text-xs">
                        Gerekçe: {item.rationale}
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        Veri aralığı: {item.data_range_label} · Yeterlilik:{" "}
                        {item.data_sufficiency} · Güven: %
                        {item.confidence_level}
                        {item.suggested_budget != null
                          ? ` · Önerilen bütçe: ${item.suggested_budget}`
                          : ""}
                      </div>
                    </li>
                  )
                )}
              </ul>
            </article>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">AI Strategy History</h3>
        {history.length === 0 ? (
          <p className="text-muted-foreground text-sm">Henüz geçmiş yok.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="rounded-lg border px-3 py-2">
                <div className="font-medium">{h.title}</div>
                <div className="text-muted-foreground text-xs">
                  {new Date(h.created_at).toLocaleString("tr-TR")} ·{" "}
                  {h.event_type}
                  {h.confidence_level != null
                    ? ` · güven %${h.confidence_level}`
                    : ""}
                </div>
                {h.rationale ? (
                  <p className="mt-1 text-xs">Gerekçe: {h.rationale}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
