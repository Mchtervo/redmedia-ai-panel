/**
 * Uygulanan önerilerin gerçek başarı oranları (kapora / rezervasyon).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { RESERVATION_WON } from "@/features/ai/services/conversion-metrics.service";

type TypedSupabase = SupabaseClient<Database>;

export type SuggestionSuccessByReason = {
  lossReason: string;
  applied: number;
  customerReplied: number;
  deposits: number;
  reservations: number;
  reservationRatePct: number;
};

export type SuggestionSuccessSnapshot = {
  applied: number;
  customerReplied: number;
  deposits: number;
  reservations: number;
  reservationRatePct: number;
  byLossReason: SuggestionSuccessByReason[];
};

function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 1000) / 10;
}

/**
 * Gönderilmiş önerilerin outcome'unu rezervasyon tablosundan güncelle.
 */
export async function reconcileSuggestionOutcomes(
  supabase: TypedSupabase,
  options?: { limit?: number }
): Promise<{ updated: number }> {
  const limit = options?.limit ?? 200;
  const { data: rows, error } = await supabase
    .from("suggestion_applications")
    .select("id, conversation_id, contact_id, applied_at")
    .order("applied_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!rows?.length) return { updated: 0 };

  let updated = 0;
  for (const row of rows) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, created_at, sender_type")
      .eq("conversation_id", row.conversation_id)
      .eq("sender_type", "customer")
      .gt("created_at", row.applied_at)
      .order("created_at", { ascending: true })
      .limit(1);

    const replied = (msgs ?? []).length > 0;
    const repliedAt = msgs?.[0]?.created_at ?? null;

    let ledDeposit = false;
    let ledReservation = false;

    const { data: byConv } = await supabase
      .from("reservations")
      .select("status, deposit_status, created_at, updated_at")
      .eq("conversation_id", row.conversation_id);

    const resList = [...(byConv ?? [])];
    if (row.contact_id) {
      const { data: byContact } = await supabase
        .from("reservations")
        .select("status, deposit_status, created_at, updated_at")
        .eq("contact_id", row.contact_id);
      for (const r of byContact ?? []) {
        if (
          !resList.some(
            (x) =>
              x.status === r.status &&
              x.deposit_status === r.deposit_status &&
              x.created_at === r.created_at
          )
        ) {
          resList.push(r);
        }
      }
    }

    for (const r of resList) {
      const touched =
        r.updated_at >= row.applied_at || r.created_at >= row.applied_at;
      if (!touched) continue;
      if (r.deposit_status === "verified") ledDeposit = true;
      if (RESERVATION_WON.has(r.status)) ledReservation = true;
    }

    const { error: upErr } = await supabase
      .from("suggestion_applications")
      .update({
        customer_replied: replied,
        customer_replied_at: repliedAt,
        led_to_deposit: ledDeposit,
        led_to_reservation: ledReservation,
        outcome_checked_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (!upErr) updated += 1;

    // admin_ai_corrections.led_to_sale senkron
    if (ledReservation) {
      await supabase
        .from("admin_ai_corrections")
        .update({ led_to_sale: true })
        .eq("conversation_id", row.conversation_id)
        .is("led_to_sale", null);
    }
  }

  return { updated };
}

export async function getSuggestionSuccessSnapshot(
  supabase: TypedSupabase
): Promise<SuggestionSuccessSnapshot> {
  try {
    await reconcileSuggestionOutcomes(supabase, { limit: 100 });
  } catch {
    /* tablo yoksa sessiz */
  }

  const { data, error } = await supabase
    .from("suggestion_applications")
    .select(
      "loss_reason, customer_replied, led_to_deposit, led_to_reservation"
    )
    .limit(1000);

  if (error || !data) {
    return {
      applied: 0,
      customerReplied: 0,
      deposits: 0,
      reservations: 0,
      reservationRatePct: 0,
      byLossReason: [],
    };
  }

  const applied = data.length;
  const customerReplied = data.filter((r) => r.customer_replied).length;
  const deposits = data.filter((r) => r.led_to_deposit).length;
  const reservations = data.filter((r) => r.led_to_reservation).length;

  const byReason = new Map<
    string,
    {
      applied: number;
      customerReplied: number;
      deposits: number;
      reservations: number;
    }
  >();

  for (const r of data) {
    const key = r.loss_reason?.trim() || "Belirsiz";
    const cur = byReason.get(key) ?? {
      applied: 0,
      customerReplied: 0,
      deposits: 0,
      reservations: 0,
    };
    cur.applied += 1;
    if (r.customer_replied) cur.customerReplied += 1;
    if (r.led_to_deposit) cur.deposits += 1;
    if (r.led_to_reservation) cur.reservations += 1;
    byReason.set(key, cur);
  }

  const byLossReason = [...byReason.entries()]
    .map(([lossReason, v]) => ({
      lossReason,
      ...v,
      reservationRatePct: pct(v.reservations, v.applied),
    }))
    .sort((a, b) => b.applied - a.applied);

  return {
    applied,
    customerReplied,
    deposits,
    reservations,
    reservationRatePct: pct(reservations, applied),
    byLossReason,
  };
}

export async function recordSuggestionApplication(
  supabase: TypedSupabase,
  input: {
    conversationId: string;
    contactId?: string | null;
    staffMessageId?: string | null;
    lossReason?: string | null;
    suggestionSource:
      | "quality_score"
      | "lost_sale"
      | "follow_up_predict"
      | "manual_edit";
    originalSuggestion: string;
    sentText: string;
    appliedBy?: string | null;
  }
): Promise<string> {
  const { data, error } = await supabase
    .from("suggestion_applications")
    .insert({
      conversation_id: input.conversationId,
      contact_id: input.contactId ?? null,
      staff_message_id: input.staffMessageId ?? null,
      loss_reason: input.lossReason ?? null,
      suggestion_source: input.suggestionSource,
      original_suggestion: input.originalSuggestion,
      sent_text: input.sentText,
      applied_by: input.appliedBy ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}
