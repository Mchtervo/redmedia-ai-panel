import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import {
  CUSTOMER_PROFILE_STATUS_LABELS,
  type CustomerProfile,
} from "@/features/customer-intelligence/types";
import { formatTurkishLongDate } from "@/features/ai/prompts/simple-assistant";
import {
  LIFECYCLE_STAGE_LABELS,
  type LifecycleStage,
} from "@/features/smart-sales/types";
import { buildCustomerIntelligenceBrief } from "@/features/intelligence/services/customer-briefs.service";
import { IntelligenceBriefCard } from "@/features/intelligence/components/intelligence-brief-card";

type DetailField = {
  label: string;
  value: string;
};

function Field({ label, value }: DetailField) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

export function CustomerIntelligenceCard({
  profile,
  attribution = null,
}: {
  profile: CustomerProfile;
  attribution?: {
    attribution_status?: string | null;
    attribution_confidence?: number | null;
    source_type?: string | null;
  } | null;
}) {
  const statusLabel = CUSTOMER_PROFILE_STATUS_LABELS[profile.status];
  const lifecycle =
    LIFECYCLE_STAGE_LABELS[
      (profile.lifecycle_stage as LifecycleStage) ?? "new_customer"
    ] ?? profile.lifecycle_stage;
  const services =
    profile.requested_services?.length > 0
      ? profile.requested_services.join(", ")
      : "—";
  const eventDate = profile.event_date
    ? formatTurkishLongDate(profile.event_date)
    : "—";
  const opp = profile.opportunity_score ?? profile.lead_score;
  const brief = buildCustomerIntelligenceBrief(
    profile,
    profile.contact_id,
    attribution
  );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-lg">CRM Bellek</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{lifecycle}</Badge>
          <Badge variant="outline">Opportunity {opp}/100</Badge>
          <Badge variant="outline">{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <IntelligenceBriefCard brief={brief} />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Rezervasyon ihtimali"
            value={
              profile.booking_probability != null
                ? `%${profile.booking_probability}`
                : "—"
            }
          />
          <Field
            label="Etiketler"
            value={
              profile.tags?.length ? profile.tags.join(", ") : "—"
            }
          />
          <Field label="Telefon" value={profile.phone ?? "—"} />
          <Field
            label="Telefon doğrulandı"
            value={profile.phone_verified ? "Evet" : "Hayır"}
          />
          <Field label="Etkinlik türü" value={profile.event_type ?? "—"} />
          <Field label="Etkinlik tarihi" value={eventDate} />
          <Field label="Mekân" value={profile.venue ?? "—"} />
          <Field label="Şehir" value={profile.city || "Ankara"} />
          <Field label="Hizmetler" value={services} />
          <Field label="Bütçe notu" value={profile.budget ?? "—"} />
          <Field label="İtirazlar" value={profile.objections ?? "—"} />
          <Field
            label="Toplam mesaj"
            value={String(profile.total_messages)}
          />
          <Field
            label="Toplam konuşma"
            value={String(profile.total_conversations)}
          />
          <Field label="Son görülme" value={formatDateTime(profile.last_seen)} />
          <Field
            label="Son konuşma özeti"
            value={profile.memory_summary ?? profile.last_summary ?? "—"}
          />
          <Field
            label="Son AI cevabı"
            value={profile.last_ai_response ?? "—"}
          />
        </dl>
      </CardContent>
    </Card>
  );
}
