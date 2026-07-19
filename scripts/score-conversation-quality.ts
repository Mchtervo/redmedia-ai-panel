/**
 * Instagram konuşmalarına Conversation Quality Score yazar.
 * npx tsx --env-file=.env.local scripts/score-conversation-quality.ts
 */

import { createAdminClient } from "../src/server/supabase/admin";
import { scoreInstagramConversations } from "../src/features/ai/services/conversation-quality.service";

async function main() {
  const supabase = createAdminClient();
  const onlyMissing = process.argv.includes("--missing");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 320;

  console.log(
    `[quality:score] Üretim Instagram konuşmaları skorlanıyor (limit=${limit}, onlyMissing=${onlyMissing})…`
  );

  const { scored, skippedNonProduction } = await scoreInstagramConversations(
    supabase,
    {
      limit: Number.isFinite(limit) ? limit : 320,
      onlyMissing,
    }
  );

  console.log(
    `[quality:score] Tamamlandı: ${scored} skorlandı · demo/test elendi (yaklaşık filtre sonrası).`
  );
  if (skippedNonProduction > 0) {
    console.log(
      `[quality:score] Not: limit içinden üretim dışı adaylar filtrelendi.`
    );
  }
}

main().catch((err: unknown) => {
  console.error("[quality:score] HATA:", err);
  process.exit(1);
});
