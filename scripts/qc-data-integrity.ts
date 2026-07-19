/**
 * QA veri bütünlüğü: duplicate, null, metrik tutarlılığı kontrolü.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-data-integrity.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

type Sb = ReturnType<typeof createClient<Database>>;

const results: Array<{ name: string; ok: boolean; detail: string }> = [];

function report(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"} | ${name.padEnd(44)} | ${detail}`);
}

function dupes(values: Array<string | null>): Map<string, number> {
  const seen = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    seen.set(v, (seen.get(v) ?? 0) + 1);
  }
  return new Map([...seen].filter(([, n]) => n > 1));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb: Sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Duplicate meta ID'ler
  {
    const { data } = await sb.from("campaigns").select("meta_campaign_id");
    const d = dupes((data ?? []).map((r) => r.meta_campaign_id));
    report("campaigns.meta_campaign_id duplicate", d.size === 0, d.size === 0 ? "yok" : `${d.size} duplicate`);
  }
  {
    const { data } = await sb.from("ad_sets").select("meta_ad_set_id");
    const d = dupes((data ?? []).map((r) => r.meta_ad_set_id));
    report("ad_sets.meta_ad_set_id duplicate", d.size === 0, d.size === 0 ? "yok" : `${d.size} duplicate`);
  }
  {
    const { data } = await sb.from("ads").select("meta_ad_id");
    const d = dupes((data ?? []).map((r) => r.meta_ad_id));
    report("ads.meta_ad_id duplicate", d.size === 0, d.size === 0 ? "yok" : `${d.size} duplicate`);
  }
  {
    const { data } = await sb.from("instagram_media").select("meta_media_id");
    const d = dupes((data ?? []).map((r) => r.meta_media_id));
    report("instagram_media.meta_media_id duplicate", d.size === 0, d.size === 0 ? "yok" : `${d.size} duplicate`);
  }
  {
    const { data } = await sb
      .from("ad_daily_metrics")
      .select("ad_id, date");
    const d = dupes((data ?? []).map((r) => `${r.ad_id}|${r.date}`));
    report("ad_daily_metrics (ad_id,date) duplicate", d.size === 0, d.size === 0 ? "yok" : `${d.size} duplicate`);
  }
  {
    const { data } = await sb
      .from("customer_attributions")
      .select("contact_id");
    const d = dupes((data ?? []).map((r) => r.contact_id));
    report("customer_attributions.contact_id duplicate", d.size === 0, d.size === 0 ? "yok" : `${d.size} duplicate`);
  }
  {
    const { data } = await sb
      .from("attribution_funnel_events")
      .select("contact_id, reservation_id, stage");
    const d = dupes(
      (data ?? []).map((r) => `${r.contact_id}|${r.reservation_id ?? "null"}|${r.stage}`)
    );
    report("attribution_funnel_events duplicate", d.size === 0, d.size === 0 ? "yok" : `${d.size} duplicate`);
  }

  // 2) Yetim (orphan) referanslar
  {
    const { data: adSets } = await sb.from("ad_sets").select("id, campaign_id");
    const { data: camps } = await sb.from("campaigns").select("id");
    const campIds = new Set((camps ?? []).map((c) => c.id));
    const orphans = (adSets ?? []).filter((s) => s.campaign_id && !campIds.has(s.campaign_id));
    report("ad_sets → campaigns orphan", orphans.length === 0, orphans.length === 0 ? "yok" : `${orphans.length} yetim`);
  }
  {
    const { data: ads } = await sb.from("ads").select("id, ad_set_id");
    const { data: sets } = await sb.from("ad_sets").select("id");
    const setIds = new Set((sets ?? []).map((s) => s.id));
    const orphans = (ads ?? []).filter((a) => a.ad_set_id && !setIds.has(a.ad_set_id));
    report("ads → ad_sets orphan", orphans.length === 0, orphans.length === 0 ? "yok" : `${orphans.length} yetim`);
  }
  {
    const { data: metrics } = await sb.from("ad_daily_metrics").select("ad_id");
    const { data: ads } = await sb.from("ads").select("id");
    const adIds = new Set((ads ?? []).map((a) => a.id));
    const orphans = (metrics ?? []).filter((m) => !adIds.has(m.ad_id));
    report("ad_daily_metrics → ads orphan", orphans.length === 0, orphans.length === 0 ? "yok" : `${orphans.length} yetim`);
  }

  // 3) Metrik mantık kontrolleri
  {
    const { data } = await sb
      .from("ad_daily_metrics")
      .select("spend, impressions, clicks, reach, ctr, date");
    let negative = 0;
    let clicksGtImpressions = 0;
    let badCtr = 0;
    let futureDate = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const m of data ?? []) {
      if (Number(m.spend) < 0 || Number(m.impressions) < 0 || Number(m.clicks) < 0) negative += 1;
      if (Number(m.clicks) > Number(m.impressions) && Number(m.impressions) > 0) clicksGtImpressions += 1;
      if (m.ctr !== null && (Number(m.ctr) < 0 || Number(m.ctr) > 1)) badCtr += 1;
      if (m.date > today) futureDate += 1;
    }
    report("ad_daily_metrics negatif değer", negative === 0, negative === 0 ? "yok" : `${negative} satır`);
    report("ad_daily_metrics clicks>impressions", clicksGtImpressions === 0, clicksGtImpressions === 0 ? "yok" : `${clicksGtImpressions} satır`);
    report("ad_daily_metrics ctr 0-1 aralığı", badCtr === 0, badCtr === 0 ? "yok" : `${badCtr} satır (ctr oran değil % olabilir)`);
    report("ad_daily_metrics gelecek tarih", futureDate === 0, futureDate === 0 ? "yok" : `${futureDate} satır`);
  }

  // 4) Null zorunlu alanlar
  {
    const { data } = await sb.from("campaigns").select("id, name, status");
    const badName = (data ?? []).filter((c) => !c.name?.trim()).length;
    report("campaigns.name boş", badName === 0, badName === 0 ? "yok" : `${badName} satır`);
    const statuses = new Set((data ?? []).map((c) => c.status));
    report("campaigns.status değerleri", true, [...statuses].join(", "));
  }
  {
    const { data } = await sb
      .from("instagram_media")
      .select("id, media_type, published_at, permalink");
    const noDate = (data ?? []).filter((m) => !m.published_at).length;
    const noLink = (data ?? []).filter((m) => !m.permalink).length;
    report("instagram_media.published_at null", noDate === 0, noDate === 0 ? "yok" : `${noDate} satır`);
    report("instagram_media.permalink null", noLink === 0, noLink === 0 ? "yok" : `${noLink} satır`);
  }

  // 5) Attribution güven aralığı
  {
    const { data } = await sb
      .from("customer_attributions")
      .select("attribution_status, attribution_confidence");
    let bad = 0;
    for (const a of data ?? []) {
      const c = a.attribution_confidence === null ? null : Number(a.attribution_confidence);
      if (c !== null && (c < 0 || c > 100)) bad += 1;
      if (a.attribution_status === "exact" && c !== null && c < 50) bad += 1;
    }
    report("customer_attributions güven aralığı", bad === 0, bad === 0 ? "tutarlı" : `${bad} tutarsız`);
  }

  // 6) instagram_media_insights duplicate
  {
    const { data } = await sb
      .from("instagram_media_insights")
      .select("instagram_media_id, insight_date");
    const d = dupes((data ?? []).map((r) => `${r.instagram_media_id}|${r.insight_date}`));
    report("instagram_media_insights duplicate", d.size === 0, d.size === 0 ? "yok" : `${d.size} duplicate`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    failed.length === 0
      ? "\nSonuç: Veri bütünlüğü temiz."
      : `\nSonuç: ${failed.length} bütünlük sorunu bulundu.`
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
