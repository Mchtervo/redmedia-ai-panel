import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarCheck,
  CheckCheck,
  LineChart,
  Target,
  Users,
  Workflow,
} from "lucide-react";
import type { CeoMetricsSnapshot } from "@/features/ceo-intelligence/types";
import type { OverviewData } from "@/features/overview/services/overview.service";
import { formatTry } from "@/features/ceo-intelligence/utils/time";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Sparkline } from "@/components/charts/sparkline";
import { TrendChart } from "@/components/charts/trend-chart";
import { FunnelChart } from "@/components/charts/funnel-chart";

type Props = {
  overview: OverviewData;
  metrics: CeoMetricsSnapshot;
  pendingApprovals: number;
  unreadNotifications: number;
};

const ACTOR_LABELS: Record<string, string> = {
  system: "Sistem",
  ai: "AI",
  staff: "Personel",
  customer: "Müşteri",
};

function formatRelativeTr(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.round(hours / 24);
  return `${days} gün önce`;
}

export function OverviewDashboard({
  overview,
  metrics,
  pendingApprovals,
  unreadNotifications,
}: Props) {
  const revenueSpark = overview.revenueTrend.map((p) => p.revenue);
  const leadsSpark = overview.newLeadsTrend.map((p) => p.value);
  const reservationSpark = overview.reservationTrend.map((p) => p.value);
  const revenueTotal30 = revenueSpark.reduce((a, b) => a + b, 0);
  const leadsTotal30 = leadsSpark.reduce((a, b) => a + b, 0);
  const hasRevenueData = revenueSpark.some((v) => v > 0);
  const hasLeadData = leadsSpark.some((v) => v > 0);
  const automationSuccessRate =
    overview.automationHealth.runsLast7Days > 0
      ? Math.round(
          (overview.automationHealth.completed /
            overview.automationHealth.runsLast7Days) *
            100
        )
      : null;

  return (
    <div className="space-y-5">
      {/* KPI satırı */}
      <div className="animate-rise grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Tahmini ciro (30 gün)"
          value={formatTry(revenueTotal30)}
          hint={`Bugün: ${formatTry(metrics.estimatedRevenueToday)}`}
          visual={
            hasRevenueData ? (
              <Sparkline values={revenueSpark} tone="brand" label="Ciro trendi" />
            ) : undefined
          }
        />
        <KpiCard
          label="Yeni lead (30 gün)"
          value={leadsTotal30.toLocaleString("tr-TR")}
          hint={`Bugün: ${metrics.newCustomersToday}`}
          visual={
            hasLeadData ? (
              <Sparkline values={leadsSpark} tone="brand" label="Lead trendi" />
            ) : undefined
          }
        />
        <KpiCard
          label="Aktif konuşma"
          value={String(metrics.activeConversations)}
          hint={`${metrics.awaitingDeposit} kapora bekliyor`}
        />
        <KpiCard
          label="Bekleyen tahsilat"
          value={formatTry(metrics.pendingCollections)}
          hint={`${metrics.pendingCollectionsCount} kayıt`}
        />
      </div>

      {/* Grafik satırı */}
      <div className="animate-rise-late grid gap-4 lg:grid-cols-5">
        <SectionCard
          title="Ciro trendi"
          description={`${overview.rangeStart} — ${overview.rangeEnd} · rezervasyon toplam tutarı`}
          className="lg:col-span-3"
          action={
            <Link
              href="/dashboard/reservations"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
            >
              Rezervasyonlar <ArrowRight aria-hidden className="size-3" />
            </Link>
          }
        >
          {hasRevenueData ? (
            <TrendChart
              data={overview.revenueTrend}
              xKey="date"
              series={[{ key: "revenue", name: "Ciro" }]}
              kind="area"
              height={240}
              valueFormat="currency"
              xFormat="shortDate"
            />
          ) : (
            <EmptyState
              icon={LineChart}
              compact
              title="Henüz ciro verisi yok"
              description="Son 30 günde tutarı olan rezervasyon oluşmadığı için grafik boş."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Dönüşüm hunisi"
          description="Son 30 gün · yeni profil → tamamlanan iş"
          className="lg:col-span-2"
        >
          {overview.funnel.newProfiles > 0 ||
          overview.funnel.reservationsCreated > 0 ? (
            <FunnelChart
              steps={[
                { label: "Yeni müşteri profili", value: overview.funnel.newProfiles },
                {
                  label: "Rezervasyon oluşturuldu",
                  value: overview.funnel.reservationsCreated,
                },
                {
                  label: "Kapora onaylandı",
                  value: overview.funnel.depositsVerified,
                },
                { label: "Çekim tamamlandı", value: overview.funnel.completed },
              ]}
            />
          ) : (
            <EmptyState
              icon={Target}
              compact
              title="Huni için veri yok"
              description="Son 30 günde yeni müşteri profili veya rezervasyon kaydı bulunamadı."
            />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Yeni lead'ler"
          description="Günlük yeni müşteri profili sayısı"
        >
          {hasLeadData ? (
            <TrendChart
              data={overview.newLeadsTrend}
              xKey="date"
              series={[{ key: "value", name: "Yeni lead" }]}
              kind="bar"
              height={200}
              xFormat="shortDate"
            />
          ) : (
            <EmptyState
              icon={Users}
              compact
              title="Lead verisi yok"
              description="Son 30 günde yeni müşteri profili oluşmadı."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Rezervasyon trendi"
          description="Günlük oluşturulan rezervasyon sayısı"
        >
          {reservationSpark.some((v) => v > 0) ? (
            <TrendChart
              data={overview.reservationTrend}
              xKey="date"
              series={[{ key: "value", name: "Rezervasyon" }]}
              kind="line"
              height={200}
              xFormat="shortDate"
            />
          ) : (
            <EmptyState
              icon={CalendarCheck}
              compact
              title="Rezervasyon verisi yok"
              description="Son 30 günde rezervasyon oluşturulmadı."
            />
          )}
        </SectionCard>
      </div>

      {/* Operasyon durumu satırı */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard
          title="Onay kuyruğu"
          contentClassName="flex flex-col gap-2"
          action={
            <Link
              href="/dashboard/approvals"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
            >
              Aç <ArrowRight aria-hidden className="size-3" />
            </Link>
          }
        >
          <div className="flex items-center gap-3">
            <div className="bg-warning/12 flex size-9 items-center justify-center rounded-lg">
              <CheckCheck aria-hidden className="text-warning size-4.5" />
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums">
                {pendingApprovals}
              </p>
              <p className="text-muted-foreground text-xs">bekleyen talep</p>
            </div>
          </div>
          {pendingApprovals > 0 ? (
            <StatusBadge tone="warning">Karar bekleniyor</StatusBadge>
          ) : (
            <StatusBadge tone="success">Kuyruk temiz</StatusBadge>
          )}
        </SectionCard>

        <SectionCard
          title="Otomasyon sağlığı"
          contentClassName="flex flex-col gap-2"
          action={
            <Link
              href="/dashboard/automations"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
            >
              Aç <ArrowRight aria-hidden className="size-3" />
            </Link>
          }
        >
          <div className="flex items-center gap-3">
            <div className="bg-info/12 flex size-9 items-center justify-center rounded-lg">
              <Workflow aria-hidden className="text-info size-4.5" />
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums">
                {overview.automationHealth.enabledRules}
                <span className="text-muted-foreground text-sm font-normal">
                  /{overview.automationHealth.totalRules} kural etkin
                </span>
              </p>
              <p className="text-muted-foreground text-xs">
                7 günde {overview.automationHealth.runsLast7Days} çalıştırma
              </p>
            </div>
          </div>
          {overview.automationHealth.failed > 0 ? (
            <StatusBadge tone="danger">
              {overview.automationHealth.failed} hata
            </StatusBadge>
          ) : automationSuccessRate !== null ? (
            <StatusBadge tone="success">
              %{automationSuccessRate} başarı
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Henüz çalıştırma yok</StatusBadge>
          )}
        </SectionCard>

        <SectionCard
          title="AI kullanımı"
          contentClassName="flex flex-col gap-2"
          action={
            <Link
              href="/dashboard/ai-brain"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
            >
              AI Brain <ArrowRight aria-hidden className="size-3" />
            </Link>
          }
        >
          <div className="flex items-center gap-3">
            <div className="bg-primary/12 flex size-9 items-center justify-center rounded-lg">
              <Bot aria-hidden className="text-primary size-4.5" />
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums">
                {overview.aiUsage.runsLast7Days}
              </p>
              <p className="text-muted-foreground text-xs">
                AI çağrısı (7 gün) · {overview.aiUsage.needsApprovalLast7Days}{" "}
                insan onaylı
              </p>
            </div>
          </div>
          {overview.aiUsage.failedLast7Days > 0 ? (
            <StatusBadge tone="danger">
              {overview.aiUsage.failedLast7Days} başarısız çağrı
            </StatusBadge>
          ) : overview.aiUsage.runsLast7Days > 0 ? (
            <StatusBadge tone="success">Hatasız çalışıyor</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Henüz çağrı yok</StatusBadge>
          )}
        </SectionCard>

        <SectionCard
          title="Bildirimler"
          contentClassName="flex flex-col gap-2"
          action={
            <Link
              href="/dashboard/notifications"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
            >
              Aç <ArrowRight aria-hidden className="size-3" />
            </Link>
          }
        >
          <div className="flex items-center gap-3">
            <div className="bg-muted flex size-9 items-center justify-center rounded-lg">
              <Activity aria-hidden className="text-muted-foreground size-4.5" />
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums">
                {unreadNotifications}
              </p>
              <p className="text-muted-foreground text-xs">okunmamış bildirim</p>
            </div>
          </div>
          {unreadNotifications > 0 ? (
            <StatusBadge tone="info">İnceleme bekliyor</StatusBadge>
          ) : (
            <StatusBadge tone="success">Hepsi okundu</StatusBadge>
          )}
        </SectionCard>
      </div>

      {/* AI model kullanımı */}
      <SectionCard
        title="AI maliyet ve model kullanımı"
        description={
          overview.aiUsage.lastRunAt
            ? `Son 7 gün · son çağrı ${formatRelativeTr(overview.aiUsage.lastRunAt)}`
            : "Son 7 gün · ai_runs loglarından"
        }
      >
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiCard
            label="Çağrı"
            value={String(overview.aiUsage.runsLast7Days)}
          />
          <KpiCard
            label="Tah. maliyet"
            value={
              overview.aiUsage.totalCostUsd > 0
                ? `$${overview.aiUsage.totalCostUsd.toFixed(4)}`
                : "—"
            }
          />
          <KpiCard
            label="Başarısız"
            value={String(overview.aiUsage.failedLast7Days)}
          />
          <KpiCard
            label="Onay bekleyen"
            value={String(overview.aiUsage.needsApprovalLast7Days)}
          />
        </div>

        <div className="mb-5">
          <p className="text-muted-foreground mb-2 text-xs font-medium">
            Ayarlı model matrisi (.env)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-border/60 text-xs">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Katman
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Model
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Ne zaman / hangi iş
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.aiUsage.configuredRoutes.map((row) => (
                  <tr
                    key={row.tier}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="py-2 pr-3">
                      <StatusBadge tone="info" withDot={false}>
                        {row.tier}
                      </StatusBadge>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.model}</td>
                    <td className="text-muted-foreground py-2 text-xs">
                      {row.jobs}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {overview.aiUsage.models.length === 0 ? (
          <EmptyState
            icon={Bot}
            compact
            title="Model kullanımı yok"
            description="Son 7 günde loglanmış AI çağrısı bulunamadı. Yeni DM/CEO çağrıları burada görünür."
          />
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium">
                Kullanılan modeller (log)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border/60 text-xs">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Model
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        İşler
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        Çağrı
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        Token (g/ç)
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        Tah. maliyet
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Son
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.aiUsage.models.map((row) => (
                      <tr
                        key={row.model}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="py-2 pr-3 font-medium">{row.model}</td>
                        <td className="text-muted-foreground py-2 pr-3 text-xs">
                          {row.tasks
                            .slice(0, 3)
                            .map((t) => `${t.label} (${t.runs})`)
                            .join(" · ") || "—"}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {row.runs.toLocaleString("tr-TR")}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-xs">
                          {row.inputTokens.toLocaleString("tr-TR")} /{" "}
                          {row.outputTokens.toLocaleString("tr-TR")}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {row.estimatedCost > 0
                            ? `$${row.estimatedCost.toFixed(4)}`
                            : "—"}
                        </td>
                        <td className="text-muted-foreground py-2 text-right text-xs">
                          {row.lastRunAt
                            ? formatRelativeTr(row.lastRunAt)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium">
                Görev bazlı özet
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border/60 text-xs">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Görev
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Model(ler)
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        Çağrı
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        Tah. maliyet
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Son
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.aiUsage.tasks.map((row) => (
                      <tr
                        key={row.taskType}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="py-2 pr-3 font-medium">{row.label}</td>
                        <td className="py-2 pr-3 font-mono text-xs">
                          {row.models.join(", ")}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {row.runs.toLocaleString("tr-TR")}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {row.estimatedCost > 0
                            ? `$${row.estimatedCost.toFixed(4)}`
                            : "—"}
                        </td>
                        <td className="text-muted-foreground py-2 text-right text-xs">
                          {row.lastRunAt
                            ? formatRelativeTr(row.lastRunAt)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {overview.aiUsage.recentRuns.length > 0 ? (
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  Son çağrılar
                </p>
                <ol className="divide-y divide-border/40 rounded-lg border border-border/50">
                  {overview.aiUsage.recentRuns.map((run) => (
                    <li
                      key={run.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{run.taskLabel}</p>
                        <p className="text-muted-foreground font-mono text-xs">
                          {run.model}
                        </p>
                      </div>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                        <StatusBadge
                          tone={
                            run.status === "completed"
                              ? "success"
                              : run.status === "failed"
                                ? "danger"
                                : "warning"
                          }
                          withDot={false}
                        >
                          {run.status}
                        </StatusBadge>
                        <span className="tabular-nums">
                          {run.inputTokens.toLocaleString("tr-TR")}/
                          {run.outputTokens.toLocaleString("tr-TR")} tok
                        </span>
                        <span className="tabular-nums">
                          {run.estimatedCost != null && run.estimatedCost > 0
                            ? `$${run.estimatedCost.toFixed(4)}`
                            : "—"}
                        </span>
                        <span>{formatRelativeTr(run.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>

      {/* Aktivite */}
      <div className="grid gap-4 lg:grid-cols-1">
        <SectionCard
          title="Son aktivite"
          description="Müşteri zaman çizelgesinden son olaylar"
          contentClassName="p-0"
        >
          {overview.recentActivity.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Activity}
                compact
                title="Aktivite yok"
                description="Henüz zaman çizelgesi olayı kaydedilmedi."
              />
            </div>
          ) : (
            <ol className="divide-y divide-border/40">
              {overview.recentActivity.map((event) => (
                <li key={event.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span
                    aria-hidden
                    className="bg-primary/60 mt-1.5 size-1.5 shrink-0 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <Link
                        href={`/dashboard/customers/${event.contactId}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {event.title}
                      </Link>
                    </p>
                    {event.body ? (
                      <p className="text-muted-foreground truncate text-xs">
                        {event.body}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground shrink-0 text-[11px] whitespace-nowrap">
                    {ACTOR_LABELS[event.actorType] ?? event.actorType} ·{" "}
                    {formatRelativeTr(event.occurredAt)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
