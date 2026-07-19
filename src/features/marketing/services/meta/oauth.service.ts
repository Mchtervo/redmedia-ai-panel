import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  exchangeForLongLivedToken,
  persistMetaToken,
  debugMetaToken,
  hasMetaAppCredentials,
} from "@/features/marketing/services/meta/token.service";
import {
  graphGet,
  MetaGraphError,
  graphBaseUrl,
} from "@/features/marketing/services/meta/graph-client";

type TypedSupabaseClient = SupabaseClient<Database>;

/** Marketing + Instagram okuma + DM (bütçe değiştirme yok). */
export const META_OAUTH_SCOPES = [
  "ads_read",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_messaging",
  "instagram_basic",
  "instagram_manage_insights",
  "instagram_manage_messages",
  "read_insights",
].join(",");

function appId(): string {
  return process.env.META_APP_ID?.trim() ?? "";
}
function appSecret(): string {
  return process.env.META_APP_SECRET?.trim() ?? "";
}

function stateSecret(): string {
  return (
    process.env.META_OAUTH_STATE_SECRET?.trim() ||
    appSecret() ||
    "redmedia-meta-oauth-dev"
  );
}

export function getOAuthRedirectUri(requestOrigin: string): string {
  const configured = process.env.META_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${requestOrigin.replace(/\/$/, "")}/api/meta/oauth/callback`;
}

export function createOAuthState(): string {
  const nonce = randomBytes(16).toString("hex");
  const ts = Date.now().toString(36);
  const payload = `${nonce}.${ts}`;
  const sig = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

export function verifyOAuthState(state: string): boolean {
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [nonce, ts, sig] = parts;
  if (!nonce || !ts || !sig) return false;
  const ageMs = Date.now() - parseInt(ts, 36);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 15 * 60 * 1000) {
    return false;
  }
  const payload = `${nonce}.${ts}`;
  const expected = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function buildMetaOAuthAuthorizeUrl(params: {
  redirectUri: string;
  state: string;
}): string {
  if (!hasMetaAppCredentials()) {
    throw new MetaGraphError("META_APP_ID / META_APP_SECRET eksik.", {
      code: "misconfigured",
      httpStatus: 0,
    });
  }
  const version = process.env.META_GRAPH_API_VERSION?.trim() || "v22.0";
  const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
  url.searchParams.set("client_id", appId());
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", META_OAUTH_SCOPES);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export async function exchangeCodeForToken(params: {
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; expiresIn: number | null }> {
  const url = new URL(`${graphBaseUrl()}/oauth/access_token`);
  url.searchParams.set("client_id", appId());
  url.searchParams.set("client_secret", appSecret());
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("code", params.code);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!response.ok || !json.access_token) {
    throw new MetaGraphError(
      json.error?.message?.slice(0, 300) ?? "OAuth code değiştirilemedi.",
      { code: "oauth_error", httpStatus: response.status }
    );
  }
  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in ?? null,
  };
}

export async function completeMetaOAuth(
  supabase: TypedSupabaseClient,
  params: { code: string; redirectUri: string }
): Promise<{ metaUserName: string | null }> {
  const short = await exchangeCodeForToken(params);
  const longLived = await exchangeForLongLivedToken(short.accessToken);
  const debug = await debugMetaToken(longLived.accessToken);

  let userName: string | null = null;
  try {
    const me = await graphGet<{ id?: string; name?: string }>({
      accessToken: longLived.accessToken,
      path: "me",
      params: { fields: "id,name" },
    });
    userName = me.name ?? null;
  } catch {
    userName = null;
  }

  await persistMetaToken(supabase, {
    accessToken: longLived.accessToken,
    expiresInSeconds: longLived.expiresIn,
    scopes: debug.scopes,
    metaUserId: debug.userId,
    metaUserName: userName,
  });

  return { metaUserName: userName };
}
