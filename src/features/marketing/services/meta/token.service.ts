import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  graphGet,
  graphPostForm,
  MetaGraphError,
} from "@/features/marketing/services/meta/graph-client";

type TypedSupabaseClient = SupabaseClient<Database>;

/** Uzun ömürlü token bitimine bu kadar kala "süresi doluyor". */
const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

export type ResolvedMetaToken = {
  accessToken: string;
  source: "database";
  expiresAt: string | null;
  metaUserId: string | null;
};

export type MetaOAuthHealthLevel =
  | "connected"
  | "expiring"
  | "auth_required";

export type MetaTokenHealthSummary = {
  hasToken: boolean;
  source: "database" | null;
  isValid: boolean | null;
  expiresAt: string | null;
  scopes: string[];
  error: string | null;
  /** Connection Health: 🟢 connected · 🟡 expiring · 🔴 auth_required */
  level: MetaOAuthHealthLevel;
  /** UI etiketi */
  label: string;
  /** Meta'ya Bağlan / Tekrar Yetkilendir */
  oauthAction: "connect" | "reauthorize" | null;
  metaUserName: string | null;
};

function envAppId(): string {
  return process.env.META_APP_ID?.trim() ?? "";
}
function envAppSecret(): string {
  return process.env.META_APP_SECRET?.trim() ?? "";
}

export function hasMetaAppCredentials(): boolean {
  return Boolean(envAppId() && envAppSecret());
}

async function deactivateExpiredActiveTokens(
  supabase: TypedSupabaseClient
): Promise<void> {
  await supabase
    .from("meta_oauth_tokens")
    .update({ is_active: false })
    .eq("is_active", true)
    .lt("expires_at", new Date().toISOString());
}

/**
 * Aktif OAuth token (yalnızca database).
 * META_ACCESS_TOKEN env fallback kullanılmaz.
 */
export async function resolveMetaAccessToken(
  supabase: TypedSupabaseClient
): Promise<ResolvedMetaToken | null> {
  await deactivateExpiredActiveTokens(supabase);

  const { data } = await supabase
    .from("meta_oauth_tokens")
    .select("access_token, expires_at, meta_user_id, is_active")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.access_token) {
    return null;
  }

  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    await supabase
      .from("meta_oauth_tokens")
      .update({ is_active: false })
      .eq("is_active", true);
    return null;
  }

  return {
    accessToken: data.access_token,
    source: "database",
    expiresAt: data.expires_at,
    metaUserId: data.meta_user_id,
  };
}

export async function hasAnyMetaAccessToken(
  supabase: TypedSupabaseClient
): Promise<boolean> {
  const t = await resolveMetaAccessToken(supabase);
  return Boolean(t);
}

export type DebugTokenInfo = {
  isValid: boolean;
  appId: string | null;
  userId: string | null;
  scopes: string[];
  expiresAt: string | null;
  dataAccessExpiresAt: string | null;
};

