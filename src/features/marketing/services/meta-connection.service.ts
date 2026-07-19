import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { graphGet, MetaGraphError } from "@/features/marketing/services/meta/graph-client";
import {
  resolveMetaAccessToken,
  getTokenHealthSummary,
} from "@/features/marketing/services/meta/token.service";
import {
  envAdAccountId,
  envBusinessId,
  envIgAccountId,
  envPixelId,
} from "@/features/marketing/services/meta/meta-mappers";
import { resolveFacebookPageId } from "@/features/marketing/services/meta/page-resolve.service";
import { testConversionsApiConnection } from "@/features/marketing/services/meta/capi.service";
import type { MetaConnectionType } from "@/features/marketing/types";
import { META_CONNECTION_TYPES } from "@/features/marketing/types";
import {
  syncMetaCampaigns,
  syncMetaAdSets,
  syncMetaAds,
  type SyncResult,
} from "@/features/marketing/services/meta/meta-ads-sync.service";
import { syncMetaInsights } from "@/features/marketing/services/meta/meta-insights-sync.service";
import { syncInstagramMedia } from "@/features/marketing/services/meta/meta-instagram-sync.service";
import { startSyncLog, finishSyncLog } from "@/features/marketing/services/meta/sync-log";

type TypedSupabaseClient = SupabaseClient<Database>;

