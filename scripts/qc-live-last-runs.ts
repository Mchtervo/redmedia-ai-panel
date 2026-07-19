/**
 * Son canlı müşteri mesajları + ai_runs kanıtı
 * npx tsx scripts/qc-live-last-runs.ts
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
  const { data: customers } = await sb
    .from("messages")
    .select("id, conversation_id, content, created_at, source")
    .eq("sender_type", "customer")
    .order("created_at", { ascending: false })
    .limit(12);

  console.log("LOCAL_COMMIT", process.env.VERCEL_GIT_COMMIT_SHA ?? "(local)");
  console.log("CUSTOMER_MSGS", JSON.stringify(customers, null, 2));

  for (const m of customers ?? []) {
    const t = (m.content ?? "").trim();
    if (!/^(tamam|yarın|yarin|merhaba|merhabalar|eşime|esime|fiyat)/i.test(t)) {
      continue;
    }
    const since = new Date(new Date(m.created_at).getTime() - 5_000).toISOString();
    const until = new Date(new Date(m.created_at).getTime() + 180_000).toISOString();
    const { data: runs } = await sb
      .from("ai_runs")
      .select("id, model, status, created_at, result, task_type")
      .eq("conversation_id", m.conversation_id)
      .gte("created_at", since)
      .lte("created_at", until)
      .order("created_at", { ascending: false })
      .limit(3);

    const { data: aiOut } = await sb
      .from("messages")
      .select("id, content, source, created_at")
      .eq("conversation_id", m.conversation_id)
      .eq("sender_type", "ai")
      .gte("created_at", since)
      .lte("created_at", until)
      .order("created_at", { ascending: true })
      .limit(3);

    console.log("\n==== INBOUND ====", t);
    console.log({
      inboundId: m.id,
      conversationId: m.conversation_id,
      source: m.source,
      at: m.created_at,
    });
    for (const r of runs ?? []) {
      const result = (r.result ?? {}) as Record<string, unknown>;
      const input = (result.input ?? {}) as Record<string, unknown>;
      const output = (result.output ?? {}) as Record<string, unknown>;
      const brain = (input.salesBrain ?? {}) as Record<string, unknown>;
      const dp = (input.decisionPack ?? {}) as Record<string, unknown>;
      const analysis = (dp.analysis ?? {}) as Record<string, unknown>;
      const tmpl = (input.template ?? {}) as Record<string, unknown>;
      console.log("AI_RUN", {
        id: r.id,
        model: r.model,
        status: r.status,
        created_at: r.created_at,
        engine: input.engine ?? null,
        buildCommit: input.buildCommit ?? result.buildCommit ?? null,
        persona: brain.persona ?? analysis.personaLabel ?? null,
        stage: brain.state ?? analysis.stageLabel ?? null,
        objective: brain.objective ?? null,
        nba: brain.nextBestAction ?? null,
        strategyId: dp.strategyId ?? tmpl.strategyId ?? null,
        templateMeta: tmpl,
        allowPrice: dp.allowPrice ?? null,
        reply: String(output.reply ?? "").slice(0, 220),
        error: result.error ?? null,
      });
    }
    console.log(
      "AI_OUT",
      (aiOut ?? []).map((a) => ({
        source: a.source,
        at: a.created_at,
        preview: (a.content ?? "").slice(0, 180),
      }))
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
