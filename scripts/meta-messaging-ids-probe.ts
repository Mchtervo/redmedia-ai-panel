/**
 * Meta conversation participants + DB IGSID kalitesi.
 * npx tsx --env-file=.env.local scripts/meta-messaging-ids-probe.ts
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
    params: { fields: "id,access_token", limit: 25 },
  });
  const pageToken = accounts.data?.find((a) => a.id === page.pageId)
    ?.access_token;
  if (!pageToken) throw new Error("no page token");

  console.log("=== Meta conversations (participants) ===");
  try {
    const conv = await graphGet<{
      data?: Array<{
        id?: string;
        updated_time?: string;
        message_count?: number;
        participants?: {
          data?: Array<{ id?: string; username?: string; name?: string }>;
        };
      }>;
    }>({
      accessToken: pageToken,
      path: `${page.pageId}/conversations`,
      params: {
        platform: "instagram",
        limit: 2,
        fields: "id,updated_time,participants",
      },
      signal: AbortSignal.timeout(20_000),
    });

    for (const c of conv.data ?? []) {
      console.log("thread:", (c.id ?? "").slice(0, 48) + "...");
      console.log("  updated:", c.updated_time);
      for (const p of c.participants?.data ?? []) {
        console.log(
          "  participant:",
          "id=",
          p.id,
          "user=",
          p.username ?? p.name ?? "—"
        );
      }
    }
  } catch (e) {
    console.log(
      "conversations_fail:",
      e instanceof Error ? e.message.slice(0, 300) : "hata"
    );
  }

  const { count: total } = await sb
    .from("contacts")
    .select("id", { count: "exact", head: true });
  const { count: withIg } = await sb
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .not("instagram_user_id", "is", null);
  const { count: demo } = await sb
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .like("instagram_user_id", "demo_%");

  const { data: allIg } = await sb
    .from("contacts")
    .select("instagram_user_id")
    .not("instagram_user_id", "is", null)
    .limit(5000);

  let numeric = 0;
  let other = 0;
  for (const row of allIg ?? []) {
    const v = row.instagram_user_id ?? "";
    if (/^\d{5,}$/.test(v)) numeric += 1;
    else if (!v.startsWith("demo_")) other += 1;
  }

  console.log("\n=== DB contacts IGSID ===");
  console.log({
    total,
    withIg,
    demo,
    numericIgsid: numeric,
    otherNonDemo: other,
  });

  const { data: realSample } = await sb
    .from("contacts")
    .select("id,instagram_user_id,username")
    .not("instagram_user_id", "is", null)
    .not("instagram_user_id", "like", "demo_%")
    .limit(8);

  console.log("non_demo_sample:");
  for (const row of realSample ?? []) {
    console.log(
      " ",
      row.instagram_user_id,
      "user=",
      row.username ?? "—",
      "numeric=",
      /^\d+$/.test(row.instagram_user_id ?? "")
    );
  }

  const { data: cpSample } = await sb
    .from("conversations")
    .select("id,contact_id,external_conversation_id,channel,status")
    .not("external_conversation_id", "is", null)
    .limit(5);
  console.log("\nconversation_sample:");
  for (const row of cpSample ?? []) {
    console.log(
      " ",
      "ext=",
      row.external_conversation_id,
      "ch=",
      row.channel,
      "st=",
      row.status
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
