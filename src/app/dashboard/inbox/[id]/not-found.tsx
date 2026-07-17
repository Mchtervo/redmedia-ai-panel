import Link from "next/link";
import { MessageCircleOff } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";

export default function ConversationNotFound() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <EmptyState
        icon={MessageCircleOff}
        title="Konuşma bulunamadı"
        description="Bu konuşma silinmiş veya bağlantı hatalı olabilir."
      />
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        render={<Link href="/dashboard/inbox" />}
      >
        Inbox&apos;a dön
      </Button>
    </div>
  );
}
