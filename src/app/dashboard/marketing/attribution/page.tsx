import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/server/supabase/admin";
import { buildAttributionDashboard } from "@/features/marketing/services/attribution-dashboard.service";
import {
  listAttributions,
} from "@/features/marketing/services/attribution.service";
import {
  listMarketingDailyReports,
} from "@/features/marketing/services/marketing-daily-report.service";
import {
  ATTRIBUTION_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  type AttributionStatus,
  type SourceType,
} from "@/features/marketing/types";
import { MarketingDateFilter } from "@/features/marketing/components/marketing-date-filter";
import { GenerateMarketingReportButton } from "@/features/marketing/components/attribution-actions";
import { formatTry } from "@/features/ceo-intelligence/utils/time";
import { buildMarketingIntelligenceBriefs } from "@/features/intelligence/services/marketing-briefs.service";
import { IntelligenceBriefList } from "@/features/intelligence/components/intelligence-brief-card";

export const metadata: Metadata = {
  title: "AI Attribution — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    range?: string;
    start?: string;
    end?: string;
  }>;
};

function pctRoi(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export default async function MarketingAttributionPage({ searchParams }: Props) {
  const sp = await searchParams;
  const preset =
    sp.range === "today" ||
    sp.range === "last_7" ||
    sp.range === "last_30" ||
    sp.range === "last_90" ||
    sp.range === "custom"
      ? sp.range
      : "last_30";

  const supabase = createAdminClient();
  const [dash, rows, reports] = await Promise.all([
    buildAttributionDashboard(supabase, preset, sp.start, sp.end),
    listAttributions(supabase, 40),
    listMarketingDailyReports(supabase, 7),
  ]);

  // ID yerine müşteri adını göstermek için isimleri tek sorguda çek.
  const contactIds = [...new Set(rows.map((r) => r.contact_id))];
  const contactNames = new Map<string, string>();
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, full_name, username")
      .in("id", contactIds);
    for (const c of contacts ?? []) {
      const name = c.full_name?.trim() || c.username?.trim();
      if (name) contactNames.set(c.id, name);
    }
  }

  const s = dash.summary;
  const briefs = buildMarketingIntelligenceBriefs(dash);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium">AI Attribution Engine</h2>
          <p className="text-muted-foreground text-sm">
            Lead → Rezervasyon → Kapora → Çekim → Teslim → Gelir. Gelir ve ROI
            yalnızca kesin (exact/manual) eşleşmelerden. Olası kaynak ayrı
            gösterilir.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GenerateMarketingReportButton />
          <Link
            href="/dashboard/marketing/reports"
            className="border-input inline-flex h-8 items-center rounded-lg border px-2.5 text-sm"
          >
            Raporlar
          </Link>
        </div>
      </div>

      <MarketingDateFilter current={preset} />

      <section className="space-y-2">
        <h3 className="font-medium">AI Intelligence</h3>
        <IntelligenceBriefList briefs={briefs} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <MetricCard label="Harcama" value={formatTry(s.totalSpend)} />
        <MetricCard label="DM" value={String(s.dm)} />
        <MetricCard label="Lead" value={String(s.lead)} />
        <MetricCard label="Rezervasyon" value={String(s.reservation)} />
        <MetricCard label="Kapora" value={String(s.kapora)} />
        <MetricCard label="Çekim" value={String(s.shoot)} />
        <MetricCard label="Gelir (kesin)" value={formatTry(s.revenueExact)} />
        <MetricCard label="ROI" value={pctRoi(s.roi)} />
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        {(["exact", "probable", "manual", "unknown"] as AttributionStatus[]).map(
          (st) => (
            <div key={st} className="rounded-xl border p-3 text-sm">
              <div className="text-muted-foreground text-xs">
                {ATTRIBUTION_STATUS_LABELS[st]}
              </div>
              <div className="text-xl font-semibold tabular-nums">
                {s.byStatus[st] ?? 0}
              </div>
            </div>
          )
        )}
      </section>

      {s.revenueProbableExcluded > 0 ? (
        <p className="text-muted-foreground text-xs">
          Olası kaynak geliri ROI’ye dahil edilmedi:{" "}
          {formatTry(s.revenueProbableExcluded)}
        </p>
      ) : null}

      <section className="space-y-2">
        <h3 className="font-medium">Kampanya Attribution</h3>
        {dash.emptyMessage ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm">
            {dash.emptyMessage}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">Kampanya</th>
                  <th className="px-3 py-2 font-medium">Harcama</th>
                  <th className="px-3 py-2 font-medium">DM</th>
                  <th className="px-3 py-2 font-medium">Lead</th>
                  <th className="px-3 py-2 font-medium">Rezervasyon</th>
                  <th className="px-3 py-2 font-medium">Kapora</th>
                  <th className="px-3 py-2 font-medium">Çekim</th>
                  <th className="px-3 py-2 font-medium">Gelir</th>
                  <th className="px-3 py-2 font-medium">ROI</th>
                  <th className="px-3 py-2 font-medium">Olası</th>
                </tr>
              </thead>
              <tbody>
                {dash.campaigns.map((c) => (
                  <tr key={c.campaignId} className="border-t">
                    <td className="px-3 py-2 font-medium">{c.campaignName}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatTry(c.spend)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{c.dm}</td>
                    <td className="px-3 py-2 tabular-nums">{c.lead}</td>
                    <td className="px-3 py-2 tabular-nums">{c.reservation}</td>
                    <td className="px-3 py-2 tabular-nums">{c.kapora}</td>
                    <td className="px-3 py-2 tabular-nums">{c.shoot}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatTry(c.revenue)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{pctRoi(c.roi)}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {c.probableAttributed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Müşteri kaynakları</h3>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Kayıt yok. Müşteri detayından manuel kaynak veya funnel yenileme
            kullanın.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <Link
                    href={`/dashboard/marketing/attribution/${r.contact_id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {contactNames.get(r.contact_id) ??
                      `Müşteri ${r.contact_id.slice(0, 8)}…`}
                  </Link>
                  <div className="text-muted-foreground text-xs">
                    {SOURCE_TYPE_LABELS[r.source_type as SourceType] ??
                      r.source_type}{" "}
                    ·{" "}
                    {ATTRIBUTION_STATUS_LABELS[
                      r.attribution_status as AttributionStatus
                    ] ?? r.attribution_status}
                    {r.attribution_status === "probable"
                      ? ` · güven %${r.attribution_confidence ?? 0}`
                      : r.attribution_confidence != null
                        ? ` · güven %${r.attribution_confidence}`
                        : ""}
                  </div>
                </div>
                <Link
                  href={`/dashboard/customers/${r.contact_id}`}
                  className="text-muted-foreground text-xs underline-offset-4 hover:underline"
                >
                  Müşteri
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Son günlük raporlar</h3>
        {reports.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Henüz rapor yok. “Günlük rapor üret” veya cron kullanın.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {reports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/dashboard/marketing/reports?date=${r.report_date}`}
                  className="underline-offset-4 hover:underline"
                >
                  {r.report_date}
                </Link>
                <span className="text-muted-foreground text-xs">
                  {" "}
                  · {r.data_sufficiency}
                  {r.overall_confidence != null
                    ? ` · güven %${r.overall_confidence}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
