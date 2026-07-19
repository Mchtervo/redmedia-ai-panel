/**
 * Meta Instagram DM gönderme yetkisi / API erişimi probe.
 * Secret loglanmaz. Kullanım: npx tsx --env-file=.env.local scripts/meta-messaging-probe.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import {
  debugMetaToken,
  resolveMetaAccessToken,
} from "../src/features/marketing/services/meta/token.service";
import { graphGet } from "../src/features/marketing/services/meta/graph-client";
import { resolveFacebookPageId } from "../src/features/marketing/services/meta/page-resolve.service";
import { envIgAccountId } from "../src/features/marketing/services/meta/meta-mappers";

const MESSAGING_SCOPES = [
  "pages_messaging",
  "instagram_manage_messages",
  "pages_manage_metadata",
  "pages_read_user_content",
] as const;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Supabase env eksik");
    process.exit(1);
  }

  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const resolved = await resolveMetaAccessToken(sb);
  if (!resolved) {
    console.error("OAuth token yok");
    process.exit(1);
  }

  const debug = await debugMetaToken(resolved.accessToken);
  const scopes = [...debug.scopes].sort();
  console.log("=== Meta Messaging Probe ===\n");
  console.log("token_valid:", debug.isValid);
  console.log("scopes_count:", scopes.length);
  console.log("scopes:");
  for (const s of scopes) console.log("  -", s);

  console.log("\nmessaging_scope_check:");
  for (const needed of MESSAGING_SCOPES) {
    const ok = scopes.includes(needed);
    console.log(`  ${ok ? "OK " : "NO "} | ${needed}`);
  }

  const page = await resolveFacebookPageId(resolved.accessToken);
  console.log("\npage:", page.page.name, page.pageId);

  let pageToken: string | null = null;
  try {
    // /me/accounts üzerinden page access token al (user token ile)
    const accounts = await graphGet<{
      data?: Array<{ id?: string; name?: string; access_token?: string }>;
    }>({
      accessToken: resolved.accessToken,
      path: "me/accounts",
      params: { fields: "id,name,access_token", limit: 25 },
    });
    const match = (accounts.data ?? []).find((a) => a.id === page.pageId);
    pageToken = match?.access_token ?? null;
    console.log(
      "me/accounts:",
      `pages=${accounts.data?.length ?? 0}`,
      pageToken ? "page_token=var" : "page_token=yok"
    );
    if (!pageToken) {
      const pageDetail = await graphGet<{
        id?: string;
        access_token?: string;
      }>({
        accessToken: resolved.accessToken,
        path: page.pageId,
        params: { fields: "id,access_token" },
      });
      pageToken = pageDetail.access_token ?? null;
      console.log("page_access_token_direct:", pageToken ? "var" : "yok");
    }
  } catch (e) {
    console.log(
      "page_token_fail:",
      e instanceof Error ? e.message.slice(0, 250) : "hata"
    );
  }

  const tokenForMsg = pageToken ?? resolved.accessToken;
  console.log("using_token:", pageToken ? "page" : "user_fallback");

  // Conversations (Instagram platform)
  try {
    const conv = await graphGet<{ data?: Array<{ id?: string }> }>({
      accessToken: tokenForMsg,
      path: `${page.pageId}/conversations`,
      params: { platform: "instagram", limit: 1, fields: "id,updated_time" },
    });
    console.log(
      "\nconversations_instagram: OK",
      `rows=${conv.data?.length ?? 0}`,
      conv.data?.[0]?.id ? `sample_id=${conv.data[0].id}` : ""
    );
  } catch (e) {
    console.log(
      "\nconversations_instagram: FAIL",
      e instanceof Error ? e.message.slice(0, 300) : "hata"
    );
  }

  // IG-side conversations (bazı hesaplarda /{ig-user-id}/conversations)
  const igIdForConv = envIgAccountId();
  if (igIdForConv) {
    try {
      const igConv = await graphGet<{ data?: Array<{ id?: string }> }>({
        accessToken: tokenForMsg,
        path: `${igIdForConv}/conversations`,
        params: { limit: 1, fields: "id,updated_time" },
      });
      console.log(
        "ig_conversations: OK",
        `rows=${igConv.data?.length ?? 0}`,
        igConv.data?.[0]?.id ? `sample_id=${igConv.data[0].id}` : ""
      );
    } catch (e) {
      console.log(
        "ig_conversations: FAIL",
        e instanceof Error ? e.message.slice(0, 300) : "hata"
      );
    }
  }

  const igId = envIgAccountId();
  if (igId) {
    try {
      const ig = await graphGet<{ id?: string; username?: string }>({
        accessToken: tokenForMsg,
        path: igId,
        params: { fields: "id,username" },
      });
      console.log("ig_account:", ig.username, ig.id);
    } catch (e) {
      console.log(
        "ig_account_fail:",
        e instanceof Error ? e.message.slice(0, 200) : "hata"
      );
    }
  }

  const { count: withIg, error: cErr } = await sb
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .not("instagram_user_id", "is", null);

  console.log(
    "\ncontacts_with_instagram_user_id:",
    cErr ? `error=${cErr.message}` : countOrZero(withIg)
  );

  const { data: sample, error: sErr } = await sb
    .from("contacts")
    .select("id,instagram_user_id,username")
    .not("instagram_user_id", "is", null)
    .limit(3);

  if (sErr) {
    console.log("sample_contacts_error:", sErr.message);
  } else if (sample?.length) {
    console.log("sample_contacts:");
    for (const row of sample) {
      console.log(
        "  ",
        row.id.slice(0, 8),
        "ig_len=",
        row.instagram_user_id?.length ?? 0,
        "ig_prefix=",
        row.instagram_user_id?.slice(0, 8) ?? "null",
        "user=",
        row.username ?? "—"
      );
    }
  } else {
    console.log("sample_contacts: yok");
  }

  const hasMsgScope =
    scopes.includes("instagram_manage_messages") ||
    scopes.includes("pages_messaging");

  console.log("\n=== Sonuç ===");
  if (hasMsgScope) {
    console.log(
      "Token'da mesajlaşma scope'u VAR. Meta Messaging API ile DM denenebilir (24s pencere + IGSID gerekir)."
    );
  } else {
    console.log(
      "Token'da mesajlaşma scope'u YOK. Mevcut OAuth sadece ads/insights okuma."
    );
    console.log(
      "DM için: App Review + instagram_manage_messages (+ page token) + yeniden OAuth gerekir."
    );
    console.log(
      "Şu an canlı DM yolu: ChatPlace webhook reply (anlık AI). Gecikmeli follow-up Meta ile gönderilemez."
    );
  }
}

function countOrZero(n: number | null): number {
  return n ?? 0;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
