/**
 * Kalite kontrol: AI servislerini canlı Supabase verisiyle çalıştırır,
 * süre ve hataları raporlar. Yazma işlemleri: brief/rapor tabloları (kendi
 * tabloları) dışında hiçbir şey değiştirilmez.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-runtime-test.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

type Result = {
  name: string;
  ok: boolean;
  ms: number;
  detail: string;
};

async function timed<T>(
  name: string,
  fn: () => Promise<T>,
  describe: (v: T) => string
): Promise<{ result: Result; value: T | null }> {
  const start = Date.now();
  try {
    const value = await fn();
    return {
      result: {
        name,
        ok: true,
        ms: Date.now() - start,
        detail: describe(value),
      },
      value,
    };
  } catch (e) {
    return {
      result: {
        name,
        ok: false,
        ms: Date.now() - start,
        detail: e instanceof Error ? e.message.slice(0, 160) : "hata",
      },
      value: null,
    };
  }
}

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

  const results: Result[] = [];

  // 1) CEO Intelligence (dashboard + brief'ler)
  {
    const { buildCeoDashboard } = await import(
      "../src/features/ceo-intelligence/services/dashboard.service"
    );
    const { result, value } = await timed(
      "ceo_dashboard",
      () => buildCeoDashboard(sb),
      (v) =>
        `briefs=${v.intelligenceBriefs.length}, risks=${v.risks.length}, recs=${v.recommendations.length}, bullets=${v.summaryBullets.length}`
    );
    results.push(result);
    if (value) {
      const invalid = value.intelligenceBriefs.filter(
        (b) =>
          !b.title ||
          !b.summary ||
          !b.why ||
          !b.whatNext ||
          !b.doNow ||
          typeof b.confidence !== "number" ||
          !Array.isArray(b.evidence)
      );
      results.push({
        name: "ceo_brief_schema",
        ok: invalid.length === 0,
        ms: 0,
        detail:
          invalid.length === 0
            ? "tüm brief alanları zorunlu şemaya uygun"
            : `${invalid.length} brief eksik alanlı`,
      });
    }
  }

  // 2) CEO günlük rapor üretimi (kendi tablosuna yazar)
  {
    const { generateCeoDailyReport } = await import(
      "../src/features/ceo-intelligence/services/daily-report.service"
    );
    const { result } = await timed(
      "ceo_daily_report",
      () => generateCeoDailyReport(sb),
      (v) => `id=${v.id.slice(0, 8)} created=${v.created}`
    );
    results.push(result);
  }

  // 3) Attribution dashboard
  {
    const { buildAttributionDashboard } = await import(
      "../src/features/marketing/services/attribution-dashboard.service"
    );
    const { result, value } = await timed(
      "attribution_dashboard",
      () => buildAttributionDashboard(sb, "last_90"),
      (v) =>
        `campaigns=${v.campaigns.length}, dm=${v.summary.dm}, lead=${v.summary.lead}, rez=${v.summary.reservation}, kapora=${v.summary.kapora}, gelir=${v.summary.revenueExact}`
    );
    results.push(result);

    if (value) {
      const { buildMarketingIntelligenceBriefs } = await import(
        "../src/features/intelligence/services/marketing-briefs.service"
      );
      const briefs = buildMarketingIntelligenceBriefs(value);
      const bad = briefs.filter(
        (b) => !b.summary || !b.why || b.confidence == null
      );
      results.push({
        name: "marketing_briefs",
        ok: bad.length === 0,
        ms: 0,
        detail: `briefs=${briefs.length}; bands=${briefs.map((b) => b.confidenceBand).join(",")}`,
      });
    }
  }

  // 4) Marketing günlük rapor (kendi tablosuna yazar)
  {
    const { generateMarketingDailyReport } = await import(
      "../src/features/marketing/services/marketing-daily-report.service"
    );
    const { result } = await timed(
      "marketing_daily_report",
      () => generateMarketingDailyReport(sb),
      (v) => `id=${v.id.slice(0, 8)} created=${v.created}`
    );
    results.push(result);
  }

  // 5) Meta bağlantı testleri (canlı Graph; token yoksa skip mesajı)
  {
    const { testAllMetaConnections } = await import(
      "../src/features/marketing/services/meta-connection.service"
    );
    const { result, value } = await timed(
      "meta_connection_tests",
      () => testAllMetaConnections(sb),
      (v) =>
        v.results
          .map((r) => `${r.type}=${r.ok ? "OK" : "FAIL"}`)
          .join(" ")
    );
    results.push(result);
    if (value) {
      for (const r of value.results) {
        if (!r.ok) {
          results.push({
            name: `meta_${r.type}`,
            ok: false,
            ms: 0,
            detail: r.message.slice(0, 120),
          });
        }
      }
    }
  }

  // 6) Manuel tam senkron denemesi (token yoksa düzgün skip beklenir)
  {
    const { runManualMetaSync } = await import(
      "../src/features/marketing/services/meta-connection.service"
    );
    const { result } = await timed(
      "meta_full_sync",
      () => runManualMetaSync(sb, "full"),
      (v) =>
        `ok=${v.ok}; ${v.message.slice(0, 100)}; parts=${v.parts.length}`
    );
    results.push(result);
  }

  // 7) Müşteri brief'i gerçek contact ile
  {
    const { data: profile } = await sb
      .from("customer_profiles")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (profile) {
      const { buildCustomerIntelligenceBrief } = await import(
        "../src/features/intelligence/services/customer-briefs.service"
      );
      const brief = buildCustomerIntelligenceBrief(
        profile,
        profile.contact_id,
        null
      );
      results.push({
        name: "customer_brief",
        ok: Boolean(brief.summary && brief.doNow && brief.evidence),
        ms: 0,
        detail: `band=${brief.confidenceBand}, confidence=${brief.confidence}, evidence=${brief.evidence.length}`,
      });
    } else {
      results.push({
        name: "customer_brief",
        ok: true,
        ms: 0,
        detail: "customer_profiles boş — gerçek profil olmadan atlandı (veri uydurulmadı)",
      });
    }
  }

  console.log("\n=== AI Runtime QC Sonuçları ===\n");
  for (const r of results) {
    console.log(
      `${r.ok ? "OK " : "FAIL"} | ${r.name.padEnd(26)} | ${String(r.ms).padStart(5)}ms | ${r.detail}`
    );
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    failed.length === 0
      ? "\nSonuç: Tüm runtime testleri geçti."
      : `\nSonuç: ${failed.length} test başarısız.`
  );
}

main().catch((e) => {
  console.error("QC runtime hatası:", e instanceof Error ? e.message : e);
  process.exit(1);
});
