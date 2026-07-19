/**
 * Asistan kırmızı çizgi hatalarını AI hafızasına yazar (self-improvement).
 * npx tsx scripts/seed-assistant-guardrails.ts
 */
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

  const seeds = [
    {
      mistakeType: "premature_detail_question" as const,
      triggerContext:
        "Müşteri dış çekim/klip/fiyat sorunca gelin almada kaç kişi diye sormak",
      wrongReply: "Gelin alma sırasında kaç kişi olacak?",
      correctApproach:
        "Kişi sayısı sorma. Katalogdan foto/klip/albüm fiyatı veya paket avantajını anlat; gerekirse yalnızca tarih, mekân türü veya telefon sor.",
    },
    {
      mistakeType: "premature_detail_question" as const,
      triggerContext:
        "Müşteriye ekipman, çekim süresi veya teknik lojistik sormak",
      wrongReply:
        "Çekim süresi ve ihtiyaç duyacağımız ekipman hakkında bilgi verir misin?",
      correctApproach:
        "Ekipman/süre sorma; bunlar ekibin işi. Hizmet ve katalog fiyatına odaklan.",
    },
    {
      mistakeType: "premature_detail_question" as const,
      triggerContext: "Müşteriye çekim başlangıç saatini sormak",
      wrongReply: "Hangi saatte başlayacağız?",
      correctApproach:
        "Saati müşteriye sorma. Müşteri kendiliğinden verdiyse not et; vermediyse ekip planlar. Tarih ve paket konuş.",
    },
  ];

  for (const seed of seeds) {
    const row = await upsertAiMistake(supabase, seed);
    console.log("ok", row.mistake_type, row.occurrence_count);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
