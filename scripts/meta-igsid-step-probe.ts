/**
 * IGSID sync adım adım debug.
 * npx tsx --env-file=.env.local scripts/meta-igsid-step-probe.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { resolveMetaAccessToken } from "../src/features/marketing/services/meta/token.service";
import { resolvePageAccessToken } from "../src/features/marketing/services/meta/page-resolve.service";
import { graphGet } from "../src/features/marketing/services/meta/graph-client";
import { normalizeIgUsername } from "../src/features/marketing/services/meta/meta-igsid-sync.service";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const resolved = await resolveMetaAccessToken(sb);
  if (!resolved) throw new Error("no token");
  const page = await resolvePageAccessToken(resolved.accessToken);
  console.log("page", page.pageId, "ig", page.igBusinessAccountId);

  console.log("step1: list limit=1 fields=id");
  const list = await graphGet<{ data?: Array<{ id?: string }> }>({
    accessToken: page.pageAccessToken,
    path: `${page.pageId}/conversations`,
    params: { platform: "instagram", fields: "id", limit: 1 },
    signal: AbortSignal.timeout(20_000),
  });
  const threadId = list.data?.[0]?.id;
  console.log("thread", threadId ? "ok" : "empty");

  if (!threadId) return;

  console.log("step2: participants");
  const detail = await graphGet<{
    participants?: {
      data?: Array<{ id?: string; username?: string }>;
    };
  }>({
    accessToken: page.pageAccessToken,
    path: threadId,
    params: { fields: "participants" },
    signal: AbortSignal.timeout(20_000),
  });
  console.log("participants", JSON.stringify(detail.participants?.data ?? []));

  const { data: contacts } = await sb
    .from("contacts")
    .select("id,username,meta_igsid")
    .not("username", "is", null)
    .limit(5000);

  const map = new Map(
    (contacts ?? [])
      .map((c) => [normalizeIgUsername(c.username), c] as const)
      .filter(([u]) => Boolean(u))
  );

  let updated = 0;
  for (const p of detail.participants?.data ?? []) {
    const user = normalizeIgUsername(p.username);
    const igsid = p.id?.trim();
    if (!user || !igsid || !/^\d{5,}$/.test(igsid)) continue;
    if (igsid === page.igBusinessAccountId) continue;
    const contact = map.get(user);
    console.log("match?", user, "->", contact ? contact.id.slice(0, 8) : "yok");
    if (!contact || contact.meta_igsid === igsid) continue;
    const { error } = await sb
      .from("contacts")
      .update({ meta_igsid: igsid })
      .eq("id", contact.id);
    console.log("update", user, error?.message ?? "ok");
    if (!error) updated += 1;
  }
  console.log("updated", updated);
}

main().catch((e) => {
  console.error("FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
