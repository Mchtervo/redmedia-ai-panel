import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { graphGet } from "@/features/marketing/services/meta/graph-client";
import { resolveMetaAccessToken } from "@/features/marketing/services/meta/token.service";
import { getTodayIsoInIstanbul } from "@/features/ai/prompts/simple-assistant";
import { addDaysIso } from "@/features/ceo-intelligence/utils/time";
import { startSyncLog, finishSyncLog } from "@/features/marketing/services/meta/sync-log";
import type { SyncResult } from "@/features/marketing/services/meta/meta-ads-sync.service";

type TypedSupabaseClient = SupabaseClient<Database>;

type InsightRow = {
  date_start?: string;
  date_stop?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  frequency?: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  actions?: Array<{ action_type?: string; value?: string }>;
  action_values?: Array<{ action_type?: string; value?: string }>;
};

function actionValue(
  actions: InsightRow["actions"],
  types: string[]
): number {
  if (!actions) return 0;
  let sum = 0;
  for (const a of actions) {
    if (a.action_type && types.includes(a.action_type)) {
      sum += Number(a.value ?? 0);
    }
  }
  return sum;
}

/**
 * Son N gün ad-level insights → ad_daily_metrics
 */
export async function syncMetaInsights(
  supabase: TypedSupabaseClient,
  days = 30
): Promise<SyncResult> {
  const logId = await startSyncLog(supabase, "insights", "ad_insights");
  try {
    const token = await resolveMetaAccessToken(supabase);
    if (!token) {
      await finishSyncLog(supabase, logId, {
        status: "skipped",
        records: 0,
        error: "Access token yok.",
      });
      return { ok: false, message: "Access token yok.", records: 0 };
    }

    // Tüm reklamlar — sabit limit yerine sayfalama (500'den fazla reklam
    // olduğunda kalanların metriklerinin sessizce atlanmaması için)
    const ads: Array<{ id: string; meta_ad_id: string }> = [];
    const pageSize = 500;
    for (let from = 0; ; from += pageSize) {
      const { data: page, error: pageError } = await supabase
        .from("ads")
        .select("id, meta_ad_id")
        .order("id")
        .range(from, from + pageSize - 1);
      if (pageError) throw pageError;
      if (!page?.length) break;
      ads.push(...page);
      if (page.length < pageSize) break;
    }

    if (!ads.length) {
      await finishSyncLog(supabase, logId, {
        status: "skipped",
        records: 0,
        error: "Önce reklam senkronu gerekli.",
      });
      return {
        ok: false,
        message: "Önce Campaign/Ad sync çalıştırın.",
        records: 0,
      };
    }

    const until = getTodayIsoInIstanbul();
    const since = addDaysIso(until, -(days - 1));
    let records = 0;
    let failures = 0;

    for (const ad of ads) {
      try {
        const res = await graphGet<{ data?: InsightRow[] }>({
          accessToken: token.accessToken,
          path: `${ad.meta_ad_id}/insights`,
          params: {
            fields:
              "date_start,date_stop,spend,impressions,reach,clicks,frequency,cpm,cpc,ctr,actions,action_values",
            time_increment: 1,
            time_range: JSON.stringify({ since, until }),
            level: "ad",
          },
        });

        for (const row of res.data ?? []) {
          const date = row.date_start ?? until;
          const messages = actionValue(row.actions, [
            "onsite_conversion.messaging_conversation_started_7d",
            "onsite_conversion.total_messaging_connection",
            "messaging_conversation_started_7d",
          ]);
          const leads = actionValue(row.actions, [
            "lead",
            "onsite_conversion.lead_grouped",
          ]);
          const purchases = actionValue(row.actions, [
            "purchase",
            "omni_purchase",
          ]);
          const revenue = actionValue(row.action_values, [
            "purchase",
            "omni_purchase",
          ]);

          const { error } = await supabase.from("ad_daily_metrics").upsert(
            {
              ad_id: ad.id,
              date,
              spend: Number(row.spend ?? 0),
              impressions: Number(row.impressions ?? 0),
              reach: Number(row.reach ?? 0),
              clicks: Number(row.clicks ?? 0),
              messages_started: messages,
              leads,
              purchases,
              revenue,
              frequency: row.frequency ? Number(row.frequency) : null,
              cpm: row.cpm ? Number(row.cpm) : null,
              cpc: row.cpc ? Number(row.cpc) : null,
              ctr: row.ctr ? Number(row.ctr) / 100 : null,
            },
            { onConflict: "ad_id,date" }
          );
          if (error) throw error;
          records += 1;
        }
      } catch {
        failures += 1;
      }
    }

    const status =
      failures > 0 && records > 0
        ? "partial"
        : failures > 0 && records === 0
          ? "failed"
          : "success";

    await finishSyncLog(supabase, logId, {
      status,
      records,
      error: failures > 0 ? `${failures} reklam insight hatası` : null,
    });

    return {
      ok: status !== "failed",
      message: `${records} günlük metrik kaydı (${failures} hata).`,
      records,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Insights sync başarısız.";
    await finishSyncLog(supabase, logId, {
      status: "failed",
      records: 0,
      error: msg,
    });
    return { ok: false, message: msg, records: 0 };
  }
}
