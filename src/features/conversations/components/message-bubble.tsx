import { cn, formatDateTime } from "@/lib/utils";
import type { Message } from "@/features/conversations/types";

const SENDER_LABELS: Record<Message["sender_type"], string> = {
  customer: "Müşteri",
  staff: "Personel",
  ai: "AI",
  system: "Sistem",
};

export function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === "outbound";
  const isSystem = message.sender_type === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", isOutbound ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap",
          isOutbound
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {message.content ?? (
          <span className="italic opacity-70">[{message.message_type}]</span>
        )}
      </div>
      <span className="px-1 text-xs text-muted-foreground">
        {SENDER_LABELS[message.sender_type]} · {formatDateTime(message.created_at)}
      </span>
    </div>
  );
}
