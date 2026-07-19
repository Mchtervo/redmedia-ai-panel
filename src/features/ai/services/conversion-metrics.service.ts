/**
 * Gerçek dönüşüm metrikleri — kapora = verified, rezervasyon = won.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { listProductionInstagramConversationIds } from "@/features/ai/services/production-conversation-filter";

type TypedSupabase = SupabaseClient<Database>;

/** Kesin rezervasyon (kazanılmış). */
export const RESERVATION_WON = new Set([
  "confirmed",
  "completed",
  "shoot_completed",
]);

/** Pipeline'da aktif rezervasyon adayı. */
export const RESERVATION_PIPELINE = new Set([
  "deposit_pending",
  "payment_review",
  "confirmed",
  "completed",
  "shoot_completed",
]);

export type ConversionMetrics = {
  conversations: number;
  priceGiven: number;
  followUp: number;
  /** deposit_status = verified */
  depositVerified: number;
  /** confirmed | completed | shoot_completed */
  reservationWon: number;
  /** deposit_pending+ pipeline */
  reservationPipeline: number;
  conversionPct: number;
  depositRatePct: number;
  bySource: {
    source: string;
    reservations: number;
    deposits: number;
  }[];
};

const PRICE_RE =
  /11\.?000|14\.?000|21\.?000|fiyat|ne\s*kadar|kaç\s*tl|ücret|paket/i;

function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 1000) / 10;
}

/**
 * Üretim IG konuşmaları üzerinden gerçek kapora + rezervasyon.
 */
export async function getRealConversionMetrics(
  supabase: TypedSupabase
): Promise<ConversionMetrics> {
  const productionIds = await listProductionInstagramConversationIds(supabase, {
    limit: 500,
  });
  const conversations = productionIds.length;

  let priceGiven = 0;
  let followUp = 0;
  const CHUNK = 60;

  for (let i = 0; i < productionIds.length; i += CHUNK) {
    const chunk = productionIds.slice(i, i + CHUNK);
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, sender_type, content")
      .in("conversation_id", chunk);

    const byConv = new Map<
      string,
      { customer: number; total: number; text: string }
    >();
    for (const m of msgs ?? []) {
      const cur = byConv.get(m.conversation_id) ?? {
        customer: 0,
        total: 0,
        text: "",
      };
      cur.total += 1;
      if (m.sender_type === "customer") cur.customer += 1;
      cur.text += `\n${m.content ?? ""}`;
      byConv.set(m.conversation_id, cur);
    }
    for (const id of chunk) {
      const c = byConv.get(id);
      if (!c) continue;
      if (PRICE_RE.test(c.text)) priceGiven += 1;
      if (c.customer >= 2 && c.total >= 4) followUp += 1;
    }
  }

  const { data: convRows } = await supabase
    .from("conversations")
    .select("id, contact_id")
    .in(
      "id",
      productionIds.length
        ? productionIds
        : ["00000000-0000-0000-0000-000000000000"]
    );

  const contactIds = [
    ...new Set(
      (convRows ?? [])
        .map((c) => c.contact_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  type ResRow = {
    id: string;
    status: string;
    deposit_status: string;
    source: string;
    conversation_id: string | null;
    contact_id: string | null;
  };

  const seen = new Set<string>();
  const allRes: ResRow[] = [];

  const { data: byConv } = await supabase
    .from("reservations")
    .select("id, status, deposit_status, source, conversation_id, contact_id")
    .in(
      "conversation_id",
      productionIds.length
        ? productionIds
        : ["00000000-0000-0000-0000-000000000000"]
    );

  for (const r of byConv ?? []) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    allRes.push(r);
  }

  for (let i = 0; i < contactIds.length; i += CHUNK) {
    const chunk = contactIds.slice(i, i + CHUNK);
    const { data: byContact } = await supabase
      .from("reservations")
      .select("id, status, deposit_status, source, conversation_id, contact_id")
      .in("contact_id", chunk);
    for (const r of byContact ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      allRes.push(r);
    }
  }

  let depositVerified = 0;
  let reservationWon = 0;
  let reservationPipeline = 0;
  const bySourceMap = new Map<
    string,
    { reservations: number; deposits: number }
  >();

  for (const r of allRes) {
    const src = r.source || "unknown";
    if (!bySourceMap.has(src)) {
      bySourceMap.set(src, { reservations: 0, deposits: 0 });
    }
    const bucket = bySourceMap.get(src)!;

    if (r.deposit_status === "verified") {
      depositVerified += 1;
      bucket.deposits += 1;
    }
    if (RESERVATION_WON.has(r.status)) {
      reservationWon += 1;
      bucket.reservations += 1;
    }
    if (RESERVATION_PIPELINE.has(r.status)) {
      reservationPipeline += 1;
    }
  }

  // Outcome tags — verified ile çelişmezse tamamlayıcı
  if (productionIds.length > 0) {
    const { data: tags } = await supabase
      .from("conversation_outcome_tags")
      .select("conversation_id, price_mentioned, customer_replied, conversation_length, deposit, reservation")
      .in("conversation_id", productionIds);
    const tagPrice = (tags ?? []).filter((t) => t.price_mentioned).length;
    const tagFollow = (tags ?? []).filter(
      (t) => t.customer_replied && t.conversation_length >= 4
    ).length;
    if (tagPrice > priceGiven) priceGiven = tagPrice;
    if (tagFollow > followUp) followUp = tagFollow;
  }

  return {
    conversations,
    priceGiven: Math.min(priceGiven, conversations),
    followUp: Math.min(followUp, conversations),
    depositVerified,
    reservationWon,
    reservationPipeline,
    conversionPct: pct(reservationWon, conversations),
    depositRatePct: pct(depositVerified, conversations),
    bySource: [...bySourceMap.entries()].map(([source, v]) => ({
      source,
      reservations: v.reservations,
      deposits: v.deposits,
    })),
  };
}
