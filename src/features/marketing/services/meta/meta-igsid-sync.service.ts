/**
 * Meta conversation participant IGSID → contacts.meta_igsid eşlemesi.
 *
 * Bu Page'de conversations `paging.next` / `after` çağrıları Timeout veriyor
 * (limit=1 ilk sayfa OK). Bu yüzden:
 * - cron/backfill: yalnızca ilk N konuşmayı dener (next başarısız olursa durur)
 * - webhook sonrası: en güncel thread'ten aktif müşterinin IGSID'sini yakalar
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { resolveMetaAccessToken } from "@/features/marketing/services/meta/token.service";
import {
  graphGet,
  MetaGraphError,
} from "@/features/marketing/services/meta/graph-client";
import { resolvePageAccessToken } from "@/features/marketing/services/meta/page-resolve.service";
import { envIgAccountId } from "@/features/marketing/services/meta/meta-mappers";

type TypedSupabaseClient = SupabaseClient<Database>;

export type MetaIgsidSyncResult = {
  conversationsScanned: number;
  participantsFound: number;
  matched: number;
  updated: number;
  skippedOwnAccount: number;
  unmatchedUsernames: number;
  stoppedEarly: boolean;
  stopReason: string | null;
};

export function normalizeIgUsername(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/^@+/, "").toLowerCase();
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function graphGetRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await sleep(600 * i);
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

type PageAccess = Awaited<ReturnType<typeof resolvePageAccessToken>>;

async function loadContactUsernameMap(supabase: TypedSupabaseClient) {
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id,username,meta_igsid")
    .not("username", "is", null)
    .limit(5000);
  if (error) throw error;

  const map = new Map<string, { id: string; meta_igsid: string | null }>();
  for (const contact of contacts ?? []) {
    const key = normalizeIgUsername(contact.username);
    if (!key || map.has(key)) continue;
    map.set(key, { id: contact.id, meta_igsid: contact.meta_igsid });
  }
  return map;
}

async function applyParticipants(params: {
  supabase: TypedSupabaseClient;
  page: PageAccess;
  participants: Array<{ id?: string; username?: string }>;
  contactByUsername: Map<string, { id: string; meta_igsid: string | null }>;
  result: MetaIgsidSyncResult;
  seenUsernames: Set<string>;
  /** Yalnızca bu username güncellensin (webhook hedefi) */
  onlyUsername?: string | null;
}) {
  const ownIgId = params.page.igBusinessAccountId || envIgAccountId() || null;
  const only = normalizeIgUsername(params.onlyUsername);

  for (const p of params.participants) {
    const igsid = p.id?.trim();
    const username = normalizeIgUsername(p.username);
    if (!igsid || !/^\d{5,}$/.test(igsid)) continue;
    if (ownIgId && igsid === ownIgId) {
      params.result.skippedOwnAccount += 1;
      continue;
    }
    params.result.participantsFound += 1;
    if (!username) continue;
    if (only && username !== only) continue;
    if (params.seenUsernames.has(username)) continue;
    params.seenUsernames.add(username);

    const contact = params.contactByUsername.get(username);
    if (!contact) {
      params.result.unmatchedUsernames += 1;
      continue;
    }
    params.result.matched += 1;
    if (contact.meta_igsid === igsid) continue;

    const { error: upErr } = await params.supabase
      .from("contacts")
      .update({ meta_igsid: igsid })
      .eq("id", contact.id);
    if (upErr) continue;

    contact.meta_igsid = igsid;
    params.result.updated += 1;
  }
}

/**
 * En güncel Instagram thread'inden IGSID yakala.
 * ChatPlace inbound sonrası çağrılır — genelde son mesaj atan kişi 1. sıradadır.
 */
