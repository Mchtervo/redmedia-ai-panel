/**
 * Meta bağlantı testi raporu (secret loglanmaz).
 * Token kaynağı: meta_oauth_tokens (OAuth). META_ACCESS_TOKEN kullanılmaz.
 * Kullanım: npx tsx --env-file=.env.local scripts/meta-connection-report.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import {
  debugMetaToken,
  getTokenHealthSummary,
  resolveMetaAccessToken,
} from "../src/features/marketing/services/meta/token.service";
import { graphGet } from "../src/features/marketing/services/meta/graph-client";
import {
  envAdAccountId,
  envBusinessId,
  envIgAccountId,
  envPageId,
  envPixelId,
  normalizeAdAccountId,
} from "../src/features/marketing/services/meta/meta-mappers";
import { resolveFacebookPageId } from "../src/features/marketing/services/meta/page-resolve.service";
import { testConversionsApiConnection } from "../src/features/marketing/services/meta/capi.service";

type Row = { name: string; ok: boolean; detail: string };

async function main() {
  const rows: Row[] = [];
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  rows.push({
    name: "META_APP_ID",
    ok: Boolean(appId),
    detail: appId ? `tanımlı (len=${appId.length})` : "eksik",
  });
  rows.push({
    name: "META_APP_SECRET",
    ok: Boolean(appSecret),
    detail: appSecret ? `tanımlı (len=${appSecret.length})` : "eksik",
  });

  if (!url || !key) {
    rows.push({
      name: "supabase",
      ok: false,
      detail: "NEXT_PUBLIC_SUPABASE_URL veya SERVICE_ROLE_KEY eksik",
    });
    printReport(rows);
    process.exit(1);
  }

  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const health = await getTokenHealthSummary(sb);
  const levelEmoji =
    health.level === "connected"
      ? "🟢"
      : health.level === "expiring"
        ? "🟡"
        : "🔴";
  rows.push({
    name: "oauth_health",
    ok: health.level === "connected" || health.level === "expiring",
    detail: `${levelEmoji} ${health.label}; action=${health.oauthAction ?? "yok"}; expires=${health.expiresAt ?? "—"}`,
  });

  const resolved = await resolveMetaAccessToken(sb);
  rows.push({
    name: "oauth_db_token",
    ok: Boolean(resolved),
    detail: resolved
      ? `aktif (source=database; len=${resolved.accessToken.length})`
      : "aktif OAuth token yok — Meta'ya Bağlan gerekli",
  });

  if (!resolved || !appId || !appSecret) {
    // CAPI bağımsız test edilebilir
    await pushCapi(rows);
    printReport(rows);
    console.log(
      "\nSonuç: OAuth token yok — Graph testleri atlandı. Panelden Meta'ya Bağlan."
    );
    process.exit(1);
  }

  const token = resolved.accessToken;

  try {
    const debug = await debugMetaToken(token);
    rows.push({
      name: "debug_token",
      ok: debug.isValid,
      detail: debug.isValid
        ? `geçerli; scopes=${debug.scopes.length}; expires=${debug.expiresAt ?? "yok/uzun"}`
        : "geçersiz",
    });
  } catch (e) {
    rows.push({
      name: "debug_token",
      ok: false,
      detail: e instanceof Error ? e.message : "hata",
    });
  }

  const checks: Array<{ name: string; id: string; fields: string }> = [
    {
      name: "meta_business",
      id: envBusinessId(),
      fields: "id,name",
    },
    {
      name: "meta_ad_account",
      id: envAdAccountId(),
      fields: "id,name,account_status,currency",
    },
    {
      name: "instagram_business",
      id: envIgAccountId(),
      fields: "id,username,name",
    },
    {
      name: "meta_pixel",
      id: envPixelId(),
      fields: "id,name",
    },
  ];

  try {
    const page = await resolveFacebookPageId(token);
    const envPage = envPageId();
    rows.push({
      name: "facebook_pages_list",
      ok: true,
      detail: `erişilebilir; seçilen=${page.page.name} (${page.pageId}); reason=${page.reason}`,
    });
    if (page.envMismatch) {
      rows.push({
        name: "META_PAGE_ID_mismatch",
        ok: false,
        detail: `env=${envPage} → doğru=${page.pageId} (${page.page.name})`,
      });
    }
    const res = await graphGet<{ id?: string; name?: string }>({
      accessToken: token,
      path: page.pageId,
      params: { fields: "id,name" },
    });
    rows.push({
      name: "facebook_page",
      ok: Boolean(res.id),
      detail: `${res.name ?? page.page.name} (${page.pageId})`,
    });
  } catch (e) {
    rows.push({
      name: "facebook_page",
      ok: false,
      detail: e instanceof Error ? e.message.slice(0, 200) : "hata",
    });
  }

  for (const c of checks) {
    if (!c.id || c.id === "act_") {
      rows.push({ name: c.name, ok: false, detail: "env ID eksik" });
      continue;
    }
    try {
      const res = await graphGet<{
        id?: string;
        name?: string;
        username?: string;
      }>({
        accessToken: token,
        path: c.id,
        params: { fields: c.fields },
      });
      rows.push({
        name: c.name,
        ok: Boolean(res.id),
        detail: res.username
          ? `@${res.username}`
          : (res.name ?? res.id ?? "ok"),
      });
    } catch (e) {
      rows.push({
        name: c.name,
        ok: false,
        detail: e instanceof Error ? e.message.slice(0, 160) : "hata",
      });
    }
  }

  await pushCapi(rows);

  rows.push({
    name: "db_meta_oauth_tokens",
    ok: true,
    detail: "erişilebilir",
  });

  printReport(rows);
  const failed = rows.filter((r) => !r.ok);
  console.log(
    failed.length === 0
      ? "\nSonuç: Tüm kritik kontroller geçti."
      : `\nSonuç: ${failed.length} kontrol başarısız — yukarıdaki detaylara bakın.`
  );
  const critical = ["oauth_db_token", "debug_token", "meta_ad_account"];
  const criticalFail = rows.some((r) => critical.includes(r.name) && !r.ok);
  process.exit(criticalFail ? 1 : 0);
}

async function pushCapi(rows: Row[]) {
  try {
    const capi = await testConversionsApiConnection();
    if (capi.outcome === "connected") {
      rows.push({
        name: "conversions_api",
        ok: true,
        detail: `Bağlı; events_received=${capi.eventsReceived ?? "?"}`,
      });
    } else if (capi.outcome === "configured_unverified") {
      rows.push({
        name: "conversions_api",
        ok: true,
        detail:
          "Yapılandırıldı, henüz olayla doğrulanmadı (META_CAPI_TEST_EVENT_CODE yok)",
      });
    } else {
      rows.push({
        name: "conversions_api",
        ok: false,
        detail: capi.message.slice(0, 200),
      });
    }
  } catch (e) {
    rows.push({
      name: "conversions_api",
      ok: false,
      detail: e instanceof Error ? e.message.slice(0, 200) : "hata",
    });
  }
}

function printReport(rows: Row[]) {
  console.log("\n=== Meta Bağlantı Testi Raporu ===\n");
  for (const r of rows) {
    console.log(`${r.ok ? "OK " : "FAIL"} | ${r.name.padEnd(24)} | ${r.detail}`);
  }
  void normalizeAdAccountId;
}

main().catch((e) => {
  console.error("Rapor çalıştırılamadı:", e instanceof Error ? e.message : e);
  process.exit(1);
});
