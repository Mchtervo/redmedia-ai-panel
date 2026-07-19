/**
 * 2+ hizmet %20; tek hizmet indirim yok; kapora 1000; sepet tutarı deme.
 * npx tsx scripts/seed-multi-service-discount.ts
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

const TITLE = "Plato / mekân anlaşma kuralları";
const CONTENT = `%20 indirim: yalnızca 2 veya daha fazla hizmet seçilince. Tek hizmette (sadece fotoğraf vb.) indirim yok.
Kapora her zaman 1.000 TL olarak söyle. "Sepet tutarı" deme.
Anlaşmalı plato (Başka/Anka/No25): giriş bize ait. Ödenecek = (hizmetler, %20 kuralıyla) + 3.000 gömülü (3.000 söyleme). Normalde = indirimsiz hizmet toplamı + 3.600.
Örnek foto+klip anlaşmalı plato: ödenecek 11.000, normalde 13.600, kapora 1.000.
Anlaşmasız plato: girişi çift öder, tutar uydurma; sorulursa 2.000 indirim.
Ev/kız isteme: +3.000 yok; %20 kuralı aynı.`;

async function main(): Promise<void> {
  loadEnv();
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("knowledge_documents")
    .select("id")
    .eq("title", TITLE)
    .maybeSingle();

  const payload = {
    title: TITLE,
    category: "musaitlik",
    content: CONTENT,
    review_status: "approved" as const,
    is_active: true,
    is_pricing_sensitive: false,
    is_campaign_claim: false,
    source_type: "manual" as const,
    reviewed_at: new Date().toISOString(),
    review_notes: "%20 sadece 2+ hizmet; kapora 1000; sepet tutarı yok",
  };

  if (existing) {
    await supabase
      .from("knowledge_documents")
      .update(payload)
      .eq("id", existing.id);
  } else {
    await supabase.from("knowledge_documents").insert(payload);
  }

  await upsertAiMistake(supabase, {
    mistakeType: "wrong_information",
    triggerContext:
      "Foto+klip (2 hizmet) seçiliyken %20 uygulamamak; tek hizmette %20 yapmak; sepet tutarı demek",
    wrongReply:
      "13.000 TL (foto+klip anlaşmalı, %20 yok) / Sepet tutarınız ...",
    correctApproach:
      "2+ hizmette %20. Anlaşmalı foto+klip: 11.000 (normalde 13.600), kapora 1.000. Tek hizmette indirim yok. Sepet tutarı deme.",
  });

  console.log("ok");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
