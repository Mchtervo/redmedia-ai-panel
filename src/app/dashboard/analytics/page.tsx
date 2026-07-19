import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SectionCard } from "@/components/dashboard/section-card";

export const metadata: Metadata = {
  title: "Analytics — Redmedia AI Panel",
};
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const supabase = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const [
    contacts,
    conversations,
    reservations,
    openConversations,
    hotLeads,
    pendingFollowUps,
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceIso),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceIso),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceIso),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("lead_profiles")
      .select("id", { count: "exact", head: true })
      .eq("lead_temperature", "hot"),
    supabase
      .from("follow_up_tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "queued"]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Son 30 günün gerçek operasyon özeti. Sahte metrik yok."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Yeni müşteri (30g)"
          value={String(contacts.count ?? 0)}
        />
        <KpiCard
          label="Yeni konuşma (30g)"
          value={String(conversations.count ?? 0)}
        />
        <KpiCard
          label="Yeni rezervasyon (30g)"
          value={String(reservations.count ?? 0)}
        />
        <KpiCard
          label="Açık konuşma"
          value={String(openConversations.count ?? 0)}
        />
        <KpiCard label="Sıcak lead" value={String(hotLeads.count ?? 0)} />
        <KpiCard
          label="Bekleyen follow-up"
          value={String(pendingFollowUps.count ?? 0)}
        />
      </div>

      <SectionCard
        title="Not"
        description="Detaylı funnel, kohort ve tahmin sonraki sprintte eklenecek. Bu ekran gerçek sayaçlarla çalışır."
      >
        <p className="text-muted-foreground text-sm">
          Daha derin analiz için CEO Intelligence ve Marketing Attribution
          sayfalarını kullanın.
        </p>
      </SectionCard>
    </div>
  );
}
