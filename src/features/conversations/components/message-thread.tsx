import { MessageSquareOff } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { MessageBubble } from "@/features/conversations/components/message-bubble";
import type { Message } from "@/features/conversations/types";

export function MessageThread({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={MessageSquareOff}
          title="Henüz mesaj yok"
          description="Bu konuşmada henüz hiç mesaj bulunmuyor."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
