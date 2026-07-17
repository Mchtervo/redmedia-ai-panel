import Link from "next/link";
import { UserX } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";

export default function CustomerNotFound() {
  return (
    <div className="flex flex-col gap-4">
      <EmptyState
        icon={UserX}
        title="Müşteri bulunamadı"
        description="Bu müşteri silinmiş veya bağlantı hatalı olabilir."
      />
      <Button variant="outline" size="sm" className="w-fit" render={<Link href="/dashboard/customers" />}>
        Müşterilere dön
      </Button>
    </div>
  );
}
