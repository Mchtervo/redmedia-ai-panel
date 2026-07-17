import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import { listInboxConversations } from "@/features/conversations/services/conversations.service";
import { parseListConversationsQuery } from "@/features/conversations/validators/list-conversations-query";
import { InboxShell } from "@/features/conversations/components/inbox-shell";
import { ConversationList } from "@/features/conversations/components/conversation-list";
import { EmptyConversationPanel } from "@/features/conversations/components/empty-conversation-panel";

export const metadata: Metadata = { title: "Inbox — Redmedia AI Panel" };

type InboxPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const rawSearchParams = await searchParams;
  const query = parseListConversationsQuery(rawSearchParams);

  // İnternal panel içi okuma: bkz. app/dashboard/customers/page.tsx'teki not
  // (service role, RLS henüz personel rol politikaları içermediği için).
  const supabase = createAdminClient();
  const result = await listInboxConversations(supabase, query);

  const hasActiveFilters = Boolean(query.search || query.status);

  return (
    <div className="flex h-full flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Instagram ve Facebook üzerinden gelen konuşmalarınız.
        </p>
      </div>

      <InboxShell
        sidebar={
          <ConversationList
            result={result}
            hasActiveFilters={hasActiveFilters}
            searchParamsForPagination={{ q: query.search, status: query.status }}
          />
        }
      >
        <EmptyConversationPanel />
      </InboxShell>
    </div>
  );
}
