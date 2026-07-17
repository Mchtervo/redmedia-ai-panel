import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { CustomerStatusBadge } from "@/features/contacts/components/customer-status-badge";
import type { ContactListItem } from "@/features/contacts/types";

type DetailField = {
  label: string;
  value: string;
  href?: string;
};

function Field({ label, value, href }: DetailField) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export function CustomerDetail({ contact }: { contact: ContactListItem }) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/dashboard/customers"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Müşterilere dön
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {contact.full_name ?? "İsimsiz müşteri"}
          </CardTitle>
          <CardAction>
            <CustomerStatusBadge status={contact.status} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Instagram"
              value={contact.username ? `@${contact.username}` : "—"}
              href={contact.username ? `https://instagram.com/${contact.username}` : undefined}
            />
            <Field label="Telefon" value={contact.phone ?? "—"} href={contact.phone ? `tel:${contact.phone}` : undefined} />
            <Field label="E-posta" value={contact.email ?? "—"} href={contact.email ? `mailto:${contact.email}` : undefined} />
            <Field label="Son Mesaj Tarihi" value={formatDateTime(contact.lastMessageAt)} />
            <Field label="İlk Görülme" value={formatDateTime(contact.first_seen_at)} />
            <Field label="Son Görülme" value={formatDateTime(contact.last_seen_at)} />
            <Field label="Kayıt Tarihi" value={formatDateTime(contact.created_at)} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
