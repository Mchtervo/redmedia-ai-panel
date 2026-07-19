/**
 * chatplace_mcp kaynağı olmayan Instagram konuşmalarını tek tek açıkla.
 * npx tsx --env-file=.env.local scripts/qc-ig-no-mcp-source.ts
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("env eksik");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

type Reason =
  | "eski_kayit_veya_migration_oncesi"
  | "webhook_payload_source_yok"
  | "meta_outbound_delivery"
  | "manuel_veya_test_external_id"
  | "eksik_payload"
  | "karisik_hata"
  | "bilinmiyor";

function classify(params: {
  externalId: string | null;
  createdAt: string;
  sources: string[];
  deliveries: string[];
  providers: string[];
  payloadKeys: string[];
  messageCount: number;
  hasNullPayload: boolean;
  samplePayload: unknown;
}): { reason: Reason; detail: string } {
  const ext = params.externalId ?? "";
  const testLike =
    /^(ai-|c-c|test|demo)/i.test(ext) ||
    ext.includes("{{") ||
    ext.includes(" ") ||
    /dup|tes/i.test(ext);

  if (testLike) {
    return {
      reason: "manuel_veya_test_external_id",
      detail: `external_conversation_id test/probe benzeri: "${ext.slice(0, 24)}"`,
    };
  }

  if (params.deliveries.includes("meta_messaging")) {
    return {
      reason: "meta_outbound_delivery",
      detail:
        "Mesajlarda source yok; raw_payload.delivery=meta_messaging (panelden Meta gönderim izi).",
    };
  }

  if (params.deliveries.includes("db_only")) {
    return {
      reason: "eksik_payload",
      detail:
        "delivery=db_only — DB'ye yazılmış outbound; ChatPlace MCP sync source'u yok.",
    };
  }

  if (
    params.providers.includes("chatplace") ||
    params.sources.some((s) => /webhook/i.test(s))
  ) {
    return {
      reason: "webhook_payload_source_yok",
      detail: "Webhook/provider izi var ama source=chatplace_mcp set edilmemiş.",
    };
  }

  if (params.hasNullPayload || params.payloadKeys.length === 0) {
    // created before chatplace_mcp tagging became standard?
    const created = new Date(params.createdAt).getTime();
    const mcpEra = new Date("2026-07-18T00:00:00Z").getTime(); // sync feature recent in repo
    if (created < mcpEra) {
      return {
        reason: "eski_kayit_veya_migration_oncesi",
        detail:
          "raw_payload boş/null veya source alanı yok; kayıt MCP source standardından önce veya farklı ingest.",
      };
    }
    return {
      reason: "eksik_payload",
      detail: "raw_payload null/boş veya source alanı hiç yazılmamış.",
    };
  }

  if (params.sources.length > 0 && !params.sources.includes("chatplace_mcp")) {
    return {
      reason: "eksik_payload",
      detail: `source var ama chatplace_mcp değil: ${params.sources.join(",")}`,
    };
  }

  // Has payload keys but no source
  if (params.payloadKeys.length > 0) {
    return {
      reason: "eksik_payload",
      detail: `payload anahtarları: ${params.payloadKeys.slice(0, 8).join(", ")} — source yok.`,
    };
  }

  return { reason: "bilinmiyor", detail: "Sınıflandırılamadı." };
}

async function main() {
  const { data: igConvs, error } = await sb
    .from("conversations")
    .select(
      "id, created_at, updated_at, external_conversation_id, last_message_at, status, contact_id"
    )
    .eq("channel", "instagram")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const ids = (igConvs ?? []).map((c) => c.id);
  const mcpSet = new Set<string>();
  const msgMeta = new Map<
    string,
    {
      count: number;
      sources: Set<string>;
      deliveries: Set<string>;
      providers: Set<string>;
      payloadKeys: Set<string>;
      hasNullPayload: boolean;
      samplePayload: unknown;
      senderTypes: Set<string>;
      minCreated: string | null;
      maxCreated: string | null;
    }
  >();

  const CHUNK = 80;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data: msgs, error: me } = await sb
      .from("messages")
      .select(
        "conversation_id, raw_payload, sender_type, created_at, external_message_id, direction"
      )
      .in("conversation_id", chunk);
    if (me) throw me;

    for (const m of msgs ?? []) {
      if (!msgMeta.has(m.conversation_id)) {
        msgMeta.set(m.conversation_id, {
          count: 0,
          sources: new Set(),
          deliveries: new Set(),
          providers: new Set(),
          payloadKeys: new Set(),
          hasNullPayload: false,
          samplePayload: null,
          senderTypes: new Set(),
          minCreated: null,
          maxCreated: null,
        });
      }
      const meta = msgMeta.get(m.conversation_id)!;
      meta.count += 1;
      meta.senderTypes.add(m.sender_type);
      if (
        !meta.minCreated ||
        m.created_at < meta.minCreated
      ) {
        meta.minCreated = m.created_at;
      }
      if (!meta.maxCreated || m.created_at > meta.maxCreated) {
        meta.maxCreated = m.created_at;
      }

      const p = m.raw_payload as Record<string, unknown> | null;
      if (!p) {
        meta.hasNullPayload = true;
        continue;
      }
      for (const k of Object.keys(p)) meta.payloadKeys.add(k);
      if (typeof p.source === "string") {
        meta.sources.add(p.source);
        if (p.source === "chatplace_mcp") mcpSet.add(m.conversation_id);
      }
      if (typeof p.delivery === "string") meta.deliveries.add(p.delivery);
      if (typeof p.provider === "string") meta.providers.add(p.provider);
      if (!meta.samplePayload) meta.samplePayload = p;
    }
  }

  const noMcp = (igConvs ?? []).filter((c) => !mcpSet.has(c.id));

  // contact names for demo detection (masked)
  const contactIds = [
    ...new Set(noMcp.map((c) => c.contact_id).filter(Boolean)),
  ] as string[];
  const contactLabel = new Map<string, string>();
  for (let i = 0; i < contactIds.length; i += CHUNK) {
    const chunk = contactIds.slice(i, i + CHUNK);
    const { data: contacts } = await sb
      .from("contacts")
      .select("id, full_name, username, instagram_user_id")
      .in("id", chunk);
    for (const c of contacts ?? []) {
      const name = `${c.full_name ?? ""} ${c.username ?? ""}`.toLocaleLowerCase(
        "tr-TR"
      );
      let label = "normal";
      if (/demo|seed|test/.test(name)) label = "demo_contact";
      else if (c.instagram_user_id) label = "has_ig_user_id";
      contactLabel.set(c.id, label);
    }
  }

  const rows = noMcp.map((c, idx) => {
    const meta = msgMeta.get(c.id) ?? {
      count: 0,
      sources: new Set<string>(),
      deliveries: new Set<string>(),
      providers: new Set<string>(),
      payloadKeys: new Set<string>(),
      hasNullPayload: true,
      samplePayload: null,
      senderTypes: new Set<string>(),
      minCreated: null,
      maxCreated: null,
    };

    const classified = classify({
      externalId: c.external_conversation_id,
      createdAt: c.created_at,
      sources: [...meta.sources],
      deliveries: [...meta.deliveries],
      providers: [...meta.providers],
      payloadKeys: [...meta.payloadKeys],
      messageCount: meta.count,
      hasNullPayload: meta.hasNullPayload,
      samplePayload: meta.samplePayload,
    });

    return {
      n: idx + 1,
      conversation_id_prefix: c.id.slice(0, 8),
      created_at: c.created_at,
      external_prefix: c.external_conversation_id
        ? String(c.external_conversation_id).slice(0, 10)
        : null,
      status: c.status,
      message_count: meta.count,
      sender_types: [...meta.senderTypes].sort().join(","),
      payload_sources: [...meta.sources].join(",") || "(yok)",
      deliveries: [...meta.deliveries].join(",") || "(yok)",
      payload_keys: [...meta.payloadKeys].slice(0, 10).join(",") || "(yok)",
      null_payload_var: meta.hasNullPayload,
      contact: c.contact_id
        ? (contactLabel.get(c.contact_id) ?? "unknown")
        : "none",
      reason: classified.reason,
      detail: classified.detail,
      sample_payload_preview: meta.samplePayload
        ? JSON.stringify(meta.samplePayload).slice(0, 120)
        : null,
    };
  });

  const reasonCounts: Record<string, number> = {};
  for (const r of rows) {
    reasonCounts[r.reason] = (reasonCounts[r.reason] ?? 0) + 1;
  }

  console.log(
    JSON.stringify(
      {
        no_mcp_count: rows.length,
        reason_counts: reasonCounts,
        rows,
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
