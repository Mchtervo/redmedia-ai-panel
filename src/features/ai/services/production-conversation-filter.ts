/**
 * Demo / seed / manuel test konuşmalarını üretim listelerinden ayırır.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  isMessageSource,
  type MessageSource,
} from "@/features/conversations/types/message-source";

type TypedSupabase = SupabaseClient<Database>;

const NON_PRODUCTION_SOURCES = new Set<MessageSource>([
  "seed",
  "manual_test",
  "lab",
  "import",
  "migration",
]);

const PRODUCTION_SOURCES = new Set<MessageSource>([
  "chatplace_mcp",
  "chatplace_webhook",
  "meta_delivery",
]);

export function isNonProductionExternalId(
  externalId: string | null | undefined
): boolean {
  if (!externalId) return false;
  const ext = externalId.trim();
  if (/^seed[-_]/i.test(ext)) return true;
  if (/^(ai-test|ai-dup|prod-token|c-c)/i.test(ext)) return true;
  if (ext.includes("{{")) return true;
  if (/\s/.test(ext)) return true;
  if (/^(demo|test)[-_]/i.test(ext)) return true;
  if (/test/i.test(ext) && !/chatplace/i.test(ext)) return true;
  return false;
}

export function isDemoContactName(
  fullName: string | null | undefined,
  username: string | null | undefined
): boolean {
  const name = `${fullName ?? ""} ${username ?? ""}`.toLocaleLowerCase("tr-TR");
  return (
    name.includes("demo") ||
    name.includes("seed") ||
    /test\s*mü?şteri/.test(name) ||
    /test\s*musteri/.test(name)
  );
}

/**
 * Verilen konuşma id'lerinden yalnızca üretim (gerçek DM) olanları döner.
 */
export async function filterProductionConversationIds(
  supabase: TypedSupabase,
  conversationIds: string[]
): Promise<string[]> {
  if (conversationIds.length === 0) return [];

  const production: string[] = [];
  const CHUNK = 80;

  for (let i = 0; i < conversationIds.length; i += CHUNK) {
    const chunk = conversationIds.slice(i, i + CHUNK);

    const { data: convs, error: cErr } = await supabase
      .from("conversations")
      .select(
        "id, external_conversation_id, contact_id, contact:contacts(full_name, username)"
      )
      .in("id", chunk);
    if (cErr) throw cErr;

    const { data: msgs, error: mErr } = await supabase
      .from("messages")
      .select("conversation_id, source")
      .in("conversation_id", chunk);
    if (mErr) throw mErr;

    const sourcesByConv = new Map<string, Set<string>>();
    for (const m of msgs ?? []) {
      const set = sourcesByConv.get(m.conversation_id) ?? new Set();
      if (m.source) set.add(m.source);
      sourcesByConv.set(m.conversation_id, set);
    }

    for (const c of convs ?? []) {
      if (isNonProductionExternalId(c.external_conversation_id)) continue;

      const contact = c.contact as
        | { full_name: string | null; username: string | null }
        | { full_name: string | null; username: string | null }[]
        | null;
      const one = Array.isArray(contact) ? contact[0] : contact;
      if (isDemoContactName(one?.full_name, one?.username)) continue;

      const sources = sourcesByConv.get(c.id) ?? new Set();
      const sourceList = [...sources].filter(isMessageSource);

      if (sourceList.length === 0) {
        // Mesaj yok / source yok → üretim sayma
        continue;
      }

      const onlyNonProd = sourceList.every((s) =>
        NON_PRODUCTION_SOURCES.has(s)
      );
      if (onlyNonProd) continue;

      const hasProductionSignal = sourceList.some((s) =>
        PRODUCTION_SOURCES.has(s)
      );
      // legacy/unknown ama gerçek ChatPlace id'si varsa kabul
      const looksRealId =
        Boolean(c.external_conversation_id) &&
        !isNonProductionExternalId(c.external_conversation_id);

      if (hasProductionSignal || looksRealId) {
        production.push(c.id);
      }
    }
  }

  return production;
}

/**
 * Tüm Instagram üretim konuşma id'leri (en yeni önce).
 */
export async function listProductionInstagramConversationIds(
  supabase: TypedSupabase,
  options?: { limit?: number }
): Promise<string[]> {
  const limit = options?.limit ?? 500;
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("channel", "instagram")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.id);
  return filterProductionConversationIds(supabase, ids);
}
