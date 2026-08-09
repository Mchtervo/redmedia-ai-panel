"use client";

import { useState } from "react";
import Image from "next/image";
import {
  AD_HEALTH_LABELS,
  type AdsHierarchyBundle,
  type AdHealthScore,
  type EntityMetrics,
} from "@/features/marketing/services/ads-hierarchy.service";
import { formatTry } from "@/features/ceo-intelligence/utils/time";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { cn } from "@/lib/utils";

function ScoreBadge({ score }: { score: AdHealthScore }) {
  const tone =
    score === "good"
      ? "success"
      : score === "bad"
        ? "danger"
        : "neutral";
  return <StatusBadge tone={tone}>{AD_HEALTH_LABELS[score]}</StatusBadge>;
}

function MetricsCells({ m }: { m: EntityMetrics }) {
  return (
    <>
      <td className="p-2 tabular-nums">{formatTry(m.spend)}</td>
      <td className="p-2 tabular-nums">{m.impressions.toLocaleString("tr-TR")}</td>
      <td className="p-2 tabular-nums">{m.clicks.toLocaleString("tr-TR")}</td>
      <td className="p-2 tabular-nums">
        {m.ctr == null ? "—" : `%${m.ctr.toFixed(2)}`}
      </td>
      <td className="p-2 tabular-nums">{m.messages}</td>
      <td className="p-2 tabular-nums">
        {m.costPerMessage == null ? "—" : formatTry(m.costPerMessage)}
      </td>
      <td className="p-2">
        <ScoreBadge score={m.score} />
      </td>
    </>
  );
}

export function AdsHierarchyTree({ bundle }: { bundle: AdsHierarchyBundle }) {
  const [openCampaigns, setOpenCampaigns] = useState<Record<string, boolean>>(
    {}
  );
  const [openSets, setOpenSets] = useState<Record<string, boolean>>({});

  if (bundle.campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Kampanya verisi yok. Meta bağlantısından sync çalıştırın.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="bg-muted/50 text-xs">
          <tr>
            <th className="p-2">Kampanya / Ad Set / Reklam</th>
            <th className="p-2">Durum</th>
            <th className="p-2">Harcama</th>
            <th className="p-2">Gösterim</th>
            <th className="p-2">Tıklama</th>
            <th className="p-2">CTR</th>
            <th className="p-2">Mesaj</th>
            <th className="p-2">Mesaj maliyeti</th>
            <th className="p-2">Skor</th>
          </tr>
        </thead>
        <tbody>
          {bundle.campaigns.map((campaign) => {
            const cOpen = openCampaigns[campaign.id] ?? campaign.metrics.spend > 0;
            return (
              <CampaignBlock
                key={campaign.id}
                campaign={campaign}
                open={cOpen}
                onToggle={() =>
                  setOpenCampaigns((s) => ({
                    ...s,
                    [campaign.id]: !cOpen,
                  }))
                }
                openSets={openSets}
                setOpenSets={setOpenSets}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CampaignBlock({
  campaign,
  open,
  onToggle,
  openSets,
  setOpenSets,
}: {
  campaign: AdsHierarchyBundle["campaigns"][number];
  open: boolean;
  onToggle: () => void;
  openSets: Record<string, boolean>;
  setOpenSets: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  return (
    <>
      <tr className="border-t bg-muted/20">
        <td className="p-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2 text-left font-medium hover:underline"
            aria-expanded={open}
          >
            <span className="text-muted-foreground w-4">{open ? "▾" : "▸"}</span>
            {campaign.name}
            <span className="text-muted-foreground text-xs font-normal">
              ({campaign.adSets.length} ad set)
            </span>
          </button>
        </td>
        <td className="p-2 text-xs capitalize">{campaign.status ?? "—"}</td>
        <MetricsCells m={campaign.metrics} />
      </tr>
      {open &&
        campaign.adSets.map((set) => {
          const sOpen = openSets[set.id] ?? false;
          return (
            <AdSetBlock
              key={set.id}
              set={set}
              open={sOpen}
              onToggle={() =>
                setOpenSets((prev) => ({ ...prev, [set.id]: !sOpen }))
              }
            />
          );
        })}
    </>
  );
}

function AdSetBlock({
  set,
  open,
  onToggle,
}: {
  set: AdsHierarchyBundle["campaigns"][number]["adSets"][number];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-t">
        <td className="p-2 pl-8">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2 text-left hover:underline"
            aria-expanded={open}
          >
            <span className="text-muted-foreground w-4">{open ? "▾" : "▸"}</span>
            <span className="font-medium">{set.name}</span>
            {set.dailyBudget != null ? (
              <span className="text-muted-foreground text-xs">
                bütçe {formatTry(set.dailyBudget)}/gün
              </span>
            ) : null}
          </button>
        </td>
        <td className="p-2 text-xs capitalize">{set.status ?? "—"}</td>
        <MetricsCells m={set.metrics} />
      </tr>
      {open &&
        set.ads.map((ad) => (
          <tr key={ad.id} className="border-t bg-background/50">
            <td className="p-2 pl-14">
              <div className="flex items-center gap-3">
                {ad.creativeImageUrl ? (
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border">
                    <Image
                      src={ad.creativeImageUrl}
                      alt={ad.creativeTitle || ad.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-[10px]"
                    )}
                  >
                    Kreatif
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{ad.name}</p>
                  {ad.creativeTitle ? (
                    <p className="text-muted-foreground truncate text-xs">
                      {ad.creativeTitle}
                    </p>
                  ) : null}
                </div>
              </div>
            </td>
            <td className="p-2 text-xs capitalize">{ad.status ?? "—"}</td>
            <MetricsCells m={ad.metrics} />
          </tr>
        ))}
    </>
  );
}
