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
import { CustomerIntelligenceCard } from "@/features/customer-intelligence/components/customer-intelligence-card";
import { CustomerSmartSalesPanel } from "@/features/smart-sales/components/customer-smart-sales-panel";
import { CustomerTimeline } from "@/features/smart-sales/components/customer-timeline";
import type { ContactListItem } from "@/features/contacts/types";
import type { CustomerProfile } from "@/features/customer-intelligence/types";
import type { CustomerDetailBundle } from "@/features/contacts/services/contacts.service";
import { CustomerAttributionPanel } from "@/features/marketing/components/customer-attribution-panel";

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

export function CustomerDetail({
  contact,
  crmProfile,
  timelineEvents,
  adminNotes,
  recentMessages,
  attribution,
}: {
  contact: ContactListItem;
  crmProfile: CustomerProfile | null;
  timelineEvents: CustomerDetailBundle["timelineEvents"];
  adminNotes: CustomerDetailBundle["adminNotes"];
  recentMessages: CustomerDetailBundle["recentMessages"];
  attribution: CustomerDetailBundle["attribution"];
}) {
  const phone = crmProfile?.phone ?? contact.phone ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/dashboard/customers"
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm"
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
              href={
                contact.username
                  ? `https://instagram.com/${contact.username}`
                  : undefined
              }
            />
            <Field
              label="Telefon"
              value={phone ?? "—"}
              href={phone ? `tel:${phone}` : undefined}
            />
            <Field
              label="E-posta"
              value={contact.email ?? "—"}
              href={contact.email ? `mailto:${contact.email}` : undefined}
            />
            <Field
              label="Son Mesaj Tarihi"
              value={formatDateTime(contact.lastMessageAt)}
            />
            <Field
              label="İlk Görülme"
              value={formatDateTime(contact.first_seen_at)}
            />
            <Field
              label="Son Görülme"
              value={formatDateTime(contact.last_seen_at)}
            />
            <Field
              label="Kayıt Tarihi"
              value={formatDateTime(contact.created_at)}
            />
          </dl>
        </CardContent>
      </Card>

      {crmProfile ? (
        <>
          <CustomerIntelligenceCard
            profile={crmProfile}
            attribution={attribution}
          />
          <CustomerSmartSalesPanel
            contactId={contact.id}
            lifecycleStage={crmProfile.lifecycle_stage ?? "new_customer"}
            tags={crmProfile.tags ?? []}
            opportunityScore={
              crmProfile.opportunity_score ?? crmProfile.lead_score
            }
          />
        </>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-6 text-sm">
            Bu müşteri için henüz CRM bellek profili oluşmamış. İlk mesajdan
            sonra otomatik oluşturulur.
          </CardContent>
        </Card>
      )}

      <CustomerAttributionPanel
        contactId={contact.id}
        attribution={attribution}
      />

      <CustomerTimeline
        events={timelineEvents}
        messages={recentMessages}
        adminNotes={adminNotes}
      />
    </div>
  );
}
