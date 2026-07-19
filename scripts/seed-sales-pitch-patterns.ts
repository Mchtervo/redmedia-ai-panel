/**
 * Erken rezervasyon / çapa fiyat satış dilini AI hafızasına yazar.
 * (Öğrenme batch fail olduğu için patterns boş kalmıştı.)
 * npx tsx scripts/seed-sales-pitch-patterns.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "@/server/supabase/admin";
import {
  upsertAiMistake,
  upsertPersonalityTrait,
  upsertSalesPattern,
} from "@/features/sales-learning/repositories/sales-learning.repository";

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

const SEED_CONV = "00000000-0000-4000-8000-0000000000a1";

async function main(): Promise<void> {
  loadEnv();
  const supabase = createAdminClient();

  const patterns = [
    {
      patternType: "price_explanation" as const,
      patternText:
        "Fiyatı düz söyleme: önce normal/liste tutarı (çapa), sonra erken rezervasyona özel %20 ile düşen tutar, sonra drone hediye; gelin alma/salon/kuaför eklenirse 5.000 yerine 3.500",
      contextNote: "Site sepeti + Redmedia DM satış dili",
      outcome: "won" as const,
    },
    {
      patternType: "closing" as const,
      patternText:
        "Erken rezervasyona özel dil kullan: normal X, şimdi Y; kazancını vurgula, müşteriyi acele ettirmeden avantajı hissettir",
      contextNote: "Anchor then discount",
      outcome: "won" as const,
    },
    {
      patternType: "trust_building" as const,
      patternText:
        "Foto+klip+albüm setinden sonra gelin alma / salon giriş / kuaför klip ekleyince ekstra kampanya (5.000→3.500) olduğunu kısa söyle",
      contextNote: "Upsell after package price",
      outcome: "won" as const,
    },
    {
      patternType: "failure" as const,
      patternText:
        "Sadece indirimli nihai fiyatı söylemek (örn. sadece 12.000 TL) — müşteri değeri görmüyor, pazarlık/kaçış artıyor",
      contextNote: "Flat price without anchor",
      outcome: "lost" as const,
    },
  ];

  for (const p of patterns) {
    const row = await upsertSalesPattern(supabase, {
      ...p,
      conversationId: SEED_CONV,
    });
    // Seed'i güçlendir: 2. kez won say
    if (p.outcome === "won") {
      await upsertSalesPattern(supabase, {
        ...p,
        conversationId: SEED_CONV,
      });
    }
    console.log("pattern", row.pattern_type, row.seen_count);
  }

  await upsertPersonalityTrait(supabase, {
    traitType: "tone",
    traitText:
      "Samimi ama satışçı: avantajı abartmadan, normal fiyat → erken rezervasyon özel fiyat zinciriyle anlatır",
    conversationId: SEED_CONV,
  });

  await upsertAiMistake(supabase, {
    mistakeType: "wrong_information",
    triggerContext: "Müşteri foto+klip+albüm seti ücreti sorunca",
    wrongReply:
      "Dış çekim fotoğraf, sinematik klip, büyük albüm ve 2 aile albümü seti %20 paket indirimiyle 12.000 TL; drone da hediye.",
    correctApproach:
      "Katalog paketleri söyle: Basic 11.000, Premium Albümlü 14.000, Elite 21.000 (kapora+plato dahil). Eski 12/15k ve erken drone hediye spoileri YASAK. Tarih uydurma.",
  });

  await upsertAiMistake(supabase, {
    mistakeType: "premature_detail_question",
    triggerContext: "Müşteri yalnızca fiyat sormuşken tarih uydurmak",
    wrongReply: "Yarın için tam tarihi paylaşır mısınız?",
    correctApproach:
      "Müşteri tarih demediyse yarın/cumartesi varsayma. Katalog fiyatını net ver; sonra 'etkinlik tarihinizi yazar mısınız?' diye sor.",
  });

  console.log("seed ok");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
