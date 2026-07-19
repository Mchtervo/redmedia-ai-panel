/**
 * Conversations pagination alternatifleri.
 * npx tsx --env-file=.env.local scripts/meta-conversations-page-probe.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { resolveMetaAccessToken } from "../src/features/marketing/services/meta/token.service";
import { resolvePageAccessToken } from "../src/features/marketing/services/meta/page-resolve.service";
import { graphGet, graphBaseUrl } from "../src/features/marketing/services/meta/graph-client";
import { envIgAccountId } from "../src/features/marketing/services/meta/meta-mappers";

async function tryGet(label: string, fn: () => Promise<unknown>) {
  try {
    const res = await fn();
    const data = res as { data?: unknown[]; paging?: { next?: string } };
    console.log(
      "OK",
      label,
      "rows=",
      data.data?.length ?? 0,
      "next=",
      Boolean(data.paging?.next)
    );
    if (data.paging?.next) {
      console.log("  next_url_len", data.paging.next.length);
    }
    return data;
  } catch (e) {
    console.log("FAIL", label, e instanceof Error ? e.message.slice(0, 140) : e);
    return null;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = await resolveMetaAccessToken(sb);
  if (!token) throw new Error("no token");
  const page = await resolvePageAccessToken(token.accessToken);
  const ig = envIgAccountId() || page.igBusinessAccountId;
  console.log("page", page.pageId, "ig", ig);

  const first = await tryGet("page/conversations limit1", () =>
    graphGet({
      accessToken: page.pageAccessToken,
      path: `${page.pageId}/conversations`,
      params: { platform: "instagram", fields: "id", limit: 1 },
    })
  );

  if (first?.paging?.next) {
    // paging.next genelde access_token içerir — omitAccessToken
    await tryGet("paging.next full url", () =>
      graphGet({
        path: first.paging!.next!,
        omitAccessToken: true,
      })
    );
  }

  if (ig) {
    await tryGet("ig/conversations", () =>
      graphGet({
        accessToken: page.pageAccessToken,
        path: `${ig}/conversations`,
        params: { fields: "id", limit: 1 },
      })
    );
  }

  await tryGet("me/conversations page token", () =>
    graphGet({
      accessToken: page.pageAccessToken,
      path: "me/conversations",
      params: { platform: "instagram", fields: "id", limit: 1 },
    })
  );

  // Farklı API sürümü
  const v21 = `https://graph.facebook.com/v21.0/${page.pageId}/conversations`;
  await tryGet("v21.0 conversations", async () => {
    const u = new URL(v21);
    u.searchParams.set("platform", "instagram");
    u.searchParams.set("fields", "id");
    u.searchParams.set("limit", "1");
    u.searchParams.set("access_token", page.pageAccessToken);
    const r = await fetch(u.toString());
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error?.message ?? r.statusText);
    return j;
  });

  console.log("graphBase", graphBaseUrl());
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
