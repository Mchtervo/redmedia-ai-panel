import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/server/supabase/admin";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SectionCard } from "@/components/dashboard/section-card";
import { isChatPlaceMcpConfigured } from "@/server/chatplace/mcp-client";
import { isOpenAiConfigured } from "@/lib/ai/openai-client";
import { resolveMetaAccessToken } from "@/features/marketing/services/meta/token.service";

export const metadata: Metadata = {
  title: "Entegrasyonlar — Redmedia AI Panel",
};
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const supabase = createAdminClient();
  const [metaToken, syncLogs, webhookCount] = await Promise.all([
    resolveMetaAccessToken(supabase).catch(() => null),
    supabase
      .from("marketing_sync_logs")
      .select("id, api_endpoint_kind, status, started_at, records_fetched")
      .order("started_at", { ascending: false })
      .limit(8),
    supabase
      .from("webhook_events")
      .select("id", { count: "exact", head: true }),
  ]);

  const chatplaceOk = isChatPlaceMcpConfigured();
  const openaiOk = isOpenAiConfigured();
  const metaOk = Boolean(metaToken);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entegrasyonlar"
        description="ChatPlace, Meta ve OpenAI bağlantı sağlığı. Anahtar değerleri gösterilmez."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SectionCard title="ChatPlace">
          <div className="space-y-2 text-sm">
            <StatusBadge tone={chatplaceOk ? "success" : "warning"}>
              {chatplaceOk ? "MCP yapılandırıldı" : "Eksik yapılandırma"}
            </StatusBadge>
            <p className="text-muted-foreground">
              Webhook olayları: {webhookCount.count ?? 0}
            </p>
            <p className="text-muted-foreground text-xs">
              Mesaj gönderme MCP aracı yok; AI cevabı webhook{" "}
              <code>data.reply</code> ile gider.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Meta">
          <div className="space-y-2 text-sm">
            <StatusBadge tone={metaOk ? "success" : "warning"}>
              {metaOk ? "Token mevcut" : "Bağlantı yok"}
            </StatusBadge>
            <Link
              href="/dashboard/marketing/connections"
              className="text-primary text-sm hover:underline"
            >
              Bağlantı yönetimına git
            </Link>
          </div>
        </SectionCard>

        <SectionCard title="OpenAI">
          <div className="space-y-2 text-sm">
            <StatusBadge tone={openaiOk ? "success" : "warning"}>
              {openaiOk ? "API key yapılandırıldı" : "API key yok"}
            </StatusBadge>
            <Link
              href="/dashboard/settings"
              className="text-primary text-sm hover:underline"
            >
              AI kontrollerine git
            </Link>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Son senkron logları">
        {(syncLogs.data ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">Henüz sync logu yok.</p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {(syncLogs.data ?? []).map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>
                  {log.api_endpoint_kind} · {log.status}
                </span>
                <span className="text-muted-foreground text-xs">
                  {log.records_fetched ?? 0} kayıt ·{" "}
                  {new Date(log.started_at).toLocaleString("tr-TR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
