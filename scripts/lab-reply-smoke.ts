/**
 * Lab asistan yolunu (katalog + geçmiş) smoke test.
 * npx tsx scripts/lab-reply-smoke.ts
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
  const supabase = createAdminClient();
  const result = await generateSimpleAssistantReply(supabase, {
    customerMessage:
      "düğün yarın dış çekim isityorum foto video albüm seti",
    conversationId: null,
    contactId: null,
    labMode: true,
    historyOverride: [
      { senderType: "customer", content: "merhaba" },
      {
        senderType: "ai",
        content:
          "Merhaba, hayırlı olsun! Düğün mü nişan mı yoksa başka bir etkinlik mi olacak?",
      },
    ],
  });

  if (!result) {
    console.error("NULL — OpenAI/AI_MASTER kapalı olabilir");
    process.exit(1);
  }
  console.log({
    model: result.model,
    generationFailed: result.generationFailed ?? false,
    errorMessage: result.errorMessage,
    reply: result.reply,
  });
  if (result.generationFailed) process.exit(1);
  if (result.reply.includes("Mesajınızı aldık")) {
    console.error("FALLBACK hâlâ geliyor");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
