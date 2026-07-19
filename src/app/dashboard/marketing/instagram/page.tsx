import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import {
  listInstagramMedia,
  getLatestInsightForMedia,
  suggestInstagramCreativesForAds,
} from "@/features/marketing/services/instagram-sync.service";
import { SyncButton } from "@/features/marketing/components/sync-button";
import { StatusBadge } from "@/components/dashboard/status-badge";

export const metadata: Metadata = {
  title: "Instagram İçerikleri — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

export default async function MarketingInstagramPage() {
  const supabase = createAdminClient();
  const media = await listInstagramMedia(supabase);
  const suggestion = await suggestInstagramCreativesForAds(supabase, {
    limit: 5,
  });
  const suggestedSet = new Set(suggestion.suggestedIds);

  const cards = await Promise.all(
    media.map(async (m) => {
      const insight = await getLatestInsightForMedia(supabase, m.id);
      return { m, insight };
    })
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-medium">Instagram İçerikleri</h2>
          <p className="text-muted-foreground text-sm">
            Performans sinyaline göre reklam kreatifi adayları önerilir.
          </p>
        </div>
        <SyncButton syncType="instagram" label="Şimdi senkronize et" />
      </div>

      <div className="rounded-xl border p-3 text-sm">
        <div className="font-medium">AI içerik önerisi</div>
        <p className="text-muted-foreground mt-1">{suggestion.rationale}</p>
        <p className="mt-1 text-xs">
          Güven: %{suggestion.confidenceLevel} · Önerilen gönderi:{" "}
          {suggestion.suggestedIds.length === 0
            ? "yok"
            : suggestion.suggestedIds.length}
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm">
          Meta hesabı henüz bağlanmadı veya içerik senkron edilmedi. Sahte
          gönderi yok.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cards.map(({ m, insight }) => (
            <li key={m.id} className="rounded-xl border p-3 text-sm">
              {suggestedSet.has(m.id) ? (
                <div className="mb-2">
                  <StatusBadge tone="brand">Kreatif adayı</StatusBadge>
                </div>
              ) : null}
              <div className="bg-muted mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-lg text-xs text-muted-foreground">
                {m.thumbnail_url || m.media_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.thumbnail_url ?? m.media_url ?? ""}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  "Görsel yok"
                )}
              </div>
              <div className="font-medium">{m.media_type}</div>
              <p className="text-muted-foreground line-clamp-2 text-xs">
                {m.caption ?? "—"}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
                <div>Beğeni: {insight?.likes ?? "—"}</div>
                <div>Yorum: {insight?.comments ?? "—"}</div>
                <div>Kaydetme: {insight?.saves ?? "—"}</div>
                <div>Paylaşım: {insight?.shares ?? "—"}</div>
                <div>İzlenme: {insight?.plays ?? "—"}</div>
                <div>Erişim: {insight?.reach ?? "—"}</div>
                <div>
                  Etkileşim:{" "}
                  {insight?.engagement_rate != null
                    ? `${(Number(insight.engagement_rate) * 100).toFixed(1)}%`
                    : "—"}
                </div>
                <div>
                  Reklama alındı: {m.used_in_ads ? "Evet" : "Hayır"}
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
