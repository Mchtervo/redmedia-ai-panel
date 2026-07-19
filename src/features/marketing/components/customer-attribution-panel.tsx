"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setManualAttributionAction } from "@/features/marketing/actions/marketing-actions";
import {
  SOURCE_TYPE_LABELS,
  SOURCE_TYPES,
  ATTRIBUTION_STATUS_LABELS,
  type AttributionStatus,
  type SourceType,
} from "@/features/marketing/types";
import { Button } from "@/components/ui/button";

type Attr = {
  source_type: string;
  attribution_status: string;
  attribution_confidence: number | null;
  attribution_method: string | null;
  notes: string | null;
  meta_campaign_id: string | null;
  meta_ad_id: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
} | null;

export function CustomerAttributionPanel({
  contactId,
  attribution,
}: {
  contactId: string;
  attribution: Attr;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <section className="rounded-xl border p-4">
      <h2 className="text-base font-medium">Müşteri Kaynağı</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        exact = kesin bağ; probable = olası (kesin gibi gösterilmez); manual =
        personel; unknown = bilinmiyor.
      </p>

      {attribution ? (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs">Kaynak</dt>
            <dd>
              {SOURCE_TYPE_LABELS[attribution.source_type as SourceType] ??
                attribution.source_type}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Durum</dt>
            <dd>
              {ATTRIBUTION_STATUS_LABELS[
                attribution.attribution_status as AttributionStatus
              ] ?? attribution.attribution_status}
              {attribution.attribution_confidence != null
                ? ` · %${attribution.attribution_confidence}`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Yöntem</dt>
            <dd>{attribution.attribution_method ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">UTM / Meta</dt>
            <dd className="text-xs">
              {attribution.utm_source ?? "—"} /{" "}
              {attribution.utm_campaign ?? "—"} / ad:{" "}
              {attribution.meta_ad_id ?? "—"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted-foreground mt-2 text-sm">
          Kaynak kaydı yok (unknown).
        </p>
      )}

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const result = await setManualAttributionAction({
              contactId,
              sourceType: String(fd.get("sourceType")),
              notes: String(fd.get("notes") ?? "") || undefined,
              reason: "CRM manuel güncelleme",
            });
            setMessage(
              result.success
                ? "Kaynak güncellendi (audit log yazıldı)."
                : result.error
            );
            if (result.success) router.refresh();
          });
        }}
      >
        <div className="flex-1 space-y-1">
          <label className="text-xs" htmlFor="sourceType">
            Elle kaynak seç
          </label>
          <select
            id="sourceType"
            name="sourceType"
            className="border-input h-8 w-full rounded-lg border bg-transparent px-2 text-sm"
            defaultValue={attribution?.source_type ?? "unknown"}
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {SOURCE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs" htmlFor="notes">
            Not
          </label>
          <input
            id="notes"
            name="notes"
            className="border-input h-8 w-full rounded-lg border bg-transparent px-2 text-sm"
            defaultValue={attribution?.notes ?? ""}
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "…" : "Kaydet"}
        </Button>
      </form>
      {message ? (
        <p className="text-muted-foreground mt-2 text-xs">{message}</p>
      ) : null}
    </section>
  );
}
