/**
 * DM cevap A/B — konuşma başına sabit varyant.
 * A: mevcut pipeline
 * B: fiyat öncesi örnek/güven vurgusu (Strategist override)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ConversationStrategy } from "@/features/ai/services/conversation-strategist.service";

type TypedSupabase = SupabaseClient<Database>;

export const DEFAULT_REPLY_AB_EXPERIMENT = "dm_reply_v1";

export type ReplyAbVariant = "A" | "B";

function isReplyAbEnabled(): boolean {
  const flag = process.env.AI_REPLY_AB_ENABLED?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  return true;
}

function hashToVariant(conversationId: string): ReplyAbVariant {
  let h = 0;
  for (let i = 0; i < conversationId.length; i++) {
    h = (h * 31 + conversationId.charCodeAt(i)) >>> 0;
  }
  return h % 2 === 0 ? "A" : "B";
}

/**
 * Konuşmaya A/B ata (yoksa oluştur). Lab / conversationId null → null.
 */
export async function ensureReplyAbAssignment(
  supabase: TypedSupabase,
  conversationId: string | null,
  experimentKey = DEFAULT_REPLY_AB_EXPERIMENT
): Promise<{ variant: ReplyAbVariant; experimentKey: string } | null> {
  if (!conversationId || !isReplyAbEnabled()) return null;

  const { data: existing } = await supabase
    .from("reply_ab_assignments")
    .select("variant, experiment_key")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (existing?.variant === "A" || existing?.variant === "B") {
    return {
      variant: existing.variant,
      experimentKey: existing.experiment_key,
    };
  }

  const variant = hashToVariant(conversationId);
  const { error } = await supabase.from("reply_ab_assignments").insert({
    conversation_id: conversationId,
    experiment_key: experimentKey,
    variant,
  });

  if (error) {
    // race: tekrar oku
    const { data: again } = await supabase
      .from("reply_ab_assignments")
      .select("variant, experiment_key")
      .eq("conversation_id", conversationId)
      .maybeSingle();
    if (again?.variant === "A" || again?.variant === "B") {
      return {
        variant: again.variant,
        experimentKey: again.experiment_key,
      };
    }
    console.error("[reply-ab]", error.message);
    return null;
  }

  return { variant, experimentKey };
}

/**
 * Variant B: fiyat sorusunda önce örnek/güven — his değil, kontrollü deney.
 */
export function applyReplyAbToStrategy(
  strategy: ConversationStrategy,
  variant: ReplyAbVariant | null | undefined,
  customerMessage: string
): ConversationStrategy {
  if (variant !== "B") return strategy;

  const asksPrice =
    /fiyat|kaç\s*para|ne\s*kadar|ücret|kaç\s*tl/i.test(customerMessage);

  if (asksPrice && strategy.move === "give_price") {
    return {
      move: "show_example",
      directive:
        "[A/B=B] Şu an önce kısa örnek/referans; fiyatı bir sonraki turda ver.",
      allowPrice: false,
      allowQuestion: true,
      maxLines: 3,
      rationale: "A/B B: örnek → sonra fiyat",
    };
  }

  if (strategy.move === "withhold_price") {
    return {
      ...strategy,
      move: "build_trust",
      directive:
        "[A/B=B] Şu an güven oluştur; fiyat verme; kısa ve samimi ol.",
      rationale: "A/B B: güven önce",
    };
  }

  return strategy;
}

export type ReplyAbStats = {
  experimentKey: string;
  variantA: { conversations: number; reservations: number; rate: number };
  variantB: { conversations: number; reservations: number; rate: number };
  winner: "A" | "B" | "tie" | "insufficient";
};

export async function getReplyAbStats(
  supabase: TypedSupabase,
  experimentKey = DEFAULT_REPLY_AB_EXPERIMENT
): Promise<ReplyAbStats> {
  const { data: tags } = await supabase
    .from("conversation_outcome_tags")
    .select("reply_variant, reservation")
    .eq("ab_experiment_key", experimentKey);

  const rows = tags ?? [];
  const a = rows.filter((r) => r.reply_variant === "A");
  const b = rows.filter((r) => r.reply_variant === "B");
  const aRes = a.filter((r) => r.reservation).length;
  const bRes = b.filter((r) => r.reservation).length;
  const aRate = a.length ? aRes / a.length : 0;
  const bRate = b.length ? bRes / b.length : 0;

  let winner: ReplyAbStats["winner"] = "insufficient";
  if (a.length >= 20 && b.length >= 20) {
    if (Math.abs(aRate - bRate) < 0.02) winner = "tie";
    else winner = aRate > bRate ? "A" : "B";
  }

  return {
    experimentKey,
    variantA: {
      conversations: a.length,
      reservations: aRes,
      rate: Math.round(aRate * 1000) / 10,
    },
    variantB: {
      conversations: b.length,
      reservations: bRes,
      rate: Math.round(bRate * 1000) / 10,
    },
    winner,
  };
}
