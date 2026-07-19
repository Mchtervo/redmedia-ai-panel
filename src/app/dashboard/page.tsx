import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/server/supabase/admin";
import { collectCeoMetrics } from "@/features/ceo-intelligence/services/metrics.service";
import { buildOverview } from "@/features/overview/services/overview.service";
import { OverviewDashboard } from "@/features/overview/components/overview-dashboard";
import { countPendingApprovals } from "@/features/approvals/repositories/approvals.repository";
import { countUnreadNotifications } from "@/features/notifications/services/notifications.service";
import { PageHeader } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Dashboard — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createAdminClient();
  const [overview, metrics, pendingApprovals, unreadNotifications] =
    await Promise.all([
      buildOverview(supabase),
      collectCeoMetrics(supabase),
      countPendingApprovals(supabase).catch(() => 0),
      countUnreadNotifications(supabase).catch(() => 0),
    ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Genel Bakış"
        title="Dashboard"
        description="Satış, rezervasyon, pazarlama ve AI operasyonunun canlı özeti."
        actions={
          <Link
            href="/dashboard/ceo"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            CEO Intelligence
          </Link>
        }
      />
      <OverviewDashboard
        overview={overview}
        metrics={metrics}
        pendingApprovals={pendingApprovals}
        unreadNotifications={unreadNotifications}
      />
    </div>
  );
}
