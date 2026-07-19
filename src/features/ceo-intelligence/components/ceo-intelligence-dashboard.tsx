import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Flame,
  Lightbulb,
  ListChecks,
  Megaphone,
  TrendingUp,
} from "lucide-react";
import type { CeoDashboardPayload } from "@/features/ceo-intelligence/types";
import { formatTry } from "@/features/ceo-intelligence/utils/time";
import { LIFECYCLE_STAGE_LABELS } from "@/features/smart-sales/types";
import type { LifecycleStage } from "@/features/smart-sales/types";
import { CeoAssistantChat } from "@/features/ceo-intelligence/components/ceo-assistant-chat";
import { IntelligenceBriefList } from "@/features/intelligence/components/intelligence-brief-card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge, type StatusTone } from "@/components/dashboard/status-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FunnelChart } from "@/components/charts/funnel-chart";
import { DonutChart } from "@/components/charts/donut-chart";

type Props = {
  data: CeoDashboardPayload;
};

const SEVERITY_TONES: Record<string, StatusTone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "neutral",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Kritik",
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
};

function NamedCountList({
  items,
  emptyText,
}: {
  items: { id: string; label: string; count: number }[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyText}</p>;
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-2">
      {items.slice(0, 6).map((item) => (
        <li key={item.id}>
          <div className="mb-0.5 flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {item.count.toLocaleString("tr-TR")}
            </span>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-chart-2 h-full rounded-full"
              style={{ width: `${Math.max((item.count / max) * 100, 4)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CeoIntelligenceDashboard({ data }: Props) {
  const m = data.metrics;
  const salesDelta = m.salesToday - m.salesYesterday;

  return (
    <div className="space-y-5">
      {/* Yönetici özeti */}
      <SectionCard
        title="Yönetici özeti"
        description={`Güncellendi: ${new Date(data.briefGeneratedAt).toLocaleString("tr-TR")} · salt okuma karar desteği`}
        className="animate-rise"
      >
        <div className="space-y-3">
          {data.narrative ? (
            <p className="text-sm leading-relaxed">{data.narrative}</p>
          ) : null}
          {data.summaryBullets.length > 0 ? (
            <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
              {data.summaryBullets.map((bullet) => (
                <li
                  key={bullet}
                  className="bg-muted/40 flex items-start gap-2 rounded-lg px-3 py-2"
                >
                  <span
                    aria-hidden
                    className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full"
                  />
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}
          {m.dataGaps.length > 0 ? (
            <div className="border-warning/30 bg-warning/8 rounded-lg border px-3 py-2 text-xs">
              <p className="text-warning mb-1 flex items-center gap-1.5 font-medium">
                <AlertTriangle aria-hidden className="size-3.5" />
                Veri boşlukları
              </p>
              <ul className="text-muted-foreground list-inside list-disc space-y-0.5">
                {m.dataGaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {/* KPI'lar */}
      <div className="animate-rise-late grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Tahmini ciro (bugün)"
          value={formatTry(m.estimatedRevenueToday)}
          hint={`Hafta: ${formatTry(m.estimatedRevenueThisWeek)}`}
        />
        <KpiCard
          label="Satış (bugün / dün)"
          value={`${m.salesToday} / ${m.salesYesterday}`}
          trend={{
            changePercent:
              m.salesYesterday > 0
                ? Math.round((salesDelta / m.salesYesterday) * 100)
                : salesDelta > 0
                  ? 100
                  : 0,
            label: "düne göre",
          }}
        />
        <KpiCard
          label="Dönüşüm oranı (ay)"
          value={m.conversionRateMonth === null ? "—" : `%${m.conversionRateMonth}`}
          hint={`${m.reservationsThisMonth} rezervasyon · ${m.cancelledThisMonth} iptal`}
        />
        <KpiCard
          label="Bekleyen tahsilat"
          value={formatTry(m.pendingCollections)}
          hint={`${m.pendingCollectionsCount} kayıt`}
        />
      </div>

      {/* Satış / rezervasyon / operasyon sağlığı */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Satış sağlığı"
          description="Bugünün satış hunisi"
        >
          <FunnelChart
            steps={[
              { label: "Yeni müşteri (bugün)", value: m.newCustomersToday },
              { label: "Aktif konuşma", value: m.activeConversations },
              { label: "Kapora bekleyen", value: m.awaitingDeposit },
              { label: "Kapora onaylanan (bugün)", value: m.depositsVerifiedToday },
            ]}
          />
          <p className="text-muted-foreground mt-3 text-xs">
            Son 30 günde pazarlıkta kalan: {m.negotiatingLast30Days} müşteri
          </p>
        </SectionCard>

        <SectionCard
          title="Rezervasyon sağlığı"
          description="Önümüzdeki 7 gün doluluk"
        >
          <div className="mb-3 flex items-center gap-4">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{m.shootsToday}</p>
              <p className="text-muted-foreground text-xs">bugün çekim</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {m.staffOnDutyToday}
                <span className="text-muted-foreground text-sm font-normal">
                  /{m.staffActiveTotal}
                </span>
              </p>
              <p className="text-muted-foreground text-xs">personel görevde</p>
            </div>
          </div>
          {m.busyDaysAhead.length > 0 ? (
            <NamedCountList
              items={m.busyDaysAhead.map((d) => ({
                ...d,
                label: new Date(`${d.label}T00:00:00`).toLocaleDateString(
                  "tr-TR",
                  { day: "numeric", month: "short", weekday: "short" }
                ),
              }))}
              emptyText=""
            />
          ) : (
            <EmptyState
              icon={CalendarDays}
              compact
              title="Önümüzdeki 7 günde çekim yok"
              description="Boş günler satış fırsatı olarak değerlendirilebilir."
            />
          )}
          {m.freeDaysThisWeek.length > 0 ? (
            <p className="text-muted-foreground mt-3 text-xs">
              Bu hafta boş günler:{" "}
              {m.freeDaysThisWeek
                .map((d) =>
                  new Date(`${d}T00:00:00`).toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "short",
                  })
                )
                .join(", ")}
            </p>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Pazarlama performansı"
          description="Bu ay atıf alan kampanyalar"
          action={
            <Link
              href="/dashboard/marketing"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
            >
              Marketing <ArrowRight aria-hidden className="size-3" />
            </Link>
          }
        >
          {m.topCampaignsByAttribution.length > 0 ? (
            <NamedCountList
              items={m.topCampaignsByAttribution}
              emptyText=""
            />
          ) : (
            <EmptyState
              icon={Megaphone}
              compact
              title="Atıf verisi yok"
              description="Bu ay kampanyaya bağlanabilen müşteri olayı bulunamadı."
            />
          )}
        </SectionCard>
      </div>

      {/* AI Intelligence brief'leri */}
      <SectionCard
        title="AI Intelligence"
        description="Her kart: Neden oldu? · Sonra ne olacak? · Şimdi ne yapmalıyım? — kanıt ve güven skoru ile"
      >
        <IntelligenceBriefList briefs={data.intelligenceBriefs} />
      </SectionCard>

      {/* Risk + öneri + aksiyon */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Risk merkezi"
          description="Önem sırasına göre"
          contentClassName="p-0"
        >
          {data.risks.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={AlertTriangle}
                compact
                title="Kritik risk yok"
                description="Şu an takip gerektiren risk tespit edilmedi."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {data.risks.map((risk) => (
                <li key={risk.id} className="px-4 py-3 text-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <StatusBadge tone={SEVERITY_TONES[risk.severity] ?? "neutral"}>
                      {SEVERITY_LABELS[risk.severity] ?? risk.severity}
                    </StatusBadge>
                    <span className="font-medium">{risk.title}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">{risk.detail}</p>
                  {risk.href ? (
                    <Link
                      href={risk.href}
                      className="text-primary mt-1 inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
                    >
                      Panele git <ArrowRight aria-hidden className="size-3" />
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Fırsatlar ve öneriler"
          description="Yalnızca tavsiye — karar sizde"
          contentClassName="p-0"
        >
          {data.recommendations.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Lightbulb}
                compact
                title="Öneri yok"
                description="Yeterli veri oluştuğunda öneriler burada görünecek."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {data.recommendations.map((rec) => (
                <li key={rec.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">{rec.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {rec.detail}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Bugün yapılacaklar"
          description="Önerilen aksiyonlar"
          contentClassName="p-0"
        >
          {data.actionItems.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={ListChecks}
                compact
                title="Aksiyon yok"
                description="Bugün için önerilen aksiyon bulunmuyor."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {data.actionItems.map((action) => (
                <li key={action.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">{action.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {action.detail}
                  </p>
                  {action.href ? (
                    <Link
                      href={action.href}
                      className="text-primary mt-1 inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
                    >
                      Aç <ArrowRight aria-hidden className="size-3" />
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* En sıcak fırsatlar + iş dağılımı */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="En sıcak satış fırsatları"
          description="Fırsat skoru 60+ olan aktif müşteriler"
          contentClassName="p-0"
        >
          {m.hotOpportunities.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Flame}
                compact
                title="Sıcak fırsat yok"
                description="Skoru 60'ın üzerinde aktif müşteri bulunmuyor."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {m.hotOpportunities.map((h) => (
                <li
                  key={h.contactId}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="bg-primary/12 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
                    {h.opportunityScore}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/customers/${h.contactId}`}
                      className="block truncate font-medium underline-offset-4 hover:underline"
                    >
                      {h.name}
                    </Link>
                    <p className="text-muted-foreground truncate text-xs">
                      {LIFECYCLE_STAGE_LABELS[
                        h.lifecycleStage as LifecycleStage
                      ] ?? h.lifecycleStage}
                      {h.tags.length > 0 ? ` · ${h.tags.slice(0, 3).join(", ")}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Talep dağılımı"
          description="Bu ay en çok tercih edilen paketler"
        >
          {m.topPackages.length > 0 ? (
            <DonutChart
              data={m.topPackages.slice(0, 5).map((p) => ({
                name: p.label,
                value: p.count,
              }))}
              centerValue={String(
                m.topPackages.reduce((sum, p) => sum + p.count, 0)
              )}
              centerLabel="paket seçimi"
            />
          ) : (
            <EmptyState
              icon={TrendingUp}
              compact
              title="Paket verisi yok"
              description="Bu ay hizmet seçimi içeren rezervasyon bulunamadı."
            />
          )}
          {m.topObjections.length > 0 ? (
            <div className="mt-4 border-t border-border/40 pt-3">
              <p className="text-muted-foreground mb-2 text-xs font-medium">
                En sık itirazlar (30 gün)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {m.topObjections.slice(0, 6).map((o) => (
                  <StatusBadge key={o.id} tone="neutral" withDot={false}>
                    {o.label} · {o.count}
                  </StatusBadge>
                ))}
              </div>
            </div>
          ) : null}
        </SectionCard>
      </div>

      <SectionCard
        title="Neden rezervasyon olmuyor?"
        description={`Son ${data.reservationBlockers.periodDays} gün · rezervasyonsuz analiz ${data.reservationBlockers.analyzedWithoutReservation}`}
      >
        {data.reservationBlockers.dataSufficiency === "insufficient" ? (
          <EmptyState
            icon={TrendingUp}
            compact
            title="Yeterli veri yok"
            description="Daha fazla konuşma analiz edildikçe kayıp nedenleri burada toplanır."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <KpiCard
                label="Rezervasyonsuz"
                value={String(
                  data.reservationBlockers.analyzedWithoutReservation
                )}
              />
              <KpiCard
                label="Kayıp"
                value={String(data.reservationBlockers.lostCount)}
              />
              <KpiCard
                label="Açık"
                value={String(data.reservationBlockers.openCount)}
              />
            </div>
            {data.reservationBlockers.topReasons.length > 0 ? (
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  En sık nedenler
                </p>
                <NamedCountList
                  items={data.reservationBlockers.topReasons}
                  emptyText="Neden kaydı yok."
                />
              </div>
            ) : null}
            {data.reservationBlockers.topDropOffs.length > 0 ? (
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  Kopuş noktaları
                </p>
                <NamedCountList
                  items={data.reservationBlockers.topDropOffs}
                  emptyText="Kopuş kaydı yok."
                />
              </div>
            ) : null}
            {data.reservationBlockers.suggestions.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {data.reservationBlockers.suggestions.map((s) => (
                  <li key={s} className="flex gap-2">
                    <Lightbulb className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href="/dashboard/follow-ups"
                className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
              >
                Follow-up kuyruğu <ArrowRight className="size-3.5" />
              </Link>
              <Link
                href="/dashboard/ai"
                className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
              >
                AI Öğrenme <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        )}
      </SectionCard>

      <CeoAssistantChat />

      {data.latestDailyReport ? (
        <SectionCard
          title="Son günlük rapor"
          description={`${data.latestDailyReport.reportDate} · ${new Date(
            data.latestDailyReport.generatedAt
          ).toLocaleString("tr-TR")}`}
        >
          <pre className="bg-muted/40 scrollbar-thin max-h-64 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
            {data.latestDailyReport.contentMarkdown}
          </pre>
        </SectionCard>
      ) : null}
    </div>
  );
}
