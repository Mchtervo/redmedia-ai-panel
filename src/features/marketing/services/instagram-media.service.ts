import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;

export type InstagramMediaListItem = {
  id: string;
  meta_media_id: string;
  media_type: string;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  published_at: string | null;
  used_in_ads: boolean;
};

export async function listInstagramMedia(
  supabase: TypedSupabaseClient
): Promise<InstagramMediaListItem[]> {
  const { data, error } = await supabase
    .from("instagram_media")
    .select(
      "id, meta_media_id, media_type, caption, permalink, thumbnail_url, media_url, published_at, used_in_ads"
    )
    .order("published_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export async function getLatestInsightForMedia(
  supabase: TypedSupabaseClient,
  mediaId: string
) {
  const { data } = await supabase
    .from("instagram_media_insights")
    .select("*")
    .eq("instagram_media_id", mediaId)
    .order("insight_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * IG gönderilerinden reklam kreatifi adayları önerir.
 * Insight varsa etkileşim/reach skoruna göre; yoksa henüz ads'te
 * kullanılmamış en yeni içerikleri önerir.
 */
export async function suggestInstagramCreativesForAds(
  supabase: TypedSupabaseClient,
  options?: { limit?: number }
): Promise<{
  suggestedIds: string[];
  confidenceLevel: number;
  rationale: string;
}> {
  const limit = options?.limit ?? 5;
  const media = await listInstagramMedia(supabase);
  if (media.length === 0) {
    return {
      suggestedIds: [],
      confidenceLevel: 0,
      rationale:
        "Henüz güvenilir karar vermek için yeterli veri bulunmuyor. Instagram içerikleri senkron edilmemiş.",
    };
  }

  const scored: Array<{ id: string; score: number }> = [];
  for (const item of media) {
    if (item.used_in_ads) continue;
    const insight = await getLatestInsightForMedia(supabase, item.id);
    const reach = Number(insight?.reach ?? 0);
    const likes = Number(insight?.likes ?? 0);
    const comments = Number(insight?.comments ?? 0);
    const saves = Number(insight?.saves ?? 0);
    const score = reach * 0.4 + likes * 2 + comments * 5 + saves * 4;
    scored.push({ id: item.id, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const withSignal = scored.filter((s) => s.score > 0);
  const picks = (withSignal.length > 0 ? withSignal : scored)
    .slice(0, limit)
    .map((s) => s.id);

  if (picks.length === 0) {
    return {
      suggestedIds: media.slice(0, limit).map((m) => m.id),
      confidenceLevel: 25,
      rationale:
        "Tüm içerikler daha önce reklamlarda kullanılmış görünüyor; en yeni gönderiler yedek öneri olarak listelendi.",
    };
  }

  return {
    suggestedIds: picks,
    confidenceLevel: withSignal.length > 0 ? 55 : 30,
    rationale:
      withSignal.length > 0
        ? `${picks.length} gönderi, reach/beğeni/yorum/kayıt sinyallerine göre reklam kreatifi adayı olarak önerildi. Metin ve kitleyi Marketing strateji motorundan alın.`
        : "Insight sinyali zayıf; henüz ads'te kullanılmamış en yeni gönderiler önerildi.",
  };
}

/** @deprecated suggestInstagramCreativesForAds kullanın */
export function suggestInstagramContentCount(available: number): {
  suggestedIds: string[];
  confidenceLevel: number;
  rationale: string;
} {
  if (available <= 0) {
    return {
      suggestedIds: [],
      confidenceLevel: 0,
      rationale:
        "Henüz güvenilir karar vermek için yeterli veri bulunmuyor. Instagram içerikleri senkron edilmemiş.",
    };
  }
  return {
    suggestedIds: [],
    confidenceLevel: 20,
    rationale:
      "Eski stub. Sayfa suggestInstagramCreativesForAds kullanacak şekilde güncellendi.",
  };
}
