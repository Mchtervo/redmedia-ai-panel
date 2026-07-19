/**
 * Instagram conversations kaynak sayımı (salt okuma).
 * npx tsx --env-file=.env.local scripts/qc-ig-conversation-sources.ts
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY gerekli.");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { count: total, error: e1 } = await sb
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("channel", "instagram");
  if (e1) throw e1;

  const { count: withExt, error: e2 } = await sb
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("channel", "instagram")
    .not("external_conversation_id", "is", null);
  if (e2) throw e2;

  const { count: nullExt, error: e3 } = await sb
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("channel", "instagram")
    .is("external_conversation_id", null);
  if (e3) throw e3;

  const { data: igConvs, error: e4 } = await sb
    .from("conversations")
    .select("id, created_at, external_conversation_id, last_message_at, contact_id")
    .eq("channel", "instagram")
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (e4) throw e4;

  const ids = (igConvs ?? []).map((c) => c.id);
  const chatplaceMcp = new Set<string>();
  const webhookish = new Set<string>();
  const messageCount = new Map<string, number>();
  const primarySource = new Map<string, string>();

  const CHUNK = 80;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data: msgs, error } = await sb
      .from("messages")
      .select("conversation_id, raw_payload")
      .in("conversation_id", chunk);
    if (error) throw error;

    for (const m of msgs ?? []) {
      messageCount.set(
        m.conversation_id,
        (messageCount.get(m.conversation_id) ?? 0) + 1
      );
      const p = m.raw_payload as Record<string, unknown> | null;
      if (!p || typeof p !== "object") continue;

      const source = typeof p.source === "string" ? p.source : null;
      if (source === "chatplace_mcp") {
        chatplaceMcp.add(m.conversation_id);
        if (!primarySource.has(m.conversation_id)) {
          primarySource.set(m.conversation_id, "chatplace_mcp");
        }
      }

      const blob = JSON.stringify(p);
      const isWebhook =
        source === "chatplace_webhook" ||
        source === "webhook" ||
        /chatplace_webhook|"provider"\s*:\s*"chatplace"/i.test(blob) ||
        (typeof p.provider === "string" && p.provider === "chatplace");

      if (isWebhook && source !== "chatplace_mcp") {
        webhookish.add(m.conversation_id);
        if (!primarySource.has(m.conversation_id)) {
          primarySource.set(m.conversation_id, source ?? "chatplace_webhook");
        }
      }

      if (source && !primarySource.has(m.conversation_id)) {
        primarySource.set(m.conversation_id, source);
      }
      if (
        typeof p.delivery === "string" &&
        !primarySource.has(m.conversation_id)
      ) {
        primarySource.set(m.conversation_id, `delivery:${p.delivery}`);
      }
    }
  }

  // Seed/demo: seed script "Demo Müşteri" isimleri kullanır
  const contactIds = [
    ...new Set((igConvs ?? []).map((c) => c.contact_id).filter(Boolean)),
  ] as string[];
  const demoContactIds = new Set<string>();
  for (let i = 0; i < contactIds.length; i += CHUNK) {
    const chunk = contactIds.slice(i, i + CHUNK);
    const { data: contacts, error } = await sb
      .from("contacts")
      .select("id, full_name, username")
      .in("id", chunk);
    if (error) throw error;
    for (const c of contacts ?? []) {
      const name = `${c.full_name ?? ""} ${c.username ?? ""}`.toLocaleLowerCase(
        "tr-TR"
      );
      if (
        name.includes("demo") ||
        name.includes("seed") ||
        name.includes("test müşteri") ||
        name.includes("test musteri")
      ) {
        demoContactIds.add(c.id);
      }
    }
  }

  const seedByDemoContact = (igConvs ?? []).filter((c) =>
    c.contact_id ? demoContactIds.has(c.contact_id) : false
  ).length;

  // Seed adayı: null external VE chatplace_mcp/webhook yok
  const seedCandidates = (igConvs ?? []).filter((c) => {
    const hasCp =
      chatplaceMcp.has(c.id) || webhookish.has(c.id);
    return !c.external_conversation_id && !hasCp;
  }).length;

  const mcpOrWebhook = new Set([...chatplaceMcp, ...webhookish]);

  const last10 = (igConvs ?? []).slice(0, 10).map((c) => {
    let source = primarySource.get(c.id);
    if (!source) {
      source = c.external_conversation_id
        ? "external_id_var_payload_yok"
        : "no_external_id";
    }
    return {
      created_at: c.created_at,
      external_prefix: c.external_conversation_id
        ? String(c.external_conversation_id).slice(0, 6)
        : null,
      source,
      message_count: messageCount.get(c.id) ?? 0,
    };
  });

  console.log(
    JSON.stringify(
      {
        total_instagram: total ?? 0,
        with_external_conversation_id: withExt ?? 0,
        null_external_conversation_id: nullExt ?? 0,
        with_chatplace_mcp_source: chatplaceMcp.size,
        with_webhook_source: webhookish.size,
        with_chatplace_mcp_or_webhook: mcpOrWebhook.size,
        seed_demo_by_contact_name: seedByDemoContact,
        seed_candidates_null_external_and_no_chatplace: seedCandidates,
        last10,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
