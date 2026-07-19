/**
 * Canlı DM yolu (labMode=false) — Mücahit konuşması üzerinde smoke.
 * npx tsx scripts/live-dm-smoke.ts
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
    customerMessage: "Yarın için dış çekim ve video çekimi istiyorum",
    conversationId: "1eb741f7-354e-4899-9e1f-5e3e26da71c3",
    contactId: "2392ea27-1456-441d-a081-db65b6bd3dcf",
    labMode: false,
  });

  console.log({
    model: result?.model,
    generationFailed: result?.generationFailed,
    reply: result?.reply,
  });

  const bad =
    /kaç kişi|ekipman|hangi saatte|kaçta başla/i.test(result?.reply ?? "");
  if (!result || result.generationFailed || bad) {
    console.error("SMOKE FAIL — kötü soru veya üretim hatası");
    process.exit(1);
  }
  console.log("SMOKE OK");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
