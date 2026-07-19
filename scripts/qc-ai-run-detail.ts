/**
 * npx tsx scripts/qc-ai-run-detail.ts
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
  const ids = [
    "d7861079-ab27-4d46-8d7c-850c21165eed",
    "c5a6e285-8488-4d6f-ac31-532161ba39ea",
  ];
  const { data, error } = await sb
    .from("ai_runs")
    .select("id, model, status, created_at, result")
    .in("id", ids);
  if (error) throw error;
  for (const r of data ?? []) {
    const result = (r.result ?? {}) as Record<string, unknown>;
    const input = (result.input ?? {}) as Record<string, unknown>;
    const output = (result.output ?? {}) as Record<string, unknown>;
    const brain = (input.salesBrain ?? {}) as Record<string, unknown>;
    const dp = (input.decisionPack ?? {}) as Record<string, unknown>;
    const tmpl = (input.template ?? {}) as Record<string, unknown>;
    console.log(
      JSON.stringify(
        {
          id: r.id,
          model: r.model,
          created_at: r.created_at,
          engine: input.engine,
          inbound: input.customerMessage,
          persona: brain.persona,
          stage: brain.state,
          objective: brain.objective,
          nba: brain.nextBestAction,
          strategyId: dp.strategyId,
          allowPrice: dp.allowPrice,
          template: tmpl,
          strategy: input.conversationStrategy,
          reply: output.reply,
        },
        null,
        2
      )
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
