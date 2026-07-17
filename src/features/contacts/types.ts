import type { Database } from "@/types/database";

export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type ContactStatus = Contact["status"];

export const CONTACT_STATUS_VALUES = ["active", "archived", "blocked"] as const satisfies readonly ContactStatus[];

/** Panelde gösterilecek, `contacts` + türetilmiş "son mesaj tarihi" birleşimi. */
export type ContactListItem = Contact & {
  lastMessageAt: string | null;
};

export type ListContactsResult = {
  items: ContactListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
