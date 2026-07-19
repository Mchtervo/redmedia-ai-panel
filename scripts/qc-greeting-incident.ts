/**
 * Acil: son Merhabalar / 12.000 AI cevap log özeti
 * npx tsx scripts/qc-greeting-incident.ts
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
  const { data: aiMsgs, error } = await sb
    .from("messages")
    .select(
      "id, conversation_id, content, sender_type, created_at, external_message_id, source"
    )
    .eq("sender_type", "ai")
    .ilike("content", "%12.000%")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  console.log("AI_12K_COUNT", aiMsgs?.length ?? 0);
  for (const m of aiMsgs ?? []) {
    console.log("---");
    console.log({
      conversationId: m.conversation_id,
      aiMessageId: m.id,
      created_at: m.created_at,
      source: m.source,
      preview: (m.content ?? "").slice(0, 160),
    });
    const { data: runs } = await sb
      .from("ai_runs")
      .select("id, model, status, created_at, result")
      .eq("conversation_id", m.conversation_id)
      .order("created_at", { ascending: false })
      .limit(2);
    for (const r of runs ?? []) {
      const result = r.result as Record<string, unknown> | null;
      const input = (result?.input ?? {}) as Record<string, unknown>;
      const output = (result?.output ?? {}) as Record<string, unknown>;
      const dp = input.decisionPack as Record<string, unknown> | null;
      const tmpl = input.template as Record<string, unknown> | null;
      console.log({
        aiRunId: r.id,
        model: r.model,
        status: r.status,
        engine: input.engine,
        strategyId: dp?.strategyId ?? tmpl?.strategyId,
        allowPrice: dp?.allowPrice,
        usedFallback: tmpl?.usedFallback,
        replyPreview: String(output.reply ?? "").slice(0, 120),
      });
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
