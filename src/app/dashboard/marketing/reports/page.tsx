import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/server/supabase/admin";
import {
  getMarketingDailyReport,
  listMarketingDailyReports,
} from "@/features/marketing/services/marketing-daily-report.service";
import { GenerateMarketingReportButton } from "@/features/marketing/components/attribution-actions";
import { IntelligenceBriefList } from "@/features/intelligence/components/intelligence-brief-card";
import type { IntelligenceBrief } from "@/features/intelligence/types";

function isCompleteBrief(b: unknown): b is IntelligenceBrief {
  if (!b || typeof b !== "object") return false;
  const x = b as Record<string, unknown>;
  return (
    typeof x.title === "string" &&
    typeof x.summary === "string" &&
    typeof x.why === "string" &&
    typeof x.whatNext === "string" &&
    typeof x.doNow === "string" &&
    typeof x.confidence === "number" &&
    Array.isArray(x.evidence) &&
    typeof x.priority === "string"
  );
}

export const metadata: Metadata = {
  title: "AI Marketing Reports — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

export default async function MarketingReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = createAdminClient();
  const list = await listMarketingDailyReports(supabase, 30);
  const selectedDate = sp.date ?? list[0]?.report_date ?? null;
  const report = selectedDate
    ? await getMarketingDailyReport(supabase, selectedDate)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium">Günlük AI Marketing Report</h2>
          <p className="text-muted-foreground text-sm">
            Öneri üretir; kampanya kapatmaz / bütçe değiştirmez. Cron:{" "}
            <code className="text-[11px]">GET /api/cron/marketing-daily-report</code>
          </p>
        </div>
        <GenerateMarketingReportButton />
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-1">
          {list.length === 0 ? (
            <p className="text-muted-foreground text-sm">Rapor yok.</p>
          ) : (
            list.map((r) => (
              <Link
                key={r.id}
                href={`/dashboard/marketing/reports?date=${r.report_date}`}
                className={`block rounded-md px-2 py-1.5 text-sm ${
                  r.report_date === selectedDate
                    ? "bg-muted font-medium"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {r.report_date}
              </Link>
            ))
          )}
        </aside>

        <article className="space-y-4 rounded-xl border p-4">
          {!report ? (
            <p className="text-muted-foreground text-sm">
              Rapor seçin veya üretin.
            </p>
          ) : (
            <>
              {(() => {
                const raw = (
                  report.metrics as { intelligenceBriefs?: unknown[] }
                )?.intelligenceBriefs;
                const briefs = Array.isArray(raw)
                  ? raw.filter(isCompleteBrief)
                  : [];
                if (briefs.length === 0) return null;
                return (
                  <section className="space-y-2">
                    <h3 className="font-medium">AI Intelligence</h3>
                    <IntelligenceBriefList briefs={briefs} />
                  </section>
                );
              })()}
              <pre className="font-sans text-sm whitespace-pre-wrap">
                {report.summary_md}
              </pre>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
