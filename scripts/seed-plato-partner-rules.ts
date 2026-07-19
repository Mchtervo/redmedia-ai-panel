/**
 * Anlaşmalı plato iş kuralları → knowledge + AI mistake.
 * npx tsx scripts/seed-plato-partner-rules.ts
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
/** Müşteriye gidebilecek bilgi — dahili 3000 burada YOK (sadece prompt/şirket beyni). */
const CONTENT = `Anlaşmalı platolar (yalnızca bunlar): Başka Plato, Anka Plato, No25 Plato.
Bu üçünde çift giriş ücreti ödemez; Redmedia karşılar. Müşteriye giriş ücreti çıkmayacağını / anlaşmalı plato olduğunu söyle.
Anlaşmalı olmayan plato veya başka mekân isterlerse: çifte 2.000 TL indirim uygulanabilir; sorarlarsa bunu açıkça söyle.
Bu üç isim dışında anlaşmalı plato uydurma.`;

async function main(): Promise<void> {
  loadEnv();
  const supabase = createAdminClient();

  // Eski yanlış "anlaşmalı plato yok" kartını kapat
  await supabase
    .from("knowledge_documents")
    .update({
      review_status: "rejected",
      is_active: false,
      review_notes: "Süpersede: anlaşmalı plato kuralları güncellendi",
    })
    .eq("title", "Plato / mekân giriş ücreti politikası");

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
    review_notes: "İş kuralı: Başka/Anka/No25 + gizli 3000 / diğer 2000 indirim",
  };

  if (existing) {
    await supabase
      .from("knowledge_documents")
      .update(payload)
      .eq("id", existing.id);
  } else {
    await supabase.from("knowledge_documents").insert(payload);
  }

  // listApprovedKnowledgeForReply filters is_campaign_claim false but also
  // does NOT filter is_pricing_sensitive — wait, it only filters campaign_claim.
  // Pricing sensitive docs ARE returned. Good - AI needs this. But we must
  // ensure prompt says never reveal the 3000 markup.

  await upsertAiMistake(supabase, {
    mistakeType: "wrong_information",
    triggerContext: "Müşteri plato / giriş ücreti / anlaşmalı mekân sorunca",
    wrongReply:
      "Anlaşmalı platomuz yok" +
      " / pakete 3.000 TL giriş yansıttık / anlaşmalı seçenekleri paylaşalım (isim vermeden)",
    correctApproach:
      "Anlaşmalı yalnızca Başka Plato, Anka Plato, No25. Bunlarda giriş ücreti ödemezler; 3000 dahili yansıtmayı ASLA söyleme. Diğer mekânda sorarlarsa 2000 indirim söyle.",
  });

  // Eski "anlaşmalı yok" mistake'ı düzelt (aynı trigger key farklı olabilir)
  await upsertAiMistake(supabase, {
    mistakeType: "wrong_information",
    triggerContext: "Müşteri mekân / plato / giriş ücreti sorunca",
    wrongReply:
      "Anlaşmalı seçenekleri ve güncel giriş ücretlerini ekibimizden teyit edip size uygun olanları paylaşalım.",
    correctApproach:
      "Anlaşmalı platoları isimle söyle: Başka Plato, Anka Plato, No25 — giriş ücreti yok. 3000 eklemeyi söyleme. Başka mekân isterlerse 2000 indirim (sorulursa).",
  });

  console.log("ok");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
