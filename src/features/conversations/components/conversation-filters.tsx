"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { CONVERSATION_STATUS_VALUES } from "@/features/conversations/types";

const ALL_VALUE = "all";

const FILTERS = [
  { value: ALL_VALUE, label: "Tümü" },
  ...CONVERSATION_STATUS_VALUES.map((status) => ({
    value: status,
    label: { open: "Açık", pending: "Bekleyen", closed: "Kapalı" }[status],
  })),
];

// Sidebar hem /dashboard/inbox hem /dashboard/inbox/[id] altında render
// edilir; filtre değiştiğinde her zaman liste köküne dönülür.
const INBOX_LIST_PATH = "/dashboard/inbox";

export function ConversationFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? ALL_VALUE;

  function handleSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === ALL_VALUE) {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    params.delete("page");

    router.push(`${INBOX_LIST_PATH}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Konuşma durumu filtresi">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          role="tab"
          aria-selected={currentStatus === filter.value}
          onClick={() => handleSelect(filter.value)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            currentStatus === filter.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
