import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getContactById,
  listContacts,
  type ContactRowWithConversations,
} from "@/features/contacts/repositories/contacts.repository";
import { getCustomerProfileByContactId } from "@/features/customer-intelligence/repositories/customer-profiles.repository";
import {
  listAdminNotes,
  listTimelineEvents,
} from "@/features/smart-sales/repositories/smart-sales.repository";
import { listMessagesByConversation } from "@/features/conversations/repositories/messages.repository";
import type {
  ContactListItem,
  ContactStatus,
  ListContactsResult,
} from "@/features/contacts/types";
import type { CustomerProfile } from "@/features/customer-intelligence/types";
import { getAttributionByContactId } from "@/features/marketing/services/attribution.service";

type TypedSupabaseClient = SupabaseClient<Database>;

export const CONTACTS_PAGE_SIZE = 20;

export type ListCustomersParams = {
  search?: string;
  status?: ContactStatus;
  page: number;
};

/**
 * İlişkili `conversations` embed dizisinden en güncel `last_message_at`
 * değerini türetir.
 */
function toContactListItem(row: ContactRowWithConversations): ContactListItem {
  const { conversations, ...contact } = row;

  const lastMessageAt = (conversations ?? []).reduce<string | null>(
    (latest, conversation) => {
      if (!conversation.last_message_at) {
        return latest;
      }
      if (!latest || conversation.last_message_at > latest) {
        return conversation.last_message_at;
      }
      return latest;
    },
    null
  );

  return { ...contact, lastMessageAt };
}

export async function listCustomers(
  supabase: TypedSupabaseClient,
  { search, status, page }: ListCustomersParams
): Promise<ListContactsResult> {
  const { rows, count } = await listContacts(supabase, {
    search,
    status,
    page,
    pageSize: CONTACTS_PAGE_SIZE,
  });

  return {
    items: rows.map(toContactListItem),
    totalCount: count,
    page,
    pageSize: CONTACTS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(count / CONTACTS_PAGE_SIZE)),
  };
}

export type CustomerDetailBundle = {
  contact: ContactListItem;
  crmProfile: CustomerProfile | null;
  timelineEvents: Awaited<ReturnType<typeof listTimelineEvents>>;
  adminNotes: Awaited<ReturnType<typeof listAdminNotes>>;
  recentMessages: Array<{
    id: string;
    sender_type: string;
    content: string | null;
    created_at: string;
  }>;
  attribution: Awaited<ReturnType<typeof getAttributionByContactId>>;
};

export async function getCustomerDetail(
  supabase: TypedSupabaseClient,
  id: string
): Promise<CustomerDetailBundle | null> {
  const row = await getContactById(supabase, id);
  if (!row) {
    return null;
  }

  const crmProfile = await getCustomerProfileByContactId(supabase, id);
  const [timelineEvents, adminNotes, convResult, attribution] = await Promise.all([
    listTimelineEvents(supabase, id),
    listAdminNotes(supabase, id),
    supabase
      .from("conversations")
      .select("id")
      .eq("contact_id", id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    getAttributionByContactId(supabase, id),
  ]);

  let recentMessages: CustomerDetailBundle["recentMessages"] = [];
  const primaryConversationId = convResult.data?.id;

  if (primaryConversationId) {
    const msgs = await listMessagesByConversation(
      supabase,
      primaryConversationId
    );
    recentMessages = msgs.slice(-40).map((m) => ({
      id: m.id,
      sender_type: m.sender_type,
      content: m.content,
      created_at: m.created_at,
    }));
  }

  return {
    contact: toContactListItem(row),
    crmProfile,
    timelineEvents,
    adminNotes,
    recentMessages,
    attribution,
  };
}
