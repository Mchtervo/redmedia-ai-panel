/**
 * Etkinlik+mekân önce; anlaşmasız platoda girişi çift öder; giriş ücreti uydurma yasak.
 * npx tsx scripts/seed-venue-pricing-flow.ts
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
const CONTENT = `Fiyat vermeden önce etkinlik (düğün/nişan/kız isteme) ve çekim yeri (ev/yeşillik/plato adı) öğren.
Ev nişan / kız isteme: katalog liste fiyatı; plato ek ücreti yok.
Anlaşmalı platolar: Başka Plato, Anka Plato, No25 — giriş ücreti Redmedia'ya ait, çift ödemez. (İç fiyatlandırmayı müşteriye söyleme.)
Anlaşmalı OLMAYAN plato: giriş ücretini çift öder. Giriş tutarını uydurma; plato kendi tarifesini söyler. Redmedia paketinde sorulursa 2.000 TL indirim uygulanabilir.
Albüm istemeyen müşteriye albüm seti dayatma.`;

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
    review_notes: "Etkinlik+mekân önce; anlaşmasız giriş çifte ait",
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
      "Anlaşmalı olmayan plato (Sarnıç vb.) sorulunca giriş ücreti uydurmak veya 'giriş bize ait' demek",
    wrongReply: "Sarnıç Plato giriş ücreti 7.000 TL / giriş bize ait",
    correctApproach:
      "Anlaşmasız platoda girişi çift öder. Tutar uydurma; bilmiyorsan platonun kendi ücretini netleştireceğini / ekibe soracağını söyle. Pakette sorulursa 2.000 indirim.",
  });

  await upsertAiMistake(supabase, {
    mistakeType: "premature_detail_question",
    triggerContext:
      "Etkinlik türü ve mekân belli olmadan albüm+%20+drone tam paket fiyatı okumak",
    wrongReply:
      "Normalde 15.000 erken rezervasyon 12.000 drone hediye (nişan/düğün/ev/plato sorulmadan)",
    correctApproach:
      "Önce düğün mü nişan mı / ev mi plato mu öğren. Ev/kız isteme: liste fiyat. Plato politikası yalnız dış çekim+plato netken. Bastırırsa kısa birim fiyat + soru.",
  });

  console.log("ok");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
