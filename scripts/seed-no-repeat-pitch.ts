import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "@/server/supabase/admin";
import { upsertAiMistake } from "@/features/sales-learning/repositories/sales-learning.repository";

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
  await upsertAiMistake(supabase, {
    mistakeType: "repeated_question",
    triggerContext:
      "Fiyat bir kez anlatıldıktan sonra müşteri detay/araştırıyorum/tarih deyince aynı 15.000-12.000-drone bloğunu tekrar yazmak",
    wrongReply:
      "Dış çekim 5.000 TL den başlıyor. Albüm seti normalde 15.000, erken rezervasyona özel yüzde 20 ile 12.000 e düşüyor ve drone hediye.",
    correctApproach:
      "Aynı fiyat bloğunu tekrarlama. Detayda ekstra (gelin/salon/kuaför 3500) + fırsat dili; araştırıyorum → yumuşak kapanış; tarih → mekân sor.",
  });
  console.log("ok");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
