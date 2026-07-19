/**
 * Lab doğrulama — Instagram gönderimi YOK.
 * npx tsx scripts/lab-greeting-verify.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "@/server/supabase/admin";
import { generateSimpleAssistantReply } from "@/features/ai/services/simple-assistant.service";
import { apiSuccess } from "@/types/api";

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

/** ChatPlace'in gördüğü HTTP zarfı (route.ts ile aynı şekil). */
function toChatPlaceResponseJson(reply: string | undefined) {
  return apiSuccess({
    outcome: "processed",
    webhookEventId: "lab-verify",
    ...(reply ? { reply } : {}),
  });
}

async function runCase(
  label: string,
  customerMessage: string,
  history: { senderType: "customer" | "ai"; content: string }[] = []
) {
  const sb = createAdminClient();
  const result = await generateSimpleAssistantReply(sb, {
    customerMessage,
    labMode: true,
    historyOverride: history,
    skipConversationCritic: true,
  });

  const reply = result?.reply;
  const responseJson = toChatPlaceResponseJson(reply);
  const mappedAiReply =
    responseJson.success && "data" in responseJson
      ? (responseJson.data as { reply?: string }).reply
      : undefined;

  console.log("\n==========", label, "==========");
  console.log("backend_received:", customerMessage);
  console.log("response_JSON:", JSON.stringify(responseJson, null, 2));
  console.log("ChatPlace_map_target: data.reply → değişken aiReply");
  console.log("mapped_aiReply:", mappedAiReply ?? "(alan yok — eşleme eski değeri KORUYABİLİR)");
  console.log("final_reply:", reply ?? "(yok)");
  console.log("meta:", {
    model: result?.model,
    strategyId: result?.decisionPack?.strategyId,
    allowPrice: result?.decisionPack?.allowPrice,
    move: result?.decisionPack?.move,
    generationFailed: result?.generationFailed,
  });

  return { reply, responseJson, mappedAiReply, result };
}

async function main(): Promise<void> {
  loadEnv();
  // Lab OpenAI kullanır; canlı AI_REPLY kapalı kalsın
  process.env.AI_REPLY_ENABLED = "false";
  process.env.AI_AUTO_REPLY_ENABLED = "false";

  const t1 = await runCase("1) Merhaba", "Merhaba");
  const t2 = await runCase("2) Ne diyorsun aga", "Ne diyorsun aga");
  const t3 = await runCase("3) Dış çekim fiyatı nedir?", "Dış çekim fiyatı nedir?");

  // Stale değişken simülasyonu: API reply dönmezse ChatPlace eski aiReply kullanabilir
  const staleAiReply =
    "Dış çekim fotoğraf... %20 ... 12.000 TL; drone da hediye.";
  const emptyApi = toChatPlaceResponseJson(undefined);
  const mappedAfterEmpty =
    emptyApi.success && "data" in emptyApi
      ? (emptyApi.data as { reply?: string }).reply
      : undefined;
  console.log("\n========== STALE aiReply CONTRACT ==========");
  console.log("API reply alanı yokken response:", JSON.stringify(emptyApi));
  console.log(
    "mapped data.reply:",
    mappedAfterEmpty ?? "UNDEFINED — ChatPlace tarafında eski aiReply temizlenmezse tekrar kullanılır (ÜRÜN RİSKİ)"
  );
  console.log("stale_value_example:", staleAiReply);
  console.log(
    "sonuç: Bizim API reply omit ederse ChatPlace mapping eski aiReply'ı SİLMEZ — bunu ChatPlace koşulu + her zaman reply alanı ile kapatmak gerekir."
  );

  // Guard asserts (lab)
  const bad =
    /12\.?000|%20|drone\s*hediye/i.test(t1.reply ?? "") ||
    /12\.?000|%20|drone\s*hediye/i.test(t2.reply ?? "");
  if (bad) {
    console.error("LAB FAIL: greeting/chitchat fiyat dump");
    process.exit(1);
  }
  if (!/fiyat|11\.?000|14\.?000|21\.?000/i.test(t3.reply ?? "")) {
    console.warn(
      "LAB WARN: fiyat sorusunda katalog rakamı bekleniyordu:",
      t3.reply
    );
  }
  console.log("\nLAB_OK");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
