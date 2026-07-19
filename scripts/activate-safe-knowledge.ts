/**
 * Fiyat/kampanya içermeyen pending bilgiyi onaylayıp asistan hafızasına açar.
 * npx tsx scripts/activate-safe-knowledge.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "@/server/supabase/admin";

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

const SAFE_CATEGORIES = new Set([
  "hizmetler",
  "paket_icerigi",
  "album_bilgileri",
  "drone",
  "sinematik_klip",
  "teslim_suresi",
  "rezervasyon",
  "odeme",
  "musaitlik",
  "telefon_alma",
  "itiraz_karsilama",
  "sik_sorulan_sorular",
]);

async function main(): Promise<void> {
  loadEnv();
  const supabase = createAdminClient();

  // Çekirdek firma kartı — her zaman aktif
  const core = {
    title: "Redmedia kimdir ve ne sunar",
    category: "hizmetler",
    content:
      "Redmedia Ankara'da düğün, nişan ve etkinlik için sinematik video ve fotoğraf çeker. Dış çekim, gelin alma, kına, nikah, salon, albüm ve drone paketleri isteğe göre kurulur. Erken rezervasyonda paket indirimi ve hediyeler katalog kampanyalarına göre sunulur. Satış tonu samimi ve nettir; fiyat uydurulmaz.",
    review_status: "approved" as const,
    is_active: true,
    is_pricing_sensitive: false,
    is_campaign_claim: false,
    source_type: "manual" as const,
  };

  const { data: existingCore } = await supabase
    .from("knowledge_documents")
    .select("id")
    .eq("title", core.title)
    .maybeSingle();

  if (existingCore) {
    await supabase
      .from("knowledge_documents")
      .update({
        content: core.content,
        review_status: "approved",
        is_active: true,
        reviewed_at: new Date().toISOString(),
        review_notes: "Çekirdek firma kimliği — aktif",
      })
      .eq("id", existingCore.id);
  } else {
    await supabase.from("knowledge_documents").insert({
      ...core,
      reviewed_at: new Date().toISOString(),
      review_notes: "Çekirdek firma kimliği — aktif",
    });
  }

  const { data: pending, error } = await supabase
    .from("knowledge_documents")
    .select("id, title, category, is_pricing_sensitive, is_campaign_claim")
    .eq("review_status", "pending_review")
    .eq("is_pricing_sensitive", false)
    .eq("is_campaign_claim", false)
    .limit(300);

  if (error) throw error;

  const toApprove = (pending ?? []).filter((row) =>
    SAFE_CATEGORIES.has(row.category)
  );
  const ids = toApprove.map((r) => r.id);

  const chunk = 40;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { error: updError } = await supabase
      .from("knowledge_documents")
      .update({
        review_status: "approved",
        is_active: true,
        reviewed_at: new Date().toISOString(),
        review_notes:
          "Otomatik: fiyat/kampanya içermeyen güvenli öğrenme bilgisi",
      })
      .in("id", slice);
    if (updError) throw updError;
  }

  console.log(
    JSON.stringify(
      {
        coreUpserted: true,
        pendingScanned: pending?.length ?? 0,
        approvedSafe: ids.length,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
