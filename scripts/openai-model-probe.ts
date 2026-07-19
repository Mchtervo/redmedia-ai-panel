/**
 * OpenAI model router + canlı ping.
 * npx tsx --env-file=.env.local scripts/openai-model-probe.ts
 */
import {
  resolveModelRoute,
  type AiTaskKind,
} from "../src/lib/ai/model-router";
import {
  createRoutedChatCompletion,
  getEmbeddingModel,
  isOpenAiConfigured,
} from "../src/lib/ai/openai-client";

const TASKS: AiTaskKind[] = [
  "dm_reply",
  "classification",
  "extraction",
  "reservation_assist",
  "ceo_intelligence",
  "marketing_strategy",
  "database_analysis",
];

async function main() {
  console.log("=== OpenAI / Model Router Probe ===\n");
  console.log("OPENAI_API_KEY:", isOpenAiConfigured() ? "tanımlı" : "YOK");
  console.log(
    "env FAST:",
    process.env.OPENAI_MODEL_FAST?.trim() || "(boş)"
  );
  console.log(
    "env DEFAULT:",
    process.env.OPENAI_MODEL_DEFAULT?.trim() || "(boş)"
  );
  console.log(
    "env REASONING:",
    process.env.OPENAI_MODEL_REASONING?.trim() || "(boş)"
  );
  console.log(
    "env COMPLEX:",
    process.env.OPENAI_MODEL_COMPLEX?.trim() || "(boş)"
  );
  console.log("env EMBEDDING:", getEmbeddingModel());

  console.log("\n--- Görev → model eşlemesi ---");
  for (const task of TASKS) {
    const route = resolveModelRoute(task);
    console.log(
      `${task.padEnd(22)} → ${route.model}  (tier=${route.tier}, fallback=${route.fallbackModel})`
    );
  }

  if (!isOpenAiConfigured()) {
    console.log("\nAPI key yok — canlı ping atlandı.");
    process.exit(1);
  }

  console.log("\n--- Canlı ping (modeller) ---");
  const modelsToTry = [
    process.env.OPENAI_MODEL_FAST?.trim() || "gpt-5.6-luna",
    process.env.OPENAI_MODEL_DEFAULT?.trim() || "gpt-5.6-terra",
    "gpt-5-mini",
    "gpt-4o-mini",
  ];
  const seen = new Set<string>();
  let anyOk = false;

  for (const model of modelsToTry) {
    if (seen.has(model)) continue;
    seen.add(model);
    process.stdout.write(`ping ${model} ... `);
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!.trim(),
        timeout: 45_000,
      });
      const isLegacy = model.includes("4o") || model.includes("3.5");
      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: "Reply with exactly one word: ok",
          },
        ],
        ...(isLegacy
          ? { max_tokens: 16 }
          : { max_completion_tokens: 16 }),
      });
      const text = completion.choices[0]?.message?.content?.trim() ?? "";
      console.log(
        `OK (used=${completion.model || model}, reply=${JSON.stringify(text.slice(0, 40))})`
      );
      anyOk = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Ham hata — token sızdırma yok; kısa kes
      const short = msg.replace(/sk-[^\s]+/g, "[redacted]").slice(0, 180);
      console.log(`FAIL: ${short}`);
    }
  }

  if (!anyOk) {
    console.log(
      "\nHiçbir model cevap vermedi. API erişimi / model adı / hesap yetkisini kontrol et."
    );
    process.exit(1);
  }
  console.log("\nRouter aktif; en az bir model canlı çalışıyor.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
