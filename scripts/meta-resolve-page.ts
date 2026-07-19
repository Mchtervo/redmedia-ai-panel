/**
 * GET /me/accounts ile erişilebilir Facebook sayfalarını listeler,
 * doğru Page ID'yi IG hesabına veya tek sayfaya göre tespit eder,
 * META_PAGE_ID ile karşılaştırır.
 *
 * Kullanım: npx tsx --env-file=.env.local scripts/meta-resolve-page.ts
 * --write ile .env.local META_PAGE_ID güncellenir.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { graphGetAll } from "../src/features/marketing/services/meta/graph-client";
import {
  resolveFacebookPageFromAccounts,
  type MetaPageAccount,
} from "../src/features/marketing/services/meta/page-resolve.service";
import { resolveMetaAccessToken } from "../src/features/marketing/services/meta/token.service";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Supabase env eksik.");
    process.exit(1);
  }
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const resolvedToken = await resolveMetaAccessToken(sb);
  const token = resolvedToken?.accessToken;
  if (!token) {
    console.error("Aktif OAuth token yok. Panelden Meta'ya Bağlan.");
    process.exit(1);
  }

  const envPageId = process.env.META_PAGE_ID?.trim() ?? "";
  const envIgId = process.env.META_INSTAGRAM_ACCOUNT_ID?.trim() ?? "";
  const write = process.argv.includes("--write");

  const pages = await graphGetAll<MetaPageAccount>({
    accessToken: token,
    path: "me/accounts",
    params: {
      fields:
        "id,name,category,access_token,instagram_business_account{id,username}",
      limit: 100,
    },
  });

  console.log("\n=== Facebook Sayfaları (/me/accounts) ===\n");
  if (pages.length === 0) {
    console.log("Hiç sayfa dönmedi. pages_show_list / pages_read_engagement scope kontrol edin.");
    process.exit(1);
  }

  for (const p of pages) {
    const ig = p.instagram_business_account;
    console.log(
      `- ${p.name} | page_id=${p.id}` +
        (ig
          ? ` | ig=${ig.id}${ig.username ? ` (@${ig.username})` : ""}`
          : " | ig=yok") +
        (p.category ? ` | category=${p.category}` : "")
    );
  }

  const resolved = resolveFacebookPageFromAccounts(pages, {
    envPageId,
    envIgAccountId: envIgId,
  });

  console.log("\n=== Page ID Karşılaştırma ===\n");
  console.log(`env META_PAGE_ID     : ${envPageId || "(boş)"}`);
  console.log(`tespit edilen Page ID: ${resolved.pageId}`);
  console.log(`tespit nedeni        : ${resolved.reason}`);
  console.log(`sayfa adı            : ${resolved.page.name}`);
  if (resolved.page.instagram_business_account?.username) {
    console.log(
      `bağlı Instagram      : @${resolved.page.instagram_business_account.username}`
    );
  }

  if (envPageId && envPageId === resolved.pageId) {
    console.log("\nSonuç: META_PAGE_ID doğru — değişiklik yok.");
  } else if (!envPageId) {
    console.log("\nSonuç: META_PAGE_ID boş — tespit edilen değer kullanılmalı.");
  } else {
    console.log(
      `\nSonuç: FARK VAR — env=${envPageId} → doğru=${resolved.pageId}`
    );
  }

  if (write && envPageId !== resolved.pageId) {
    const envPath = resolve(process.cwd(), ".env.local");
    const raw = readFileSync(envPath, "utf8");
    let next: string;
    if (/^META_PAGE_ID=/m.test(raw)) {
      next = raw.replace(/^META_PAGE_ID=.*$/m, `META_PAGE_ID=${resolved.pageId}`);
    } else {
      next = `${raw.replace(/\s*$/, "")}\nMETA_PAGE_ID=${resolved.pageId}\n`;
    }
    writeFileSync(envPath, next, "utf8");
    console.log(`\n.env.local güncellendi: META_PAGE_ID=${resolved.pageId}`);
  } else if (!write && envPageId !== resolved.pageId) {
    console.log(
      "\nNot: .env.local yazmak için --write bayrağı ekleyin."
    );
  }
}

main().catch((e) => {
  console.error(
    "Page resolve başarısız:",
    e instanceof Error ? e.message : e
  );
  process.exit(1);
});
