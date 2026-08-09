import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createAdminClient } from "@/server/supabase/admin";
import {
  buildMarketingOverview,
  resolveMarketingDateRange,
} from "@/features/marketing/services/marketing-metrics.service";
import { buildAdsHierarchy } from "@/features/marketing/services/ads-hierarchy.service";
import { AdsHierarchyTree } from "@/features/marketing/components/ads-hierarchy-tree";
import { MarketingDateFilter } from "@/features/marketing/components/marketing-date-filter";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { formatTry } from "@/features/ceo-intelligence/utils/time";
import type { DatePreset } from "@/features/marketing/types";
import { DATE_PRESETS } from "@/features/marketing/types";
import { GenerateStrategyButton } from "@/features/marketing/components/generate-strategy-button";

export const metadata: Metadata = {
  title: "Reklam Performansı — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ range?: string }> };

function isPreset(v: string | undefined): v is DatePreset {
  return Boolean(v && (DATE_PRESETS as readonly string[]).includes(v));
}

export default async function MarketingPerformancePage({ searchParams }: Props) {
  const sp = await searchParams;
  const preset = isPreset(sp.range) ? sp.range : "last_30";
  const supabase = createAdminClient();
  const range = resolveMarketingDateRange(preset);
  const [overview, hierarchy, latestStrategy] = await Promise.all([
    buildMarketingOverview(supabase, preset),
    buildAdsHierarchy(supabase, range),
    supabase
      .from("marketing_strategies")
      .select("id, summary, overall_confidence, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const latest = latestStrategy.data;
  let items: Array<{
    recommendation: string | null;
    rationale: string | null;
    item_type: string;
  }> = [];
  if (latest?.id) {
    const { data: strategyItems } = await supabase
      .from("marketing_strategy_items")
      .select("recommendation, rationale, item_type")
      .eq("strategy_id", latest.id)
      .order("sort_order")
      .limit(6);
    items = strategyItems ?? [];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium">Ads Manager</h2>
          <p className="text-muted-foreground text-sm">
            Campaign → Ad Set → Ad. Skor: İyi / Orta / Kötü (mesaj maliyeti +
            CTR). AI önerileri sağda; Meta yazma Autopilot ile yapılır.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Suspense fallback={null}>
            <MarketingDateFilter current={preset} />
          </Suspense>
          <GenerateStrategyButton />
          <Link
            href="/dashboard/marketing/connections"
            className="text-primary text-sm underline-offset-4 hover:underline"
          >
            Meta bağlantı / sync
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Harcama" value={formatTry(hierarchy.totals.spend)} />
        <KpiCard
          label="Mesaj"
          value={String(hierarchy.totals.messages)}
          hint={
            hierarchy.totals.costPerMessage == null
              ? undefined
              : `Ort. ${formatTry(hierarchy.totals.costPerMessage)} / mesaj`
          }
        />
        <KpiCard
          label="CTR"
          value={
            hierarchy.totals.ctr == null
              ? "—"
              : `%${hierarchy.totals.ctr.toFixed(2)}`
          }
          hint={`${hierarchy.totals.clicks.toLocaleString("tr-TR")} tıklama`}
        />
        <KpiCard
          label="Skor dağılımı"
          value={`${hierarchy.scored.good} iyi`}
          hint={`${hierarchy.scored.ok} orta · ${hierarchy.scored.bad} kötü`}
        />
      </div>

      {!overview.connected && hierarchy.campaigns.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Meta hesabı bağlı değil veya sync edilmedi.{" "}
          <Link href="/dashboard/marketing/connections" className="underline">
            Bağlantılar
          </Link>
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="min-w-0 space-y-2">
          <h3 className="text-sm font-medium">Hiyerarşi</h3>
          <AdsHierarchyTree bundle={hierarchy} />
        </section>

        <aside className="space-y-3">
          <SectionCard
            title="AI önerileri"
            description="Strateji taslağı — Autopilot kapalıyken sadece öneri."
          >
            {items.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Henüz strateji yok. “Strateji üret” ile oluşturun.
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {items.map((item, i) => (
                  <li key={i} className="border-border/60 border-b pb-2 last:border-0">
                    <p className="font-medium">
                      {item.recommendation ?? item.item_type}
                    </p>
                    {item.rationale ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {item.rationale}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {latest?.summary ? (
              <p className="text-muted-foreground mt-3 text-xs">
                Özet: {latest.summary}
              </p>
            ) : null}
          </SectionCard>
          <Link
            href="/dashboard/marketing/strategies"
            className="text-primary text-sm underline-offset-4 hover:underline"
          >
            Tüm stratejiler →
          </Link>
          <Link
            href="/dashboard/marketing/autopilot"
            className="text-primary block text-sm underline-offset-4 hover:underline"
          >
            Autopilot kontrol →
          </Link>
        </aside>
      </div>
    </div>
  );
}