export type MetaConnectionRow = {
  id: string;
  connection_type: MetaConnectionType;
  display_name: string | null;
  external_id: string | null;
  status:
    | "connected"
    | "disconnected"
    | "error"
    | "token_expired"
    | "configured";
  last_synced_at: string | null;
  last_tested_at: string | null;
  last_error: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export function getMetaEnvStatus(): {
  configuredKeys: string[];
  missingKeys: string[];
  hasAccessToken: boolean;
} {
  const keys = [
    "META_APP_ID",
    "META_APP_SECRET",
    "META_BUSINESS_ID",
    "META_AD_ACCOUNT_ID",
    "META_PAGE_ID",
    "META_INSTAGRAM_ACCOUNT_ID",
    "META_PIXEL_ID",
    "META_CAPI_ACCESS_TOKEN",
  ] as const;

  const configuredKeys: string[] = [];
  const missingKeys: string[] = [];
  for (const key of keys) {
    if (process.env[key]?.trim()) configuredKeys.push(key);
    else missingKeys.push(key);
  }

  return {
    configuredKeys,
    missingKeys,
    /** Access token artık yalnızca DB OAuth; env kullanılmaz. */
    hasAccessToken: false,
  };
}

export async function listMetaConnections(
  supabase: TypedSupabaseClient
): Promise<MetaConnectionRow[]> {
  const { data, error } = await supabase
    .from("meta_connections")
    .select("*")
    .order("connection_type");
  if (error) throw error;
  return (data ?? []) as MetaConnectionRow[];
}

export async function ensureMetaConnectionRows(
  supabase: TypedSupabaseClient
): Promise<void> {
  const existing = await listMetaConnections(supabase);
  const have = new Set(existing.map((c) => c.connection_type));
  for (const type of META_CONNECTION_TYPES) {
    if (have.has(type)) continue;
    await supabase.from("meta_connections").insert({
      connection_type: type,
      status: "disconnected",
    });
  }
}

async function updateConnection(
  supabase: TypedSupabaseClient,
  type: MetaConnectionType,
  patch: {
    status: MetaConnectionRow["status"];
    display_name?: string | null;
    external_id?: string | null;
    last_error?: string | null;
    last_tested_at?: string;
    last_synced_at?: string;
    metadata?: Json;
  }
) {
  const { error } = await supabase
    .from("meta_connections")
    .update({
      status: patch.status,
      display_name: patch.display_name,
      external_id: patch.external_id,
      last_error: patch.last_error ?? null,
      last_tested_at: patch.last_tested_at ?? new Date().toISOString(),
      last_synced_at: patch.last_synced_at,
      metadata: patch.metadata,
    })
    .eq("connection_type", type);
  if (error) {
    // Sessiz kalırsa test "başarılı" görünüp durum satırı eski kalıyor
    // (örn. migration eksikse check constraint hatası gizleniyordu).
    throw new Error(
      `meta_connections güncellenemedi (${type}): ${error.message}`
    );
  }
}

/**
 * Gerçek Graph API bağlantı testi (bağlantı türüne göre).
 */
export async function testMetaConnection(
  supabase: TypedSupabaseClient,
  connectionType: MetaConnectionType
): Promise<{ ok: boolean; message: string }> {
  const logId = await startSyncLog(
    supabase,
    "connection_test",
    connectionType
  );

  // CAPI tamamen ayrı: META_ACCESS_TOKEN / debug_token kullanılmaz
  if (connectionType === "conversions_api") {
    try {
      const result = await testConversionsApiConnection();
      if (result.outcome === "configured_unverified") {
        await updateConnection(supabase, connectionType, {
          status: "configured",
          display_name: "Conversions API",
          external_id: result.pixelId,
          last_error: null,
          metadata: {
            validation: "pending_test_event",
            note: result.message,
          } as Json,
        });
        await finishSyncLog(supabase, logId, {
          status: "success",
          records: 0,
        });
        return { ok: true, message: result.message };
      }
      if (result.outcome === "error") {
        await updateConnection(supabase, connectionType, {
          status: "error",
          display_name: "Conversions API",
          external_id: result.pixelId,
          last_error: result.message,
        });
        await finishSyncLog(supabase, logId, {
          status: "failed",
          records: 0,
          error: result.message,
        });
        return { ok: false, message: result.message };
      }
      await updateConnection(supabase, connectionType, {
        status: "connected",
        display_name: "Conversions API",
        external_id: result.pixelId,
        last_error: null,
        metadata: {
          validation: "test_event_ok",
          events_received: result.eventsReceived,
        } as Json,
      });
      await finishSyncLog(supabase, logId, {
        status: "success",
        records: result.eventsReceived ?? 1,
      });
      return { ok: true, message: result.message };
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "CAPI bağlantı testi başarısız.";
      await updateConnection(supabase, connectionType, {
        status: "error",
        display_name: "Conversions API",
        last_error: msg,
      });
      await finishSyncLog(supabase, logId, {
        status: "failed",
        records: 0,
        error: msg,
      });
      return { ok: false, message: msg };
    }
  }

  const token = await resolveMetaAccessToken(supabase);
  if (!token) {
    await updateConnection(supabase, connectionType, {
      status: "disconnected",
      last_error: "OAuth token yok. Meta'ya Bağlan ile yetkilendirin.",
    });
    await finishSyncLog(supabase, logId, {
      status: "skipped",
      records: 0,
      error: "OAuth token yok.",
    });
    return {
      ok: false,
      message: "OAuth token yok. Meta'ya Bağlan ile yetkilendirin.",
    };
  }

  try {
    switch (connectionType) {
      case "meta_business": {
        const id = envBusinessId();
        if (!id) throw new Error("META_BUSINESS_ID eksik.");
        const res = await graphGet<{ id?: string; name?: string }>({
          accessToken: token.accessToken,
          path: id,
          params: { fields: "id,name" },
        });
        await updateConnection(supabase, connectionType, {
          status: "connected",
          display_name: res.name ?? "Meta Business",
          external_id: res.id ?? id,
          last_error: null,
        });
        break;
      }
      case "meta_ad_account": {
        const id = envAdAccountId();
        if (!id || id === "act_") throw new Error("META_AD_ACCOUNT_ID eksik.");
        const res = await graphGet<{
          id?: string;
          name?: string;
          account_status?: number;
        }>({
          accessToken: token.accessToken,
          path: id,
          params: { fields: "id,name,account_status,currency" },
        });
        await updateConnection(supabase, connectionType, {
          status: "connected",
          display_name: res.name ?? id,
          external_id: res.id ?? id,
          last_error: null,
          metadata: { account_status: res.account_status ?? null } as Json,
        });
        break;
      }
      case "facebook_page": {
        const resolved = await resolveFacebookPageId(token.accessToken);
        const res = await graphGet<{ id?: string; name?: string; fan_count?: number }>({
          accessToken: token.accessToken,
          path: resolved.pageId,
          params: { fields: "id,name,fan_count" },
        });
        await updateConnection(supabase, connectionType, {
          status: "connected",
          display_name: res.name ?? resolved.page.name,
          external_id: res.id ?? resolved.pageId,
          last_error: null,
          metadata: {
            resolve_reason: resolved.reason,
            env_page_id: resolved.envPageId || null,
            env_mismatch: resolved.envMismatch,
            ig_account_id:
              resolved.page.instagram_business_account?.id ?? null,
          } as Json,
        });
        break;
      }
      case "instagram_business": {
        const id = envIgAccountId();
        if (!id) throw new Error("META_INSTAGRAM_ACCOUNT_ID eksik.");
        const res = await graphGet<{
          id?: string;
          username?: string;
          name?: string;
        }>({
          accessToken: token.accessToken,
          path: id,
          params: { fields: "id,username,name" },
        });
        await updateConnection(supabase, connectionType, {
          status: "connected",
          display_name: res.username
            ? `@${res.username}`
            : (res.name ?? "Instagram"),
          external_id: res.id ?? id,
          last_error: null,
        });
        break;
      }
      case "meta_pixel": {
        const id = envPixelId();
        if (!id) throw new Error("META_PIXEL_ID eksik.");
        const res = await graphGet<{ id?: string; name?: string }>({
          accessToken: token.accessToken,
          path: id,
          params: { fields: "id,name" },
        });
        await updateConnection(supabase, connectionType, {
          status: "connected",
          display_name: res.name ?? "Meta Pixel",
          external_id: res.id ?? id,
          last_error: null,
        });
        break;
      }
      default:
        throw new Error("Bilinmeyen bağlantı türü.");
    }

    await finishSyncLog(supabase, logId, {
      status: "success",
      records: 1,
    });
    return { ok: true, message: "Bağlantı testi başarılı." };
  } catch (e) {
    const isToken =
      e instanceof MetaGraphError && e.code === "token_expired";
    const msg = e instanceof Error ? e.message : "Bağlantı testi başarısız.";
    await updateConnection(supabase, connectionType, {
      status: isToken ? "token_expired" : "error",
      last_error: msg,
    });
    await finishSyncLog(supabase, logId, {
      status: "failed",
      records: 0,
      error: msg,
    });
    return { ok: false, message: msg };
  }
}

export async function testAllMetaConnections(
  supabase: TypedSupabaseClient
): Promise<{ results: Array<{ type: MetaConnectionType; ok: boolean; message: string }> }> {
  await ensureMetaConnectionRows(supabase);
  const results = [];
  for (const type of META_CONNECTION_TYPES) {
    const r = await testMetaConnection(supabase, type);
    results.push({ type, ok: r.ok, message: r.message });
  }
  return { results };
}

export type ManualSyncKind =
  | "full"
  | "campaigns"
  | "adsets"
  | "ads"
  | "creatives"
  | "insights"
  | "instagram";

export async function runManualMetaSync(
  supabase: TypedSupabaseClient,
  kind: ManualSyncKind
): Promise<{ ok: boolean; message: string; parts: SyncResult[] }> {
  const parts: SyncResult[] = [];

  const run = async (fn: () => Promise<SyncResult>) => {
    const r = await fn();
    parts.push(r);
    return r;
  };

  if (kind === "campaigns") await run(() => syncMetaCampaigns(supabase));
  else if (kind === "adsets") await run(() => syncMetaAdSets(supabase));
  else if (kind === "ads" || kind === "creatives")
    await run(() => syncMetaAds(supabase));
  else if (kind === "insights") await run(() => syncMetaInsights(supabase));
  else if (kind === "instagram") await run(() => syncInstagramMedia(supabase));
  else {
    // full pipeline
    await run(() => syncMetaCampaigns(supabase));
    await run(() => syncMetaAdSets(supabase));
    await run(() => syncMetaAds(supabase));
    await run(() => syncMetaInsights(supabase));
    await run(() => syncInstagramMedia(supabase));
  }

  // mark ad account connection synced
  const anyOk = parts.some((p) => p.ok);
  if (anyOk) {
    await supabase
      .from("meta_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .in("connection_type", [
        "meta_ad_account",
        "instagram_business",
        "facebook_page",
      ]);
  }

  const total = parts.reduce((s, p) => s + p.records, 0);
  const failed = parts.filter((p) => !p.ok);
  return {
    ok: failed.length === 0,
    message:
      failed.length === 0
        ? `Senkron tamamlandı (${total} kayıt).`
        : `Kısmi senkron: ${failed.map((f) => f.message).join(" | ")}`,
    parts,
  };
}

