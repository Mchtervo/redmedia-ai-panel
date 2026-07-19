/**
 * ChatPlace MCP ilk geçmiş içe aktarma (idempotent backfill).
 * Kullanım: npx tsx --env-file=.env.local scripts/chatplace-backfill.ts [maxChats]
 *
 * Tekrar çalıştırmak güvenlidir: dış mesaj id'si + benzerlik penceresi
 * ile mevcut kayıtlar atlanır. Sır değerleri asla yazdırılmaz.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { syncChatPlaceConversations } from "../src/features/conversations/services/chatplace-sync.service";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik.");
    process.exit(1);
  }

  const maxChats = Number(process.argv[2]) || 500;
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`ChatPlace backfill başlıyor (maxChats=${maxChats})...`);
  const result = await syncChatPlaceConversations(supabase, {
    mode: "backfill",
    maxChats,
  });

  console.log("\n=== Backfill Sonucu ===");
  console.log(`Durum:              ${result.status}`);
  console.log(`Taranan chat:       ${result.chatsScanned}`);
  console.log(`Senkronlanan chat:  ${result.chatsSynced}`);
  console.log(`İçe alınan mesaj:   ${result.messagesImported}`);
  console.log(`Atlanan (mevcut):   ${result.messagesSkipped}`);
  if (result.errors.length > 0) {
    console.log(`Hatalar (${result.errors.length}):`);
    for (const err of result.errors.slice(0, 10)) console.log(`  - ${err}`);
  }
  process.exit(result.status === "skipped" ? 1 : 0);
}

main().catch((error) => {
  console.error(
    "Backfill hatası:",
    error instanceof Error ? error.message : "bilinmeyen"
  );
  process.exit(1);
});
