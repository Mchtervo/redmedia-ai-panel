import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { graphGet, graphGetAll } from "@/features/marketing/services/meta/graph-client";
import { resolveMetaAccessToken } from "@/features/marketing/services/meta/token.service";
import {
  envAdAccountId,
  mapMetaEntityStatus,
  metaBudgetToMajor,
} from "@/features/marketing/services/meta/meta-mappers";
import { startSyncLog, finishSyncLog } from "@/features/marketing/services/meta/sync-log";

type TypedSupabaseClient = SupabaseClient<Database>;

type MetaCampaign = {
  id: string;
  name?: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
};

type MetaAdSet = {
  id: string;
  name?: string;
  campaign_id?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  targeting?: Record<string, unknown>;
};

type MetaAd = {
  id: string;
  name?: string;
  adset_id?: string;
  status?: string;
  effective_status?: string;
  creative?: { id?: string };
};

type MetaCreative = {
  id: string;
  name?: string;
  title?: string;
  body?: string;
  image_url?: string;
  thumbnail_url?: string;
  video_id?: string;
  call_to_action_type?: string;
  object_story_spec?: Json;
};

export type SyncResult = {
  ok: boolean;
  message: string;
  records: number;
};

async function ensureAdAccount(
  supabase: TypedSupabaseClient,
  accessToken: string
): Promise<{ id: string; metaAccountId: string }> {
  const metaAccountId = envAdAccountId();
  if (!metaAccountId || metaAccountId === "act_") {
    throw new Error("META_AD_ACCOUNT_ID tanımlı değil.");
  }

  const remote = await graphGet<{
    id?: string;
    name?: string;
    currency?: string;
    timezone_name?: string;
    account_status?: number;
  }>({
    accessToken,
    path: metaAccountId,
    params: {
      fields: "id,name,currency,timezone_name,account_status",
    },
  });

  const status =
    remote.account_status === 1 || remote.account_status === undefined
      ? ("active" as const)
      : ("disabled" as const);

  const { data: existing } = await supabase
    .from("ad_accounts")
    .select("id")
    .eq("meta_account_id", metaAccountId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("ad_accounts")
      .update({
        name: remote.name ?? null,
        currency: remote.currency ?? null,
        timezone: remote.timezone_name ?? null,
        status,
      })
      .eq("id", existing.id);
    return { id: existing.id, metaAccountId };
  }

  const { data: created, error } = await supabase
    .from("ad_accounts")
    .insert({
      meta_account_id: metaAccountId,
      name: remote.name ?? null,
      currency: remote.currency ?? null,
      timezone: remote.timezone_name ?? null,
      status,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: created.id, metaAccountId };
}

export async function syncMetaCampaigns(
  supabase: TypedSupabaseClient
): Promise<SyncResult> {
  const logId = await startSyncLog(supabase, "ads", "campaigns");
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

    const account = await ensureAdAccount(supabase, token.accessToken);
    const campaigns = await graphGetAll<MetaCampaign>({
      accessToken: token.accessToken,
      path: `${account.metaAccountId}/campaigns`,
      params: {
        fields:
          "id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time",
      },
      limit: 100,
    });

    let count = 0;
    for (const c of campaigns) {
      const row = {
        ad_account_id: account.id,
        meta_campaign_id: c.id,
        name: c.name ?? null,
        objective: c.objective ?? null,
        status: mapMetaEntityStatus(c.effective_status ?? c.status),
        daily_budget: metaBudgetToMajor(c.daily_budget),
        lifetime_budget: metaBudgetToMajor(c.lifetime_budget),
        start_date: c.start_time ? c.start_time.slice(0, 10) : null,
        end_date: c.stop_time ? c.stop_time.slice(0, 10) : null,
      };
      const { error } = await supabase.from("campaigns").upsert(row, {
        onConflict: "ad_account_id,meta_campaign_id",
      });
      if (error) throw error;
      count += 1;
    }

    await finishSyncLog(supabase, logId, {
      status: "success",
      records: count,
    });
    return {
      ok: true,
      message: `${count} kampanya senkron edildi.`,
      records: count,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kampanya sync başarısız.";
    await finishSyncLog(supabase, logId, {
      status: "failed",
      records: 0,
      error: msg,
    });
    return { ok: false, message: msg, records: 0 };
  }
}

export async function syncMetaAdSets(
  supabase: TypedSupabaseClient
): Promise<SyncResult> {
  const logId = await startSyncLog(supabase, "ads", "adsets");
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

    const account = await ensureAdAccount(supabase, token.accessToken);
    const { data: localCampaigns } = await supabase
      .from("campaigns")
      .select("id, meta_campaign_id")
      .eq("ad_account_id", account.id);
    const campaignMap = new Map(
      (localCampaigns ?? []).map((c) => [c.meta_campaign_id, c.id])
    );

    const adSets = await graphGetAll<MetaAdSet>({
      accessToken: token.accessToken,
      path: `${account.metaAccountId}/adsets`,
      params: {
        fields:
          "id,name,campaign_id,status,effective_status,daily_budget,targeting",
      },
      limit: 100,
    });

    let count = 0;
    for (const a of adSets) {
      const campaignId = a.campaign_id
        ? campaignMap.get(a.campaign_id)
        : undefined;
      if (!campaignId) continue;
      const { error } = await supabase.from("ad_sets").upsert(
        {
          campaign_id: campaignId,
          meta_ad_set_id: a.id,
          name: a.name ?? null,
          status: mapMetaEntityStatus(a.effective_status ?? a.status),
          daily_budget: metaBudgetToMajor(a.daily_budget),
          targeting: (a.targeting ?? null) as Json,
        },
        { onConflict: "campaign_id,meta_ad_set_id" }
      );
      if (error) throw error;
      count += 1;
    }

    await finishSyncLog(supabase, logId, {
      status: "success",
      records: count,
    });
    return {
      ok: true,
      message: `${count} ad set senkron edildi.`,
      records: count,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ad set sync başarısız.";
    await finishSyncLog(supabase, logId, {
      status: "failed",
      records: 0,
      error: msg,
    });
    return { ok: false, message: msg, records: 0 };
  }
}

export async function syncMetaAds(
  supabase: TypedSupabaseClient
): Promise<SyncResult> {
  const logId = await startSyncLog(supabase, "ads", "ads");
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

    const account = await ensureAdAccount(supabase, token.accessToken);
    const { data: sets } = await supabase
      .from("ad_sets")
      .select("id, meta_ad_set_id, campaign_id");
    const setMap = new Map(
      (sets ?? []).map((s) => [s.meta_ad_set_id, s.id])
    );

    const ads = await graphGetAll<MetaAd>({
      accessToken: token.accessToken,
      path: `${account.metaAccountId}/ads`,
      params: {
        fields: "id,name,adset_id,status,effective_status,creative{id}",
      },
      limit: 100,
    });

    let count = 0;
    const adCreativePairs: { adUuid: string; creativeMetaId: string }[] = [];

    for (const ad of ads) {
      const adSetId = ad.adset_id ? setMap.get(ad.adset_id) : undefined;
      if (!adSetId) continue;
      const { data: upserted, error } = await supabase
        .from("ads")
        .upsert(
          {
            ad_set_id: adSetId,
            meta_ad_id: ad.id,
            name: ad.name ?? null,
            status: mapMetaEntityStatus(ad.effective_status ?? ad.status),
          },
          { onConflict: "ad_set_id,meta_ad_id" }
        )
        .select("id")
        .single();
      if (error) throw error;
      count += 1;
      if (ad.creative?.id) {
        adCreativePairs.push({
          adUuid: upserted.id,
          creativeMetaId: ad.creative.id,
        });
      }
    }

    // Creative sync for linked creatives
    const creativeIds = [
      ...new Set(adCreativePairs.map((p) => p.creativeMetaId)),
    ];
    for (const creativeId of creativeIds) {
      try {
        const creative = await graphGet<MetaCreative>({
          accessToken: token.accessToken,
          path: creativeId,
          params: {
            fields:
              "id,name,title,body,image_url,thumbnail_url,video_id,call_to_action_type",
          },
        });
        const linkedAds = adCreativePairs.filter(
          (p) => p.creativeMetaId === creativeId
        );
        for (const link of linkedAds) {
          const { data: existing } = await supabase
            .from("ad_creatives")
            .select("id")
            .eq("ad_id", link.adUuid)
            .eq("meta_creative_id", creative.id)
            .maybeSingle();

          const payload = {
            ad_id: link.adUuid,
            meta_creative_id: creative.id,
            title: creative.title ?? creative.name ?? null,
            body: creative.body ?? null,
            image_url: creative.image_url ?? creative.thumbnail_url ?? null,
            video_url: creative.video_id
              ? `https://www.facebook.com/${creative.video_id}`
              : null,
            call_to_action: creative.call_to_action_type ?? null,
          };

          if (existing) {
            await supabase
              .from("ad_creatives")
              .update(payload)
              .eq("id", existing.id);
          } else {
            await supabase.from("ad_creatives").insert(payload);
          }
        }
      } catch {
        // tek kreatif hatası tüm sync'i bozmasın
      }
    }

    await finishSyncLog(supabase, logId, {
      status: "success",
      records: count,
    });
    return {
      ok: true,
      message: `${count} reklam senkron edildi.`,
      records: count,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ads sync başarısız.";
    await finishSyncLog(supabase, logId, {
      status: "failed",
      records: 0,
      error: msg,
    });
    return { ok: false, message: msg, records: 0 };
  }
}

export async function syncMetaCreatives(
  supabase: TypedSupabaseClient
): Promise<SyncResult> {
  // Creative sync ads sync içinde yapılıyor; ayrı çağrı ads'i tetikler
  return syncMetaAds(supabase);
}
