/**
 * Tek conversation participant çek — IGSID formatını doğrula.
 * npx tsx --env-file=.env.local scripts/meta-participants-probe.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { resolveMetaAccessToken } from "../src/features/marketing/services/meta/token.service";
import { graphGet } from "../src/features/marketing/services/meta/graph-client";
import { resolveFacebookPageId } from "../src/features/marketing/services/meta/page-resolve.service";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const resolved = await resolveMetaAccessToken(sb);
  if (!resolved) throw new Error("no token");
  const page = await resolveFacebookPageId(resolved.accessToken);
  const accounts = await graphGet<{
    data?: Array<{ id?: string; access_token?: string }>;
  }>({
    accessToken: resolved.accessToken,
    path: "me/accounts",
    params: { fields: "id,access_token", limit: 10 },
    signal: AbortSignal.timeout(15_000),
  });
  const pageToken = accounts.data?.find((a) => a.id === page.pageId)
    ?.access_token;
  if (!pageToken) throw new Error("no page token");

  const list = await graphGet<{ data?: Array<{ id?: string }> }>({
    accessToken: pageToken,
    path: `${page.pageId}/conversations`,
    params: { platform: "instagram", limit: 1, fields: "id" },
    signal: AbortSignal.timeout(15_000),
  });
  const threadId = list.data?.[0]?.id;
  console.log("thread:", threadId ? "ok" : "yok");
  if (!threadId) return;

  const detail = await graphGet<{
    id?: string;
    participants?: {
      data?: Array<{ id?: string; username?: string; name?: string }>;
    };
  }>({
    accessToken: pageToken,
    path: threadId,
    params: { fields: "id,participants" },
    signal: AbortSignal.timeout(15_000),
  });

  console.log("participants:");
  for (const p of detail.participants?.data ?? []) {
    console.log(JSON.stringify(p));
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
