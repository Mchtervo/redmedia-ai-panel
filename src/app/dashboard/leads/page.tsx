import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { createAdminClient } from "@/server/supabase/admin";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = { title: "Lead'ler — Redmedia AI Panel" };
export const dynamic = "force-dynamic";

function temperatureTone(
  temp: "cold" | "warm" | "hot" | null
): "neutral" | "info" | "warning" | "danger" {
  if (temp === "hot") return "danger";
  if (temp === "warm") return "warning";
  if (temp === "cold") return "info";
  return "neutral";
}

function temperatureLabel(temp: "cold" | "warm" | "hot" | null): string {
  if (temp === "hot") return "Sıcak";
  if (temp === "warm") return "Ilık";
  if (temp === "cold") return "Soğuk";
  return "—";
}

export default async function LeadsPage() {
  const supabase = createAdminClient();
  const { data: leads, error } = await supabase
    .from("lead_profiles")
    .select(
      "id, contact_id, service_type, lead_score, lead_temperature, reservation_status, event_date, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Lead'ler"
          description="Öğrenme ve attribution ile dolan lead profilleri."
        />
        <p className="text-destructive text-sm">
          Lead listesi yüklenemedi: {error.message}
        </p>
      </div>
    );
  }

  const rows = leads ?? [];
  const contactIds = [...new Set(rows.map((r) => r.contact_id))];
  const { data: contacts } =
    contactIds.length > 0
      ? await supabase
          .from("contacts")
          .select("id, full_name, username")
          .in("id", contactIds)
      : { data: [] as Array<{ id: string; full_name: string | null; username: string | null }> };

  const contactMap = new Map((contacts ?? []).map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead'ler"
        description="Konuşma öğrenmesi ile güncellenen sıcak/ılık/soğuk lead profilleri."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Henüz lead yok"
          description="Konuşmalar öğrenildikçe burada görünecek."
        />
      ) : (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Müşteri</th>
                <th className="px-3 py-2 font-medium">Sıcaklık</th>
                <th className="px-3 py-2 font-medium">Skor</th>
                <th className="px-3 py-2 font-medium">Hizmet</th>
                <th className="px-3 py-2 font-medium">Rezervasyon</th>
                <th className="px-3 py-2 font-medium">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => {
                const contact = contactMap.get(lead.contact_id);
                const name =
                  contact?.full_name ||
                  (contact?.username ? `@${contact.username}` : "İsimsiz");
                return (
                  <tr key={lead.id} className="border-border border-t">
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/customers/${lead.contact_id}`}
                        className="text-primary hover:underline"
                      >
                        {name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        tone={temperatureTone(lead.lead_temperature)}
                      >
                        {temperatureLabel(lead.lead_temperature)}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {lead.lead_score ?? "—"}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">
                      {lead.service_type ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {lead.reservation_status ?? "none"}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">
                      {lead.event_date ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
