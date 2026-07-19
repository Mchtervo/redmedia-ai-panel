import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { listFollowUpTasks } from "@/features/follow-ups/services/follow-ups.service";
import { FollowUpQueue } from "@/features/follow-ups/components/follow-up-queue";

export const metadata: Metadata = { title: "Follow-up — Redmedia AI Panel" };
export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const supabase = createAdminClient();
  const tasks = await listFollowUpTasks(supabase);

  const queued = tasks.filter((t) => t.status === "queued").length;
  const pending = tasks.filter((t) => t.status === "pending").length;
  const sent = tasks.filter((t) => t.status === "sent").length;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="Follow-up görevleri"
        description="Unutmayan takip kuyruğu. Meta IGSID eşleşenlerde Instagram DM otomatik/tek tık; diğerlerinde personel köprüsü."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Kuyrukta" value={String(queued)} />
        <KpiCard label="Planlandı" value={String(pending)} />
        <KpiCard label="Gönderildi" value={String(sent)} />
      </div>

      <FollowUpQueue tasks={tasks} />
    </div>
  );
}
