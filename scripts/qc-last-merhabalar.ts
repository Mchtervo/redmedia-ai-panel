/**
 * Son Merhabalar inbound + webhook + ai_run kanıtı
 * npx tsx scripts/qc-last-merhabalar.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "@/server/supabase/admin";

function loadEnv(): void {
  const raw = readFileSync(resolve(".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k && !(k in process.env)) process.env[k] = v;
  }
}

async function main(): Promise<void> {
  loadEnv();
  const sb = createAdminClient();

  const { data: inbound, error } = await sb
    .from("messages")
    .select(
      "id, conversation_id, content, sender_type, created_at, source, external_message_id, direction"
    )
    .eq("sender_type", "customer")
    .ilike("content", "%Merhaba%")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;

  console.log("INBOUND_MERHABA", JSON.stringify(inbound, null, 2));

  for (const m of inbound ?? []) {
    const since = new Date(
      new Date(m.created_at).getTime() - 60_000
    ).toISOString();
    const until = new Date(
      new Date(m.created_at).getTime() + 120_000
    ).toISOString();

    const { data: runs } = await sb
      .from("ai_runs")
      .select("id, model, status, created_at, result, task_type")
      .eq("conversation_id", m.conversation_id)
      .gte("created_at", since)
      .lte("created_at", until)
      .order("created_at", { ascending: false });

    const { data: outs } = await sb
      .from("messages")
      .select("id, content, sender_type, source, created_at")
      .eq("conversation_id", m.conversation_id)
      .eq("sender_type", "ai")
      .gte("created_at", since)
      .lte("created_at", until)
      .order("created_at", { ascending: true });

    console.log("\n--- for inbound", m.id, "---");
    console.log({
      conversationId: m.conversation_id,
      inboundMessageId: m.id,
      inboundSource: m.source,
      inboundAt: m.created_at,
      content: m.content,
    });
    console.log(
      "AI_RUNS_IN_WINDOW",
      JSON.stringify(
        (runs ?? []).map((r) => {
          const result = r.result as Record<string, unknown> | null;
          const input = (result?.input ?? {}) as Record<string, unknown>;
          const output = (result?.output ?? {}) as Record<string, unknown>;
          const dp = input.decisionPack as Record<string, unknown> | undefined;
          const tmpl = input.template as Record<string, unknown> | undefined;
          return {
            id: r.id,
            model: r.model,
            status: r.status,
            created_at: r.created_at,
            engine: input.engine ?? null,
            strategyId: dp?.strategyId ?? tmpl?.strategyId ?? null,
            allowPrice: dp?.allowPrice ?? null,
            replyPreview: String(output.reply ?? "").slice(0, 100),
            error: result?.error ?? null,
          };
        }),
        null,
        2
      )
    );
    console.log(
      "AI_OUT_IN_WINDOW",
      JSON.stringify(
        (outs ?? []).map((o) => ({
          id: o.id,
          source: o.source,
          created_at: o.created_at,
          preview: (o.content ?? "").slice(0, 120),
        })),
        null,
        2
      )
    );
  }

  const { data: wh } = await sb
    .from("webhook_events")
    .select("id, status, source, event_type, created_at, error_message")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log("\nLAST_WEBHOOK_EVENTS", JSON.stringify(wh, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
