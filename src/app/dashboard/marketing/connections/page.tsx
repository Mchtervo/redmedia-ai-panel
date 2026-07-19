import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import { getConnectionHealthBundle } from "@/features/marketing/services/meta-connection.service";
import {
  CONNECTION_STATUS_LABELS,
  META_CONNECTION_LABELS,
  type ConnectionStatus,
  type MetaConnectionType,
} from "@/features/marketing/types";
import {
  MetaOAuthConnectButton,
  MetaSyncKindButton,
  TestAllConnectionsButton,
  TestConnectionButton,
} from "@/features/marketing/components/sync-button";
import { Badge } from "@/components/ui/badge";
import type { MetaOAuthHealthLevel } from "@/features/marketing/services/meta/token.service";

export const metadata: Metadata = {
  title: "Bağlantılar — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ oauth?: string; reason?: string }>;
};

const OAUTH_LEVEL_UI: Record<
  MetaOAuthHealthLevel,
  { emoji: string; className: string }
> = {
  connected: {
    emoji: "🟢",
    className: "border-green-600/30 bg-green-600/10",
  },
  expiring: {
    emoji: "🟡",
    className: "border-amber-500/40 bg-amber-500/10",
  },
  auth_required: {
    emoji: "🔴",
    className: "border-destructive/40 bg-destructive/10",
  },
};

export default async function MarketingConnectionsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = createAdminClient();
  const health = await getConnectionHealthBundle(supabase);
  const oauth = health.tokenHealth;
  const levelUi = OAUTH_LEVEL_UI[oauth.level];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium">Bağlantılar ve Sağlık</h2>
          <p className="text-muted-foreground text-sm">
            Meta erişimi yalnızca OAuth ile. Secret değerler tarayıcıya gitmez.
            Kampanya kapatma / bütçe değişikliği yapılmaz.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {oauth.oauthAction === "reauthorize" ? (
            <MetaOAuthConnectButton label="Tekrar Yetkilendir" />
          ) : oauth.oauthAction === "connect" ? (
            <MetaOAuthConnectButton label="Meta'ya Bağlan" />
          ) : (
            <MetaOAuthConnectButton
              label="Meta'ya Bağlan"
              variant="outline"
            />
          )}
          <TestAllConnectionsButton />
        </div>
      </div>

      {sp.oauth === "success" ? (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm">
          Meta OAuth başarılı. Yeni uzun ömürlü token kaydedildi; eski token
          pasifleştirildi. Bağlantı testleri çalıştırıldı.
        </p>
      ) : null}
      {sp.oauth === "error" ? (
        <p className="text-destructive rounded-lg border px-3 py-2 text-sm">
          OAuth hatası: {sp.reason ?? "bilinmeyen"}
        </p>
      ) : null}

      <section
        className={`rounded-xl border p-4 ${levelUi.className}`}
        aria-label="Meta OAuth Connection Health"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-medium">Connection Health</h3>
            <p className="mt-1 text-lg font-semibold">
              <span aria-hidden="true">{levelUi.emoji} </span>
              {oauth.label}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Kaynak: OAuth (veritabanı)
              {oauth.metaUserName ? ` · ${oauth.metaUserName}` : ""}
              {oauth.expiresAt
                ? ` · Bitiş: ${new Date(oauth.expiresAt).toLocaleString("tr-TR")}`
                : ""}
            </p>
            {oauth.error ? (
              <p className="text-destructive mt-1 text-xs">{oauth.error}</p>
            ) : null}
          </div>
          {oauth.oauthAction === "reauthorize" ? (
            <MetaOAuthConnectButton label="Tekrar Yetkilendir" />
          ) : oauth.oauthAction === "connect" ? (
            <MetaOAuthConnectButton label="Meta'ya Bağlan" />
          ) : null}
        </div>
        {oauth.scopes.length > 0 ? (
          <p className="mt-3 text-xs">Scope: {oauth.scopes.join(", ")}</p>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HealthCard
          label="Kampanya (DB)"
          value={String(health.stats.campaigns)}
        />
        <HealthCard label="Reklam (DB)" value={String(health.stats.ads)} />
        <HealthCard
          label="IG gönderi (DB)"
          value={String(health.stats.instagramMedia)}
        />
      </section>

      <section className="rounded-xl border p-4 text-sm">
        <h3 className="font-medium">Ortam (sunucu)</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Yapılandırılmış: {health.env.configuredKeys.length} · Eksik:{" "}
          {health.env.missingKeys.join(", ") || "yok"}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Access token: yalnızca OAuth DB — META_ACCESS_TOKEN kullanılmaz.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Manuel senkron</h3>
        <div className="flex flex-wrap gap-2">
          <MetaSyncKindButton kind="full" label="Tam senkron" />
          <MetaSyncKindButton kind="campaigns" label="Campaigns" />
          <MetaSyncKindButton kind="adsets" label="Ad Sets" />
          <MetaSyncKindButton kind="ads" label="Ads + Creatives" />
          <MetaSyncKindButton kind="insights" label="Insights" />
          <MetaSyncKindButton kind="instagram" label="Instagram" />
        </div>
        <p className="text-muted-foreground text-xs">
          Otomatik günlük sync:{" "}
          <code className="text-[11px]">GET /api/cron/meta-sync</code> (Bearer
          CRON_SECRET)
        </p>
      </section>

      <ul className="space-y-3">
        {health.connections.map((c) => (
          <li
            key={c.id}
            className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="font-medium">
                {META_CONNECTION_LABELS[
                  c.connection_type as MetaConnectionType
                ] ?? c.connection_type}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">
                  {CONNECTION_STATUS_LABELS[c.status as ConnectionStatus] ??
                    c.status}
                </Badge>
                {c.external_id ? (
                  <span className="text-muted-foreground">
                    ID: {c.external_id}
                  </span>
                ) : null}
                <span className="text-muted-foreground">
                  Son senkron:{" "}
                  {c.last_synced_at
                    ? new Date(c.last_synced_at).toLocaleString("tr-TR")
                    : "—"}
                </span>
                <span className="text-muted-foreground">
                  Son test:{" "}
                  {c.last_tested_at
                    ? new Date(c.last_tested_at).toLocaleString("tr-TR")
                    : "—"}
                </span>
              </div>
              {c.last_error ? (
                <p className="text-destructive mt-1 text-xs">{c.last_error}</p>
              ) : null}
            </div>
            <TestConnectionButton
              connectionType={c.connection_type as MetaConnectionType}
            />
          </li>
        ))}
      </ul>

      <section className="space-y-2">
        <h3 className="font-medium">Senkron logları</h3>
        {health.logs.length === 0 ? (
          <p className="text-muted-foreground text-sm">Log yok.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {health.logs.map((log) => (
              <li key={log.id} className="rounded-lg border px-3 py-2">
                {log.sync_type}
                {log.api_endpoint_kind ? `/${log.api_endpoint_kind}` : ""} ·{" "}
                {log.status} · kayıt: {log.records_fetched} ·{" "}
                {new Date(log.started_at).toLocaleString("tr-TR")}
                {log.error_message ? ` — ${log.error_message}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function HealthCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {hint ? (
        <div className="text-muted-foreground mt-0.5 text-[11px]">{hint}</div>
      ) : null}
    </div>
  );
}
