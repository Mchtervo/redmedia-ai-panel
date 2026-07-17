import Link from "next/link";
import { Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { formatDateTime } from "@/lib/utils";
import { CustomerStatusBadge } from "@/features/contacts/components/customer-status-badge";
import type { ContactListItem } from "@/features/contacts/types";

type CustomersTableProps = {
  items: ContactListItem[];
  hasActiveFilters: boolean;
};

export function CustomersTable({ items, hasActiveFilters }: CustomersTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={
          hasActiveFilters
            ? "Filtreye uygun müşteri bulunamadı"
            : "Henüz müşteri eklenmemiş"
        }
        description={
          hasActiveFilters
            ? "Arama veya durum filtresini değiştirip tekrar deneyin."
            : "Instagram/Facebook üzerinden gelen müşteriler burada listelenecek."
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ad Soyad</TableHead>
            <TableHead>Instagram</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Son Mesaj Tarihi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((contact) => (
            <TableRow key={contact.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/dashboard/customers/${contact.id}`}
                  className="hover:underline"
                >
                  {contact.full_name ?? "İsimsiz müşteri"}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {contact.username ? `@${contact.username}` : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {contact.phone ?? "—"}
              </TableCell>
              <TableCell>
                <CustomerStatusBadge status={contact.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(contact.lastMessageAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