/** debug_token — app access token ile doğrular. */
export async function debugMetaToken(
  userAccessToken: string
): Promise<DebugTokenInfo> {
  const appId = envAppId();
  const appSecret = envAppSecret();
  if (!appId || !appSecret) {
    throw new MetaGraphError("META_APP_ID / META_APP_SECRET eksik.", {
      code: "misconfigured",
      httpStatus: 0,
    });
  }

  const appToken = `${appId}|${appSecret}`;
  const res = await graphGet<{
    data?: {
      app_id?: string;
      is_valid?: boolean;
      user_id?: string;
      scopes?: string[];
      expires_at?: number;
      data_access_expires_at?: number;
    };
  }>({
    accessToken: appToken,
    path: "debug_token",
    params: { input_token: userAccessToken },
  });

  const d = res.data;
  return {
    isValid: Boolean(d?.is_valid),
    appId: d?.app_id ?? null,
    userId: d?.user_id ?? null,
    scopes: d?.scopes ?? [],
    expiresAt:
      d?.expires_at && d.expires_at > 0
        ? new Date(d.expires_at * 1000).toISOString()
        : null,
    dataAccessExpiresAt:
      d?.data_access_expires_at && d.data_access_expires_at > 0
        ? new Date(d.data_access_expires_at * 1000).toISOString()
        : null,
  };
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<{ accessToken: string; expiresIn: number | null }> {
  const appId = envAppId();
  const appSecret = envAppSecret();
  if (!appId || !appSecret) {
    throw new MetaGraphError("META_APP_ID / META_APP_SECRET eksik.", {
      code: "misconfigured",
      httpStatus: 0,
    });
  }

  const res = await graphGet<{
    access_token?: string;
    expires_in?: number;
    token_type?: string;
  }>({
    path: "oauth/access_token",
    omitAccessToken: true,
    params: {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    },
  });

  if (!res.access_token) {
    const post = await graphPostForm<{
      access_token?: string;
      expires_in?: number;
    }>({
      path: "oauth/access_token",
      body: {
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedToken,
      },
    });
    if (!post.access_token) {
      throw new MetaGraphError("Uzun ömürlü token alınamadı.", {
        code: "oauth_error",
        httpStatus: 400,
      });
    }
    return {
      accessToken: post.access_token,
      expiresIn: post.expires_in ?? null,
    };
  }

  return {
    accessToken: res.access_token,
    expiresIn: res.expires_in ?? null,
  };
}

/**
 * Eski aktif tokenları pasifleştirir, yeni long-lived tokenı aktif kaydeder.
 */
export async function persistMetaToken(
  supabase: TypedSupabaseClient,
  params: {
    accessToken: string;
    expiresInSeconds: number | null;
    scopes: string[];
    metaUserId: string | null;
    metaUserName: string | null;
  }
): Promise<void> {
  await supabase
    .from("meta_oauth_tokens")
    .update({ is_active: false })
    .eq("is_active", true);

  const expiresAt =
    params.expiresInSeconds && params.expiresInSeconds > 0
      ? new Date(Date.now() + params.expiresInSeconds * 1000).toISOString()
      : null;

  const { error } = await supabase.from("meta_oauth_tokens").insert({
    access_token: params.accessToken,
    token_type: "bearer",
    expires_at: expiresAt,
    scopes: params.scopes,
    meta_user_id: params.metaUserId,
    meta_user_name: params.metaUserName,
    is_active: true,
  });

  if (error) throw error;
}

function earliestExpiry(
  a: string | null,
  b: string | null
): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

export async function getTokenHealthSummary(
  supabase: TypedSupabaseClient
): Promise<MetaTokenHealthSummary> {
  const { data } = await supabase
    .from("meta_oauth_tokens")
    .select(
      "access_token, expires_at, scopes, meta_user_name, is_active, updated_at"
    )
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.access_token) {
    return {
      hasToken: false,
      source: null,
      isValid: null,
      expiresAt: null,
      scopes: [],
      error: "OAuth token yok. Meta'ya Bağlan ile yetkilendirin.",
      level: "auth_required",
      label: "Bağlı Değil",
      oauthAction: "connect",
      metaUserName: null,
    };
  }

  const clockExpired =
    Boolean(data.expires_at) &&
    new Date(data.expires_at!).getTime() < Date.now();

  if (clockExpired) {
    await supabase
      .from("meta_oauth_tokens")
      .update({ is_active: false })
      .eq("is_active", true);
    return {
      hasToken: false,
      source: "database",
      isValid: false,
      expiresAt: data.expires_at,
      scopes: data.scopes ?? [],
      error: "OAuth token süresi dolmuş.",
      level: "auth_required",
      label: "Yetkilendirme Gerekli",
      oauthAction: "reauthorize",
      metaUserName: data.meta_user_name,
    };
  }

  try {
    const debug = await debugMetaToken(data.access_token);
    const expiresAt = earliestExpiry(
      debug.expiresAt,
      earliestExpiry(debug.dataAccessExpiresAt, data.expires_at)
    );

    if (!debug.isValid) {
      await supabase
        .from("meta_oauth_tokens")
        .update({ is_active: false })
        .eq("is_active", true);
      return {
        hasToken: false,
        source: "database",
        isValid: false,
        expiresAt,
        scopes: debug.scopes,
        error: "OAuth token geçersiz.",
        level: "auth_required",
        label: "Yetkilendirme Gerekli",
        oauthAction: "reauthorize",
        metaUserName: data.meta_user_name,
      };
    }

    const msLeft = expiresAt
      ? new Date(expiresAt).getTime() - Date.now()
      : Number.POSITIVE_INFINITY;

    if (Number.isFinite(msLeft) && msLeft <= EXPIRING_SOON_MS) {
      return {
        hasToken: true,
        source: "database",
        isValid: true,
        expiresAt,
        scopes: debug.scopes,
        error: null,
        level: "expiring",
        label: "Süresi Doluyor",
        oauthAction: "reauthorize",
        metaUserName: data.meta_user_name,
      };
    }

    return {
      hasToken: true,
      source: "database",
      isValid: true,
      expiresAt,
      scopes: debug.scopes,
      error: null,
      level: "connected",
      label: "Bağlı",
      oauthAction: null,
      metaUserName: data.meta_user_name,
    };
  } catch (e) {
    return {
      hasToken: true,
      source: "database",
      isValid: null,
      expiresAt: data.expires_at,
      scopes: data.scopes ?? [],
      error: e instanceof Error ? e.message : "Token doğrulanamadı.",
      level: "auth_required",
      label: "Yetkilendirme Gerekli",
      oauthAction: "reauthorize",
      metaUserName: data.meta_user_name,
    };
  }
}
