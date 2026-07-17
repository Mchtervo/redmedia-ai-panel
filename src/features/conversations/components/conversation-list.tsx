import { Inbox as InboxIcon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Pagination } from "@/components/dashboard/pagination";
import { ConversationSearchInput } from "@/features/conversations/components/conversation-search-input";
import { ConversationFilters } from "@/features/conversations/components/conversation-filters";
import { ConversationListItem } from "@/features/conversations/components/conversation-list-item";
import type { ListConversationsResult } from "@/features/conversations/types";

type ConversationListProps = {
  result: ListConversationsResult;
  activeConversationId?: string;
  hasActiveFilters: boolean;
  searchParamsForPagination: Record<string, string | undefined>;
};

export function ConversationList({
  result,
  activeConversationId,
  hasActiveFilters,
  searchParamsForPagination,
}: ConversationListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <ConversationSearchInput />
        <ConversationFilters />
      </div>

      <div className="flex-1 overflow-y-auto">
        {result.items.length === 0 ? (
          <div className="p-3">
            <EmptyState
              icon={InboxIcon}
              title={hasActiveFilters ? "Eşleşen konuşma yok" : "Henüz konuşma yok"}
              description={
                hasActiveFilters
                  ? "Arama veya durum filtresini değiştirip tekrar deneyin."
                  : "Instagram/Facebook üzerinden gelen konuşmalar burada listelenecek."
              }
            />
          </div>
        ) : (
          result.items.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === activeConversationId}
            />
          ))
        )}
      </div>

      {result.items.length > 0 ? (
        <div className="border-t border-border p-3">
          <Pagination
            basePath="/dashboard/inbox"
            searchParams={searchParamsForPagination}
            currentPage={result.page}
            totalPages={result.totalPages}
          />
        </div>
      ) : null}
    </div>
  );
}