export async function captureMetaIgsidFromLatestThread(
  supabase: TypedSupabaseClient,
  opts?: { usernameHint?: string | null }
): Promise<MetaIgsidSyncResult> {
  const result: MetaIgsidSyncResult = {
    conversationsScanned: 0,
    participantsFound: 0,
    matched: 0,
    updated: 0,
    skippedOwnAccount: 0,
    unmatchedUsernames: 0,
    stoppedEarly: false,
    stopReason: null,
  };

  try {
    const resolved = await resolveMetaAccessToken(supabase);
    if (!resolved) {
      result.stoppedEarly = true;
      result.stopReason = "token_missing";
      return result;
    }

    const page = await resolvePageAccessToken(resolved.accessToken);
    const contactByUsername = await loadContactUsernameMap(supabase);
    const seenUsernames = new Set<string>();

    const list = await graphGetRetry(() =>
      graphGet<{ data?: Array<{ id?: string }> }>({
        accessToken: page.pageAccessToken,
        path: `${page.pageId}/conversations`,
        params: {
          platform: "instagram",
          fields: "id",
          limit: 1,
        },
      })
    );

    const threadId = list.data?.[0]?.id;
    if (!threadId) return result;
    result.conversationsScanned = 1;

    const detail = await graphGetRetry(() =>
      graphGet<{
        participants?: {
          data?: Array<{ id?: string; username?: string }>;
        };
      }>({
        accessToken: page.pageAccessToken,
        path: threadId,
        params: { fields: "participants" },
      })
    );

    await applyParticipants({
      supabase,
      page,
      participants: detail.participants?.data ?? [],
      contactByUsername,
      result,
      seenUsernames,
      onlyUsername: opts?.usernameHint,
    });
  } catch (e) {
    result.stoppedEarly = true;
    result.stopReason =
      e instanceof Error ? e.message.slice(0, 200) : "capture_failed";
  }

  return result;
}

/**
 * Meta Instagram konuşmalarından participant IGSID toplar.
 * Pagination bu hesapta Timeout verdiği için next başarısız olursa durur.
 */
export async function syncMetaIgsidsFromConversations(
  supabase: TypedSupabaseClient,
  opts?: { maxConversations?: number }
): Promise<MetaIgsidSyncResult> {
  const maxConversations = opts?.maxConversations ?? 15;
  const result: MetaIgsidSyncResult = {
    conversationsScanned: 0,
    participantsFound: 0,
    matched: 0,
    updated: 0,
    skippedOwnAccount: 0,
    unmatchedUsernames: 0,
    stoppedEarly: false,
    stopReason: null,
  };

  const resolved = await resolveMetaAccessToken(supabase);
  if (!resolved) {
    throw new MetaGraphError("Aktif Meta OAuth token yok.", {
      code: "token_missing",
      httpStatus: 0,
    });
  }

  const page = await resolvePageAccessToken(resolved.accessToken);
  const contactByUsername = await loadContactUsernameMap(supabase);
  const seenUsernames = new Set<string>();
  let after: string | undefined;

  while (result.conversationsScanned < maxConversations) {
    let list: {
      data?: Array<{ id?: string }>;
      paging?: { cursors?: { after?: string }; next?: string };
    };

    try {
      list = await graphGetRetry(() =>
        graphGet({
          accessToken: page.pageAccessToken,
          path: `${page.pageId}/conversations`,
          params: {
            platform: "instagram",
            fields: "id",
            limit: 1,
            after,
          },
        })
      );
    } catch (e) {
      result.stoppedEarly = true;
      result.stopReason =
        e instanceof Error ? e.message.slice(0, 200) : "list failed";
      break;
    }

    const threadId = list.data?.[0]?.id;
    if (!threadId) break;
    result.conversationsScanned += 1;

    try {
      const detail = await graphGetRetry(() =>
        graphGet<{
          participants?: {
            data?: Array<{ id?: string; username?: string }>;
          };
        }>({
          accessToken: page.pageAccessToken,
          path: threadId,
          params: { fields: "participants" },
        })
      );

      await applyParticipants({
        supabase,
        page,
        participants: detail.participants?.data ?? [],
        contactByUsername,
        result,
        seenUsernames,
      });
    } catch {
      // tek thread atlanır
    }

    after = list.paging?.cursors?.after;
    if (!after || !list.paging?.next) break;

    // 2. sayfa bu hesapta genelde Timeout — bir deneme, olmazsa dur
    await sleep(400);
  }

  return result;
}
