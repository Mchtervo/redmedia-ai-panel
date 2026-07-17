"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTACT_STATUS_VALUES } from "@/features/contacts/types";

const STATUS_LABELS: Record<string, string> = {
  all: "Tüm durumlar",
  active: "Aktif",
  archived: "Arşivlendi",
  blocked: "Engellendi",
};

const ALL_VALUE = "all";

export function CustomersStatusFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? ALL_VALUE;

  function handleChange(next: string | null) {
    if (!next) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());

    if (next === ALL_VALUE) {
      params.delete("status");
    } else {
      params.set("status", next);
    }
    params.delete("page");

    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={currentStatus} onValueChange={handleChange}>
      <SelectTrigger className="w-40" aria-label="Duruma göre filtrele">
        <SelectValue>
          {(value: string | null) => STATUS_LABELS[value ?? ALL_VALUE]}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{STATUS_LABELS[ALL_VALUE]}</SelectItem>
        {CONTACT_STATUS_VALUES.map((status) => (
          <SelectItem key={status} value={status}>
            {STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
