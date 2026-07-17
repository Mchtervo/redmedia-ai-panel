import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { getInboxConversationDetail, listInboxConversations } from "@/features/conversations/services/conversations.service";
import { parseListConversationsQuery } from "@/features/conversations/validators/list-conversations-query";
import { InboxShell } from "@/features/conversations/components/inbox-shell";
import { ConversationList } from "@/features/conversations/components/conversation-list";
import { ConversationHeader } from "@/features/conversations/components/conversation-header";
import { MessageThread } from "@/features/conversations/components/message-thread";
import { ReplyBox } from "@/features/conversations/components/reply-box";

export const metadata: Metadata = { title: "Konuşma — Redmedia AI Panel" };

type ConversationDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ConversationDetailPage({
  params,
  searchParams,
}: ConversationDetailPageProps) {
  const { id } = await params;

  // `id` bir dış girdi (rota parametresi); geçersiz UUID formatında bir
  // Postgres hatası yerine temiz bir 404 dönmesi için önce doğrulanır.
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  const rawSearchParams = await searchParams;
  const query = parseListConversationsQuery(rawSearchParams);

  // Kimlik: oturum bilgisi RLS'e tabi (anon+cookie) istemciyle okunur.
  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getUser();
  if (!authData.user) {
    notFound();
  }

  // Veri okuma: bkz. app/dashboard/customers/page.tsx'teki not (service
  // role, RLS henüz personel rol politikaları içermediği için).
  const supabase = createAdminClient();
  const [detail, listResult] = await Promise.all([
    getInboxConversationDetail(supabase, parsedId.data),
    listInboxConversations(supabase, query),
  ]);

  if (!detail) {
    notFound();
  }

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
            result={listResult}
            activeConversationId={parsedId.data}
            hasActiveFilters={hasActiveFilters}
            searchParamsForPagination={{ q: query.search, status: query.status }}
          />
        }
      >
        <div className="flex h-full flex-col">
          <ConversationHeader
            conversation={detail.conversation}
            currentUserId={authData.user.id}
            aiRunsCount={detail.aiRuns.length}
          />
          <MessageThread messages={detail.messages} />
          <ReplyBox conversationId={detail.conversation.id} />
        </div>
      </InboxShell>
    </div>
  );
}
