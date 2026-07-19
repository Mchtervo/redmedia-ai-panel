/**
 * Tek konuşma öğrenme hatasını yüzeye çıkarır.
 * npx tsx scripts/debug-learning-one.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "@/server/supabase/admin";
import { analyzeConversationForLearning } from "@/features/learning/services/extract-conversation.service";

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

  const { data: rows, error } = await supabase
    .from("conversations")
    .select("id, status, last_message_at, last_learned_at")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(5);

  if (error) throw error;
  console.log(
    "candidates",
    rows?.map((r) => ({
      id: r.id,
      status: r.status,
      last_message_at: r.last_message_at,
      last_learned_at: r.last_learned_at,
    }))
  );

  const id = rows?.[0]?.id;
  if (!id) {
    console.log("no conversation");
    return;
  }

  try {
    const result = await analyzeConversationForLearning(supabase, id, {
      force: true,
    });
    console.log("OK", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("FAIL", e instanceof Error ? e.message : e);
    if (e instanceof Error && e.stack) console.error(e.stack.split("\n").slice(0, 8).join("\n"));
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
