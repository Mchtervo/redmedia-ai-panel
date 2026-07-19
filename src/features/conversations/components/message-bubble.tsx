import { cn, formatDateTime } from "@/lib/utils";
import type { Message } from "@/features/conversations/types";
import { isJunkInboundMessageContent } from "@/features/conversations/validators/inbound-message-content";

const SENDER_LABELS: Record<Message["sender_type"], string> = {
  customer: "Müşteri",
  staff: "Personel",
  ai: "AI",
  system: "Sistem",
};

function displayContent(message: Message): string {
  const raw = message.content?.trim() ?? "";
  if (!raw) {
    return `[${message.message_type || "boş mesaj"}]`;
  }
  if (isJunkInboundMessageContent(raw)) {
    return "[ChatPlace değişken hatası — gerçek metin gelmedi. «Mesajları Yenile» deneyin]";
  }
  return raw;
}

export function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === "outbound";
  const isSystem = message.sender_type === "system";
  const text = displayContent(message);
  const isPlaceholder =
    !message.content?.trim() || isJunkInboundMessageContent(message.content);

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {text}
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
            : "bg-muted text-foreground",
          isPlaceholder && "italic opacity-80"
        )}
      >
        {text}
      </div>
      <span className="px-1 text-xs text-muted-foreground">
        {SENDER_LABELS[message.sender_type]} · {formatDateTime(message.created_at)}
      </span>
    </div>
  );
}
