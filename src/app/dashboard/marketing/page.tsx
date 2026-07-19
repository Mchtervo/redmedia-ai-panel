import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { createAdminClient } from "@/server/supabase/admin";
import {
  buildMarketingOverview,
  listDualPerformance,
  listMarketingDailySeries,
} from "@/features/marketing/services/marketing-metrics.service";
import { buildAttributionDashboard } from "@/features/marketing/services/attribution-dashboard.service";
import { MarketingOverviewCards } from "@/features/marketing/components/marketing-overview-cards";
import { MarketingDateFilter } from "@/features/marketing/components/marketing-date-filter";
import type { DatePreset, DualPerformanceRow } from "@/features/marketing/types";
import { DATE_PRESETS } from "@/features/marketing/types";
import { buildMarketingIntelligenceBriefs } from "@/features/intelligence/services/marketing-briefs.service";
import { IntelligenceBriefList } from "@/features/intelligence/components/intelligence-brief-card";
import { buildDailyBudgetPlan } from "@/features/marketing/services/budget-planner.service";
import { SectionCard } from "@/components/dashboard/section-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { formatTry } from "@/features/ceo-intelligence/utils/time";

export const metadata: Metadata = {
  title: "Marketing Genel Bakış — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ range?: string }> };

function PerformerList({
  rows,
  direction,
}: {
  rows: DualPerformanceRow[];
  direction: "top" | "poor";
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={direction === "top" ? TrendingUp : TrendingDown}
        compact
        title="Yeterli veri yok"
        description="Seçili aralıkta reklam metriği bulunamadı."
      />
    );
  }
  return (
    <ul className="divide-y divide-border/40">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 py-2.5 text-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{row.name}</p>
            <p className="text-muted-foreground text-xs tabular-nums">
              {formatTry(row.meta.spend)} harcama · {row.meta.messages} mesaj ·{" "}
              {row.business.crmCustomers} müşteri
            </p>
          </div>
          {row.business.roas !== null ? (
            <StatusBadge
              tone={row.business.roas >= 1 ? "success" : "danger"}
              withDot={false}
            >
              ROAS {row.business.roas.toFixed(2)}
            </StatusBadge>
          ) : row.meta.ctr !== null ? (
            <StatusBadge tone="neutral" withDot={false}>
              CTR %{(row.meta.ctr * 100).toFixed(2)}
            </StatusBadge>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function MarketingOverviewPage({ searchParams }: Props) {
  const sp = await searchParams;
  const rangeRaw = sp.range ?? "last_30";
  const preset = (DATE_PRESETS.includes(rangeRaw as DatePreset)
    ? rangeRaw
    : "last_30") as DatePreset;

  const supabase = createAdminClient();
  const [metrics, dash, budgetPlan] = await Promise.all([
    buildMarketingOverview(supabase, preset),
    buildAttributionDashboard(supabase, preset),
    buildDailyBudgetPlan(supabase),
  ]);
  const [dailySeries, performanceRows] = metrics.hasData
    ? await Promise.all([
        listMarketingDailySeries(supabase, metrics.range),
        listDualPerformance(supabase, metrics.range),
      ])
    : [[], []];
  const briefs = buildMarketingIntelligenceBriefs(dash);

  const scoredRows = performanceRows.filter((r) => r.meta.spend > 0);
  const topPerformers = scoredRows.slice(0, 5);
  const poorPerformers =
    scoredRows.length > 5 ? scoredRows.slice(-5).reverse() : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">
          Aralık: {metrics.range.start} — {metrics.range.end}
        </p>
        <Suspense fallback={null}>
          <MarketingDateFilter current={preset} />
        </Suspense>
      </div>

      <MarketingOverviewCards metrics={metrics} />

      <SectionCard
        title="Günlük bütçe planı (AI önerisi)"
        description="Meta’da otomatik uygulanmaz. Bütçeyi Ayarlar’dan girin."
        action={
          <Link
            href="/dashboard/settings"
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Bütçeyi ayarla
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Günlük bütçe"
            value={
              budgetPlan.dailyBudgetTry
                ? formatTry(budgetPlan.dailyBudgetTry)
                : "—"
            }
          />
          <KpiCard
            label="Önerilen kreatif"
            value={String(budgetPlan.recommendedCreatives)}
          />
          <KpiCard
            label="Önerilen strateji testi"
            value={String(budgetPlan.recommendedStrategies)}
          />
          <KpiCard
            label="Soğuk / Ilık / Sıcak"
            value={`${budgetPlan.coldPct}/${budgetPlan.warmPct}/${budgetPlan.hotPct}`}
            hint={
              budgetPlan.dailyBudgetTry
                ? `${formatTry(budgetPlan.coldBudget)} · ${formatTry(budgetPlan.warmBudget)} · ${formatTry(budgetPlan.hotBudget)}`
                : undefined
            }
          />
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          {budgetPlan.rationale}
        </p>
      </SectionCard>

      {metrics.hasData ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Günlük harcama"
            description="ad_daily_metrics toplamı"
          >
            {dailySeries.length > 0 ? (
              <TrendChart
                data={dailySeries}
                xKey="date"
                series={[{ key: "spend", name: "Harcama" }]}
                kind="area"
                height={220}
                valueFormat="currency"
                xFormat="shortDate"
              />
            ) : (
              <EmptyState
                icon={BarChart3}
                compact
                title="Günlük metrik yok"
                description="Seçili aralık için senkronize edilmiş reklam metriği bulunamadı."
              />
            )}
          </SectionCard>

          <SectionCard
            title="Mesaj ve lead trendi"
            description="Reklamlardan başlayan konuşmalar ve lead'ler"
          >
            {dailySeries.length > 0 ? (
              <TrendChart
                data={dailySeries}
                xKey="date"
                series={[
                  { key: "messages", name: "Mesaj" },
                  { key: "leads", name: "Lead" },
                ]}
                kind="line"
                height={220}
                xFormat="shortDate"
              />
            ) : (
              <EmptyState
                icon={BarChart3}
                compact
                title="Günlük metrik yok"
                description="Seçili aralık için senkronize edilmiş reklam metriği bulunamadı."
              />
            )}
          </SectionCard>
        </div>
      ) : null}

      {metrics.hasData ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="En iyi performans"
            description="İş sonucuna göre sıralı (kapora > rezervasyon > gelir)"
            action={
              <Link
                href="/dashboard/marketing/performance"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
              >
                Tümü <ArrowRight aria-hidden className="size-3" />
              </Link>
            }
          >
            <PerformerList rows={topPerformers} direction="top" />
          </SectionCard>
          <SectionCard
            title="Zayıf performans"
            description="Bütçe önerisi insan onayı olmadan uygulanmaz"
          >
            <PerformerList rows={poorPerformers} direction="poor" />
          </SectionCard>
        </div>
      ) : null}

      <SectionCard
        title="AI Intelligence"
        description="Neden oldu? · Sonra ne olacak? · Şimdi ne yapmalıyım?"
      >
        <IntelligenceBriefList briefs={briefs} />
      </SectionCard>
    </div>
  );
}
