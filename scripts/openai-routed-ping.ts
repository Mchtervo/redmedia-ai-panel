/**
 * Router üzerinden canlı DM + CEO ping.
 * npx tsx --env-file=.env.local scripts/openai-routed-ping.ts
 */
import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "../src/lib/ai/openai-client";
import { resolveModelRoute } from "../src/lib/ai/model-router";

async function main() {
  if (!isOpenAiConfigured()) {
    console.error("OPENAI_API_KEY yok");
    process.exit(1);
  }

  for (const task of [
    "dm_reply",
    "extraction",
    "ceo_intelligence",
    "marketing_strategy",
  ] as const) {
    console.log(task, "→", resolveModelRoute(task).model);
  }

  const dm = await createRoutedChatCompletion("dm_reply", {
    messages: [{ role: "user", content: "Tek kelimeyle cevap ver: aktif" }],
    max_tokens: 24,
  });
  console.log(
    "dm_reply OK",
    dm.modelUsed,
    "fallback=",
    dm.usedFallback,
    "text=",
    JSON.stringify((dm.completion.choices[0]?.message?.content ?? "").slice(0, 60))
  );

  const ceo = await createRoutedChatCompletion("ceo_intelligence", {
    messages: [{ role: "user", content: "Tek kelimeyle cevap ver: hazir" }],
    max_tokens: 24,
  });
  console.log(
    "ceo OK",
    ceo.modelUsed,
    "fallback=",
    ceo.usedFallback,
    "text=",
    JSON.stringify((ceo.completion.choices[0]?.message?.content ?? "").slice(0, 60))
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
