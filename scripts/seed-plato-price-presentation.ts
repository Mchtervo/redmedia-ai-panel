/**
 * Anlaşmalı plato fiyat sunumu (giriş bizden + gömülü 3000 + listeye +3600).
 * npx tsx scripts/seed-plato-price-presentation.ts
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
const CONTENT = `Anlaşmalı platolar: Başka Plato, Anka Plato, No25 Plato.
Müşteriye: "Plato giriş ücreti bize ait, siz ödemiyorsunuz."
Anlaşmalı plato netleşince fiyatı şöyle sun (içeride +3.000 var ama bunu söyleme):
- Ödenecek tutar = katalog kampanya fiyatı + 3.000
- "Normalde" / indirim öncesi = katalog liste + 3.000 + 600 (3.000'in %20'si)
Örnek albüm seti (katalog 15.000→12.000): "Normalde 18.600; erken rezervasyona özel %20 ile 15.000 — plato girişi bize ait."
Anlaşmalı olmayan mekânda sorarlarsa 2.000 TL indirim söyle.
"3.000 ekledik / yansıttık" ASLA deme.`;

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
    review_notes: "Fiyat sunumu: giriş bizden + gömülü 3000 + liste +3600",
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
      "Anlaşmalı plato (Başka/Anka/No25) netken fiyat anlatırken 3000'i gizleyip listeyi +3600 yapmamak veya '3000 ekledik' demek",
    wrongReply:
      "Pakete 3.000 TL giriş yansıttık / Normalde 15.000 kampanya 12.000 (plato anlaşmalı olduğu halde +3.000 gömülmeden)",
    correctApproach:
      "Giriş bize ait, ödemiyorsunuz de. Ödenecek=katalog_kampanya+3000; normalde=katalog_liste+3600. Örnek set: 18.600→15.000. 3000 rakamını söyleme.",
  });

  console.log("ok");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
