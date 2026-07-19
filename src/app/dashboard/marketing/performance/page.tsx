import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import {
  listDualPerformance,
  resolveMarketingDateRange,
} from "@/features/marketing/services/marketing-metrics.service";
import { formatTry } from "@/features/ceo-intelligence/utils/time";

export const metadata: Metadata = {
  title: "Reklam Performansı — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

export default async function MarketingPerformancePage() {
  const supabase = createAdminClient();
  const range = resolveMarketingDateRange("last_30");
  const rows = await listDualPerformance(supabase, range);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Reklam Performansı</h2>
        <p className="text-muted-foreground text-sm">
          Campaign → Ad Set → Ad → Creative. Ana sıralama: kapora → rezervasyon →
          gelir → müşteri maliyeti → mesaj. Mesaj sayısı tek başına başarı değildir.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm">
          Yeterli veri bulunmuyor veya Meta hesabı henüz bağlanmadı. Sahte metrik
          gösterilmiyor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <th className="p-2">Reklam</th>
                <th className="p-2">Meta harcama</th>
                <th className="p-2">Mesaj</th>
                <th className="p-2">CRM müşteri</th>
                <th className="p-2">Gelir</th>
                <th className="p-2">ROAS</th>
                <th className="p-2">Müşteri maliyeti</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-medium">{r.name}</td>
                  <td className="p-2 tabular-nums">
                    {formatTry(r.meta.spend)}
                  </td>
                  <td className="p-2 tabular-nums">{r.meta.messages}</td>
                  <td className="p-2 tabular-nums">
                    {r.business.crmCustomers}
                  </td>
                  <td className="p-2 tabular-nums">
                    {formatTry(r.business.revenue)}
                  </td>
                  <td className="p-2 tabular-nums">
                    {r.business.roas === null
                      ? "—"
                      : r.business.roas.toFixed(2)}
                  </td>
                  <td className="p-2 tabular-nums">
                    {r.business.costPerCustomer === null
                      ? "—"
                      : formatTry(r.business.costPerCustomer)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
