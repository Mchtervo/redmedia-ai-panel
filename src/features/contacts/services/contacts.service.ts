import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getContactById,
  listContacts,
  type ContactRowWithConversations,
} from "@/features/contacts/repositories/contacts.repository";
import type {
  ContactListItem,
  ContactStatus,
  ListContactsResult,
} from "@/features/contacts/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export const CONTACTS_PAGE_SIZE = 20;

export type ListCustomersParams = {
  search?: string;
  status?: ContactStatus;
  page: number;
};

/**
 * İlişkili `conversations` embed dizisinden en güncel `last_message_at`
 * değerini türetir. Bu, tabloda gösterilecek tek bir "son mesaj tarihi"
 * alanı üretmek için repository'nin ham sorgu sonucunu işleyen iş
 * mantığıdır — sorgunun kendisi repository'de kalır (bkz.
 * `.cursor/rules/03-database.mdc`).
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

export async function getCustomerDetail(
  supabase: TypedSupabaseClient,
  id: string
): Promise<ContactListItem | null> {
  const row = await getContactById(supabase, id);
  return row ? toContactListItem(row) : null;
}
