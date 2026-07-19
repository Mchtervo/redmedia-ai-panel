import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import {
  buildCeoDashboard,
  listCeoDailyReports,
} from "@/features/ceo-intelligence/services/dashboard.service";
import { CeoIntelligenceDashboard } from "@/features/ceo-intelligence/components/ceo-intelligence-dashboard";
import { CeoRegenerateReportButton } from "@/features/ceo-intelligence/components/ceo-regenerate-report-button";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "CEO Intelligence — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

export default async function CeoPage() {
  const supabase = createAdminClient();
  const [data, reports] = await Promise.all([
    buildCeoDashboard(supabase),
    listCeoDailyReports(supabase, 14),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Genel Bakış"
        title="CEO Intelligence"
        description="Yönetici komuta merkezi: özet, riskler, fırsatlar ve önerilen aksiyonlar. Salt okuma — fiyat, kampanya, personel veya rezervasyon değiştirmez."
        actions={<CeoRegenerateReportButton />}
      />

      <CeoIntelligenceDashboard data={data} />

      <SectionCard
        title="Rapor arşivi"
        description="Son 14 günlük otomatik yönetim raporu"
        contentClassName="p-0"
      >
        {reports.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={FileText}
              compact
              title="Henüz rapor yok"
              description="Cron çalıştığında veya yukarıdaki butonla üretildiğinde raporlar burada listelenecek."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {reports.map((report) => (
              <li key={report.id} className="px-4 py-3">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{report.report_date}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(report.generated_at).toLocaleString("tr-TR")}
                    </span>
                  </summary>
                  <pre className="bg-muted/40 scrollbar-thin mt-2 max-h-72 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                    {report.content_markdown}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
