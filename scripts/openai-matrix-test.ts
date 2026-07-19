/**
 * Tüm env model katmanlarını canlı test eder.
 * npx tsx --env-file=.env.local scripts/openai-matrix-test.ts
 */
import OpenAI from "openai";
import {
  createRoutedChatCompletion,
  createEmbeddings,
  getEmbeddingModel,
  isOpenAiConfigured,
} from "../src/lib/ai/openai-client";
import {
  resolveModelRoute,
  type AiTaskKind,
} from "../src/lib/ai/model-router";

type Row = {
  tier: string;
  env: string;
  model: string;
  via: string;
  ok: boolean;
  detail: string;
};

async function pingModel(
  client: OpenAI,
  model: string
): Promise<{ ok: boolean; detail: string }> {
  try {
    const isLegacy = /gpt-4o|gpt-3\.5|text-davinci/i.test(model);
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "user", content: "Reply with exactly one word: OK" },
      ],
      ...(isLegacy
        ? { max_tokens: 16 }
        : { max_completion_tokens: 32 }),
    });
    const text = (completion.choices[0]?.message?.content ?? "")
      .trim()
      .slice(0, 40);
    const used = completion.model || model;
    return {
      ok: true,
      detail: `used=${used}${text ? `; reply=${JSON.stringify(text)}` : ""}`,
    };
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e))
      .replace(/sk-[^\s]+/g, "[redacted]")
      .slice(0, 160);
    return { ok: false, detail: msg };
  }
}

async function main() {
  console.log("=== Model matrisi canlı test ===\n");
  if (!isOpenAiConfigured()) {
    console.error("OPENAI_API_KEY yok");
    process.exit(1);
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!.trim(),
    timeout: 60_000,
  });

  const envModels: Array<{ tier: string; env: string; model: string }> = [
    {
      tier: "FAST",
      env: "OPENAI_MODEL_FAST",
      model: process.env.OPENAI_MODEL_FAST?.trim() || "",
    },
    {
      tier: "DEFAULT",
      env: "OPENAI_MODEL_DEFAULT",
      model: process.env.OPENAI_MODEL_DEFAULT?.trim() || "",
    },
    {
      tier: "REASONING",
      env: "OPENAI_MODEL_REASONING",
      model: process.env.OPENAI_MODEL_REASONING?.trim() || "",
    },
    {
      tier: "COMPLEX",
      env: "OPENAI_MODEL_COMPLEX",
      model: process.env.OPENAI_MODEL_COMPLEX?.trim() || "",
    },
    {
      tier: "EMBEDDING",
      env: "OPENAI_MODEL_EMBEDDING",
      model: getEmbeddingModel(),
    },
  ];

  const rows: Row[] = [];

  for (const item of envModels) {
    if (!item.model) {
      rows.push({
        tier: item.tier,
        env: item.env,
        model: "(boş)",
        via: "env",
        ok: false,
        detail: "env boş",
      });
      continue;
    }

    if (item.tier === "EMBEDDING") {
      process.stdout.write(`EMBEDDING ${item.model} ... `);
      try {
        const vectors = await createEmbeddings(["redmedia test embedding"]);
        const dim = vectors[0]?.length ?? 0;
        const ok = dim > 0;
        console.log(ok ? `OK dim=${dim}` : "FAIL empty");
        rows.push({
          tier: item.tier,
          env: item.env,
          model: item.model,
          via: "embeddings",
          ok,
          detail: ok ? `dimensions=${dim}` : "boş vektör",
        });
      } catch (e) {
        const msg = (e instanceof Error ? e.message : String(e)).slice(0, 160);
        console.log("FAIL", msg);
        rows.push({
          tier: item.tier,
          env: item.env,
          model: item.model,
          via: "embeddings",
          ok: false,
          detail: msg,
        });
      }
      continue;
    }

    process.stdout.write(`${item.tier} ${item.model} ... `);
    const result = await pingModel(client, item.model);
    console.log(result.ok ? `OK ${result.detail}` : `FAIL ${result.detail}`);
    rows.push({
      tier: item.tier,
      env: item.env,
      model: item.model,
      via: "chat.completions",
      ok: result.ok,
      detail: result.detail,
    });
  }

  console.log("\n--- Router görev eşlemesi + canlı çağrı ---");
  const tasks: Array<{ task: AiTaskKind; label: string }> = [
    { task: "dm_reply", label: "DM (FAST)" },
    { task: "extraction", label: "Öğrenme (DEFAULT)" },
    { task: "ceo_intelligence", label: "CEO (REASONING)" },
    { task: "marketing_strategy", label: "Marketing (REASONING)" },
    { task: "database_analysis", label: "Complex" },
  ];

  for (const { task, label } of tasks) {
    const route = resolveModelRoute(task);
    process.stdout.write(`${label} → ${route.model} ... `);
    try {
      const r = await createRoutedChatCompletion(task, {
        messages: [
          {
            role: "user",
            content: "Reply with exactly one word: OK",
          },
        ],
        max_tokens: 32,
      });
      const text = (r.completion.choices[0]?.message?.content ?? "")
        .trim()
        .slice(0, 40);
      console.log(
        `OK used=${r.modelUsed} fallback=${r.usedFallback}${
          text ? ` reply=${JSON.stringify(text)}` : ""
        }`
      );
      rows.push({
        tier: label,
        env: "router",
        model: route.model,
        via: `createRoutedChatCompletion(${task})`,
        ok: true,
        detail: `used=${r.modelUsed}; fallback=${r.usedFallback}`,
      });
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 160);
      console.log("FAIL", msg);
      rows.push({
        tier: label,
        env: "router",
        model: route.model,
        via: `createRoutedChatCompletion(${task})`,
        ok: false,
        detail: msg,
      });
    }
  }

  const passed = rows.filter((r) => r.ok).length;
  const failed = rows.filter((r) => !r.ok).length;
  console.log("\n=== Özet ===");
  console.log(`geçti=${passed}  kaldı=${failed}`);
  for (const r of rows) {
    console.log(
      `${r.ok ? "OK " : "NO "} | ${r.tier.padEnd(22)} | ${r.model.padEnd(28)} | ${r.detail}`
    );
  }

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
