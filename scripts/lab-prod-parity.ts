/**
 * Lab zinciri — 5 senaryo (Instagram gönderimi YOK).
 * npx tsx scripts/lab-prod-parity.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "@/server/supabase/admin";
import { generateSimpleAssistantReply } from "@/features/ai/services/simple-assistant.service";

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
  process.env.AI_REPLY_ENABLED = "false";
  process.env.AI_AUTO_REPLY_ENABLED = "false";

  const cases = [
    "Merhaba",
    "Tamam",
    "Yarın",
    "Eşime soracağım",
    "Fiyat ne kadar?",
  ] as const;

  const sb = createAdminClient();
  let history: { senderType: "customer" | "ai"; content: string }[] = [];

  console.log("LOCAL_HEAD", process.env.VERCEL_GIT_COMMIT_SHA ?? "(local)");
  console.log("STRATEGIST_DEFAULT", "on unless AI_CONVERSATION_STRATEGIST_ENABLED=false");

  for (const msg of cases) {
    const r = await generateSimpleAssistantReply(sb, {
      customerMessage: msg,
      labMode: true,
      historyOverride: history,
      skipConversationCritic: true,
    });
    const reply = r?.reply ?? "(null)";
    console.log(
      JSON.stringify(
        {
          input: msg,
          strategyId: r?.decisionPack?.strategyId ?? null,
          persona: r?.salesBrain?.persona ?? null,
          stage: r?.salesBrain?.state ?? null,
          nba: r?.salesBrain?.nextBestAction ?? null,
          model: r?.model ?? null,
          reply,
        },
        null,
        0
      )
    );
    history = [
      ...history,
      { senderType: "customer", content: msg },
      ...(reply !== "(null)"
        ? [{ senderType: "ai" as const, content: reply }]
        : []),
    ];
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
