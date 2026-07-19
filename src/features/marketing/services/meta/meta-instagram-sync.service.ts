import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  graphGet,
  graphGetAll,
} from "@/features/marketing/services/meta/graph-client";
import { resolveMetaAccessToken } from "@/features/marketing/services/meta/token.service";
import { envIgAccountId } from "@/features/marketing/services/meta/meta-mappers";
import { startSyncLog, finishSyncLog } from "@/features/marketing/services/meta/sync-log";
import type { SyncResult } from "@/features/marketing/services/meta/meta-ads-sync.service";

type TypedSupabaseClient = SupabaseClient<Database>;

type IgMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

function mapMediaType(
  raw: string | undefined,
  productType: string | undefined
): Database["public"]["Tables"]["instagram_media"]["Row"]["media_type"] {
  // Graph API reels'i media_type=VIDEO olarak döndürür; ayrım
  // media_product_type=REELS / STORY alanındadır.
  const product = (productType ?? "").toUpperCase();
  if (product === "REELS") return "REELS";
  if (product === "STORY") return "STORY";

  switch ((raw ?? "").toUpperCase()) {
    case "IMAGE":
      return "IMAGE";
    case "VIDEO":
      return "VIDEO";
    case "CAROUSEL_ALBUM":
      return "CAROUSEL_ALBUM";
    case "REELS":
      return "REELS";
    case "STORY":
      return "STORY";
    default:
      return "OTHER";
  }
}

export async function syncInstagramMedia(
  supabase: TypedSupabaseClient
): Promise<SyncResult> {
  const logId = await startSyncLog(supabase, "instagram", "ig_media");
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

    const igId = envIgAccountId();
    if (!igId) {
      await finishSyncLog(supabase, logId, {
        status: "skipped",
        records: 0,
        error: "META_INSTAGRAM_ACCOUNT_ID yok.",
      });
      return {
        ok: false,
        message: "META_INSTAGRAM_ACCOUNT_ID tanımlı değil.",
        records: 0,
      };
    }

    const media = await graphGetAll<IgMedia>({
      accessToken: token.accessToken,
      path: `${igId}/media`,
      params: {
        fields:
          "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      },
      limit: 50,
      maxPages: 10,
    });

    let records = 0;
    for (const m of media) {
      const { data: upserted, error } = await supabase
        .from("instagram_media")
        .upsert(
          {
            meta_media_id: m.id,
            media_type: mapMediaType(m.media_type, m.media_product_type),
            caption: m.caption ?? null,
            permalink: m.permalink ?? null,
            thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
            media_url: m.media_url ?? null,
            published_at: m.timestamp ?? null,
          },
          { onConflict: "meta_media_id" }
        )
        .select("id")
        .single();
      if (error) throw error;

      // Insights (reach, saved, shares, views) — media insights endpoint.
      // Not: Graph API güncel sürümünde "plays" metriği kaldırıldı; izlenme
      // için "views" kullanılır (plays kolonuna yazılır).
      let reach = 0;
      let saves = 0;
      let shares = 0;
      let plays = 0;
      let engagementRate: number | null = null;
      try {
        const insights = await graphGet<{
          data?: Array<{ name?: string; values?: Array<{ value?: number }> }>;
        }>({
          accessToken: token.accessToken,
          path: `${m.id}/insights`,
          params: {
            metric: "reach,saved,shares,views,total_interactions",
          },
        });
        const map = new Map<string, number>();
        for (const row of insights.data ?? []) {
          if (row.name) {
            map.set(row.name, Number(row.values?.[0]?.value ?? 0));
          }
        }
        reach = map.get("reach") ?? 0;
        saves = map.get("saved") ?? 0;
        shares = map.get("shares") ?? 0;
        plays = map.get("views") ?? 0;
        const interactions = map.get("total_interactions") ?? 0;
        if (reach > 0) {
          engagementRate = interactions / reach;
        }
      } catch {
        // bazı medya türlerinde insights kısıtlı olabilir
      }

      const insightDate = (m.timestamp ?? new Date().toISOString()).slice(
        0,
        10
      );
      await supabase.from("instagram_media_insights").upsert(
        {
          instagram_media_id: upserted.id,
          insight_date: insightDate,
          likes: m.like_count ?? 0,
          comments: m.comments_count ?? 0,
          saves,
          shares,
          plays,
          reach,
          engagement_rate: engagementRate,
        },
        { onConflict: "instagram_media_id,insight_date" }
      );
      records += 1;
    }

    await finishSyncLog(supabase, logId, {
      status: "success",
      records,
    });
    return {
      ok: true,
      message: `${records} Instagram gönderisi senkron edildi.`,
      records,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Instagram sync başarısız.";
    await finishSyncLog(supabase, logId, {
      status: "failed",
      records: 0,
      error: msg,
    });
    return { ok: false, message: msg, records: 0 };
  }
}
