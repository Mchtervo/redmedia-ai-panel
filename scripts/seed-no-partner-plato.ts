/**
 * Anlaşmalı plato yok — iş kuralı + AI hata kaydı.
 * npx tsx scripts/seed-no-partner-plato.ts
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

  await upsertAiMistake(supabase, {
    mistakeType: "wrong_information",
    triggerContext: "Müşteri mekân / plato / giriş ücreti sorunca",
    wrongReply:
      "Anlaşmalı seçenekleri ve güncel giriş ücretlerini ekibimizden teyit edip size uygun olanları paylaşalım.",
    correctApproach:
      "Anlaşmalı plato yok deme / varmış gibi sunma. Plato giriş ücreti pakete dahil olmayabilir; tutarı bilmiyorsan uydurma, ekibe teyit edileceğini söyle. Mekân müşterinin seçimi (plato/salon/dış).",
  });

  const title = "Plato / mekân giriş ücreti politikası";
  const content =
    "Redmedia'nın anlaşmalı platosu YOKTUR. Müşteriye anlaşmalı plato veya partner stüdyo varmış gibi anlatma. Mekân müşterinin seçtiği plato, salon veya dış mekân olabilir; plato giriş ücreti varsa pakete dahil değildir ve seçilen mekâna göre ayrıca olur. Güncel giriş ücretini bilmiyorsan uydurma; ekibe teyit edileceğini söyle.";

  const { data: existing } = await supabase
    .from("knowledge_documents")
    .select("id")
    .eq("title", title)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("knowledge_documents")
      .update({
        content,
        review_status: "approved",
        is_active: true,
        is_pricing_sensitive: false,
        is_campaign_claim: false,
        reviewed_at: new Date().toISOString(),
        review_notes: "İş kuralı: anlaşmalı plato yok",
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("knowledge_documents").insert({
      title,
      category: "musaitlik",
      content,
      review_status: "approved",
      is_active: true,
      is_pricing_sensitive: false,
      is_campaign_claim: false,
      source_type: "manual",
      reviewed_at: new Date().toISOString(),
      review_notes: "İş kuralı: anlaşmalı plato yok",
    });
  }

  // Onaylı ama yanlış 'anlaşmalı' geçenleri kapat
  const { data: bad } = await supabase
    .from("knowledge_documents")
    .select("id, title")
    .eq("is_active", true)
    .ilike("content", "%anlaşmalı%");

  for (const row of bad ?? []) {
    if (row.title === title) continue;
    await supabase
      .from("knowledge_documents")
      .update({
        review_status: "rejected",
        is_active: false,
        review_notes: "Yanlış bilgi: anlaşmalı plato yok",
      })
      .eq("id", row.id);
  }

  console.log("ok", { deactivatedWrong: (bad ?? []).length });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
