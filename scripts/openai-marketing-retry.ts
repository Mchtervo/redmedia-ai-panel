import { createRoutedChatCompletion } from "../src/lib/ai/openai-client";

async function main() {
  for (let i = 1; i <= 2; i += 1) {
    try {
      const r = await createRoutedChatCompletion("marketing_strategy", {
        messages: [
          { role: "user", content: "Reply with exactly one word: OK" },
        ],
        max_tokens: 32,
      });
      console.log(
        "try",
        i,
        "OK",
        r.modelUsed,
        JSON.stringify(
          (r.completion.choices[0]?.message?.content ?? "").slice(0, 40)
        )
      );
    } catch (e) {
      console.log("try", i, "FAIL", e instanceof Error ? e.message : e);
    }
  }
}

main();
