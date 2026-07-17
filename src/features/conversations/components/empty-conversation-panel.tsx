import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export function EmptyConversationPanel() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState
        icon={MessageSquare}
        title="Bir konuşma seçin"
        description="Detaylarını ve mesajlarını görmek için soldaki listeden bir konuşma seçin."
      />
    </div>
  );
}
