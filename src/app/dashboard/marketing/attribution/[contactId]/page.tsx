import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/server/supabase/admin";
import {
  FUNNEL_STAGE_LABELS,
  FUNNEL_STAGE_ORDER,
  listFunnelTimeline,
  rebuildAttributionFunnelForContact,
  type FunnelStage,
} from "@/features/marketing/services/attribution-funnel.service";
import { getAttributionByContactId } from "@/features/marketing/services/attribution.service";
import {
  ATTRIBUTION_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  type AttributionStatus,
  type SourceType,
} from "@/features/marketing/types";
import { RebuildFunnelButton } from "@/features/marketing/components/attribution-actions";
import { formatTry } from "@/features/ceo-intelligence/utils/time";

export const metadata: Metadata = {
  title: "Attribution Timeline — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ contactId: string }>;
};

export default async function AttributionTimelinePage({ params }: Props) {
  const { contactId } = await params;
  if (!contactId) notFound();

  const supabase = createAdminClient();

  // Timeline yoksa bir kez kur
  let events = await listFunnelTimeline(supabase, contactId);
  if (events.length === 0) {
    const rebuilt = await rebuildAttributionFunnelForContact(
      supabase,
      contactId
    );
    events = rebuilt.events;
  }

  const attr = await getAttributionByContactId(supabase, contactId);
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name, username")
    .eq("id", contactId)
    .maybeSingle();

  if (!contact && !attr && events.length === 0) {
    notFound();
  }

  const reached = new Set(events.map((e) => e.stage));
  const name =
    contact?.full_name ||
    (contact?.username ? `@${contact.username}` : null) ||
    contactId.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/marketing/attribution"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            ← Attribution
          </Link>
          <h2 className="mt-1 text-lg font-medium">Attribution Timeline</h2>
          <p className="text-muted-foreground text-sm">{name}</p>
        </div>
        <RebuildFunnelButton contactId={contactId} />
      </div>

      {attr ? (
        <section className="rounded-xl border p-4 text-sm">
          <div className="font-medium">Kaynak</div>
          <p className="text-muted-foreground mt-1 text-xs">
            {SOURCE_TYPE_LABELS[attr.source_type as SourceType] ??
              attr.source_type}{" "}
            ·{" "}
            {ATTRIBUTION_STATUS_LABELS[
              attr.attribution_status as AttributionStatus
            ] ?? attr.attribution_status}
            {attr.attribution_confidence != null
              ? ` · güven %${attr.attribution_confidence}`
              : ""}
          </p>
          {attr.attribution_status === "probable" ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              Olası Kaynak — kesin gelir/ROI hesabına dahil edilmez.
            </p>
          ) : null}
          {attr.notes ? (
            <p className="mt-2 text-xs">{attr.notes}</p>
          ) : null}
        </section>
      ) : null}

      <section>
        <h3 className="mb-3 font-medium">Funnel zinciri</h3>
        <ol className="flex flex-wrap gap-2">
          {FUNNEL_STAGE_ORDER.map((stage) => {
            const done = reached.has(stage);
            return (
              <li
                key={stage}
                className={`rounded-lg border px-2.5 py-1 text-xs ${
                  done
                    ? "border-foreground/20 bg-muted font-medium"
                    : "text-muted-foreground opacity-50"
                }`}
              >
                {FUNNEL_STAGE_LABELS[stage]}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Olaylar</h3>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Timeline boş. Funnel yenile veya rezervasyon/DM verisi ekleyin.
          </p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="rounded-lg border px-3 py-2 text-sm">
                <div className="font-medium">
                  {FUNNEL_STAGE_LABELS[e.stage as FunnelStage] ?? e.stage}
                </div>
                <div className="text-muted-foreground text-xs">
                  {new Date(e.occurred_at).toLocaleString("tr-TR")}
                  {e.amount != null ? ` · ${formatTry(Number(e.amount))}` : ""}
                  {e.attribution_status
                    ? ` · ${ATTRIBUTION_STATUS_LABELS[e.attribution_status as AttributionStatus] ?? e.attribution_status}`
                    : ""}
                  {e.attribution_confidence != null
                    ? ` · güven %${e.attribution_confidence}`
                    : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href={`/dashboard/customers/${contactId}`}
        className="text-sm underline-offset-4 hover:underline"
      >
        Müşteri detayına git
      </Link>
    </div>
  );
}
