import type { Database } from "@/types/database";
import type { Contact } from "@/features/contacts/types";

export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type ConversationStatus = Conversation["status"];
export type ConversationChannel = Conversation["channel"];

export const CONVERSATION_STATUS_VALUES = [
  "open",
  "pending",
  "closed",
] as const satisfies readonly ConversationStatus[];

export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type MessageDirection = Message["direction"];
export type MessageSenderType = Message["sender_type"];

export type AiRun = Database["public"]["Tables"]["ai_runs"]["Row"];

/** Panel'de gösterilecek personel bilgisi (assigned_to için). */
export type AssignedProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
};

/** Konuşma listesi/detayı için `contacts` + `profiles` join'lenmiş hâli. */
export type ConversationWithRelations = Conversation & {
  contact: Contact | null;
  assignee: AssignedProfile | null;
};

export type ListConversationsResult = {
  items: ConversationWithRelations[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ConversationDetail = {
  conversation: ConversationWithRelations;
  messages: Message[];
  aiRuns: AiRun[];
};
