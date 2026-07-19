import Link from "next/link";
import { PlugZap } from "lucide-react";
import { formatTry } from "@/features/ceo-intelligence/utils/time";
import type { MarketingOverviewMetrics } from "@/features/marketing/types";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { buttonVariants } from "@/components/ui/button";

function money(n: number | null): string {
  if (n === null) return "—";
  return formatTry(n);
}

function num(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("tr-TR");
}

export function MarketingOverviewCards({
  metrics,
}: {
  metrics: MarketingOverviewMetrics;
}) {
  if (!metrics.hasData) {
    return (
      <EmptyState
        icon={PlugZap}
        title={metrics.emptyMessage}
        description="Sahte veri gösterilmiyor. Meta bağlantısını kurun ve senkronizasyonu çalıştırın."
        action={
          <Link
            href="/dashboard/marketing/connections"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Bağlantılar ve Ayarlar
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Toplam reklam harcaması"
          value={money(metrics.totalSpend)}
        />
        <KpiCard
          label="Reklam kaynaklı müşteri"
          value={num(metrics.customersFromAds)}
          hint={
            metrics.unknownSourceCount !== null
              ? `${num(metrics.unknownSourceCount)} kaynağı belirsiz`
              : undefined
          }
        />
        <KpiCard label="Rezervasyon" value={num(metrics.reservations)} />
        <KpiCard label="Kapora" value={num(metrics.deposits)} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Müşteri başı maliyet"
          value={money(metrics.costPerCustomer)}
        />
        <KpiCard
          label="Rezervasyon başı maliyet"
          value={money(metrics.costPerReservation)}
        />
        <KpiCard
          label="Kapora başı maliyet"
          value={money(metrics.costPerDeposit)}
        />
        <KpiCard
          label="En başarılı kampanya"
          value={
            metrics.bestCampaign
              ? metrics.bestCampaign.name
              : "Yeterli veri yok"
          }
          hint={
            metrics.bestCampaign
              ? `${metrics.bestCampaign.deposits} doğrulanmış müşteri`
              : undefined
          }
        />
      </div>
    </div>
  );
}