export async function getConnectionHealthBundle(
  supabase: TypedSupabaseClient
) {
  await ensureMetaConnectionRows(supabase);
  const [connections, tokenHealth, env] = await Promise.all([
    listMetaConnections(supabase),
    getTokenHealthSummary(supabase),
    Promise.resolve(getMetaEnvStatus()),
  ]);

  const { data: logs } = await supabase
    .from("marketing_sync_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(20);

  const { count: campaignCount } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true });
  const { count: adCount } = await supabase
    .from("ads")
    .select("id", { count: "exact", head: true });
  const { count: igCount } = await supabase
    .from("instagram_media")
    .select("id", { count: "exact", head: true });

  return {
    connections,
    tokenHealth,
    env,
    logs: logs ?? [],
    stats: {
      campaigns: campaignCount ?? 0,
      ads: adCount ?? 0,
      instagramMedia: igCount ?? 0,
    },
  };
}

/** Geriye uyumluluk — eski requestSync */
export async function requestSync(
  supabase: TypedSupabaseClient,
  syncType: "ads" | "insights" | "instagram" | "attribution"
): Promise<{ ok: boolean; message: string }> {
  if (syncType === "attribution") {
    return {
      ok: false,
      message: "Attribution sync ayrı CRM akışındadır; Meta sync değildir.",
    };
  }
  if (syncType === "ads") {
    const r = await runManualMetaSync(supabase, "full");
    return { ok: r.ok, message: r.message };
  }
  if (syncType === "insights") {
    const r = await runManualMetaSync(supabase, "insights");
    return { ok: r.ok, message: r.message };
  }
  const r = await runManualMetaSync(supabase, "instagram");
  return { ok: r.ok, message: r.message };
}

/**
 * @deprecated Env META_ACCESS_TOKEN kullanılmaz. hasAnyMetaAccessToken(supabase) kullanın.
 */
export function hasMetaAccessToken(): boolean {
  return false;
}
