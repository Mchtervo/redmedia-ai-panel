import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/server/supabase/admin";
import {
  getAutopilotUiEnabled,
  isAutopilotEnvEnabled,
  isAutopilotFullyArmed,
  listRecentAdActionLogs,
} from "@/features/marketing/services/ads-autopilot.service";
import { AutopilotControls } from "@/features/marketing/components/autopilot-controls";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";

export const metadata: Metadata = {
  title: "Ads Autopilot — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

export default async function MarketingAutopilotPage() {
  const supabase = createAdminClient();
  const [uiEnabled, armed, logs] = await Promise.all([
    getAutopilotUiEnabled(supabase),
    isAutopilotFullyArmed(supabase),
    listRecentAdActionLogs(supabase, 20).catch(() => []),
  ]);
  const envEnabled = isAutopilotEnvEnabled();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Meta Ads Autopilot</h2>
        <p className="text-muted-foreground text-sm">
          Kötü ad set → pause; iyi ad set → bütçe +% (tavan env). Her eylem audit
          logda. Production’da env + UI ikisi de açık olmalı.
        </p>
      </div>

      <SectionCard title="Kontrol" description="Acil durdur UI kill-switch’tir.">
        <AutopilotControls
          envEnabled={envEnabled}
          uiEnabled={uiEnabled}
          armed={armed}
        />
        <ul className="text-muted-foreground mt-4 list-disc space-y-1 pl-5 text-xs">
          <li>
            <code>META_ADS_AUTOPILOT_ENABLED=true</code> (.env)
          </li>
          <li>
            <code>META_ADS_AUTOPILOT_MAX_BUDGET_DELTA_PCT</code> (varsayılan 20)
          </li>
          <li>
            <code>META_ADS_AUTOPILOT_MIN_SPEND_TRY</code> (erken karar yok)
          </li>
          <li>
            Meta OAuth’ta <code>ads_management</code> için{" "}
            <Link
              href="/dashboard/marketing/connections"
              className="underline"
            >
              Tekrar Yetkilendir
            </Link>
          </li>
        </ul>
      </SectionCard>

      <SectionCard title="Son eylemler" description="Audit log (hassas token yok).">
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Henüz log yok. Dry-run çalıştırın veya migration’ı uygulayın.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2">Zaman</th>
                  <th className="p-2">Meta ID</th>
                  <th className="p-2">Aksiyon</th>
                  <th className="p-2">Skor</th>
                  <th className="p-2">Dry-run</th>
                  <th className="p-2">Sonuç</th>
                  <th className="p-2">Gerekçe</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t">
                    <td className="p-2 text-xs tabular-nums">
                      {new Date(log.created_at).toLocaleString("tr-TR")}
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {log.meta_entity_id}
                    </td>
                    <td className="p-2">{log.action}</td>
                    <td className="p-2">
                      {log.score ? (
                        <StatusBadge
                          tone={
                            log.score === "good"
                              ? "success"
                              : log.score === "bad"
                                ? "danger"
                                : "neutral"
                          }
                        >
                          {log.score}
                        </StatusBadge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-2">{log.dry_run ? "evet" : "hayır"}</td>
                    <td className="p-2">
                      {log.success ? "ok" : log.error_code ?? "fail"}
                    </td>
                    <td className="text-muted-foreground max-w-[280px] truncate p-2 text-xs">
                      {log.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
