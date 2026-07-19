import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/server/supabase/admin";
import { getReservationDetail } from "@/features/reservations/services/reservations.service";
import { ReservationDetailActions } from "@/features/reservations/components/reservation-detail-actions";
import { ReservationStaffAssignPanel } from "@/features/team/components/reservation-staff-assign-panel";
import { resolveRolesForServiceIds } from "@/features/team/services/staff.service";
import { listAssignmentsForReservation } from "@/features/team/repositories/staff.repository";
import type { StaffRoleSlug } from "@/features/team/types";

export const metadata: Metadata = {
  title: "Rezervasyon Detayı — Redmedia AI Panel",
};

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = createAdminClient();
  const detail = await getReservationDetail(supabase, id);
  if (!detail) notFound();

  const { reservation: r, items, changes } = detail;

  const serviceIds = [
    ...new Set(
      items
        .map((i) => i.service_id)
        .filter((sid): sid is string => Boolean(sid))
    ),
  ];
  if (r.selected_service_ids?.length) {
    for (const sid of r.selected_service_ids) {
      if (!serviceIds.includes(sid)) serviceIds.push(sid);
    }
  }

  const [roleSlots, existingAssignments, verifiedReceipt] = await Promise.all([
    serviceIds.length > 0
      ? resolveRolesForServiceIds(supabase, serviceIds)
      : Promise.resolve([]),
    listAssignmentsForReservation(supabase, r.id),
    supabase
      .from("payment_receipts")
      .select("id")
      .eq("reservation_id", r.id)
      .eq("receipt_verified", true)
      .limit(1)
      .maybeSingle()
      .then((res) => res.data),
  ]);

  const candidateStartAt =
    r.effective_busy_start_at ??
    (r.event_date
      ? `${r.event_date}T${(r.start_time ?? "12:00").slice(0, 5)}:00+03:00`
      : new Date().toISOString());
  const fallbackEnd = new Date();
  fallbackEnd.setHours(fallbackEnd.getHours() + 2);
  const candidateEndAt =
    r.effective_busy_end_at ??
    (r.event_date
      ? `${r.event_date}T${(r.end_time ?? "14:00").slice(0, 5)}:00+03:00`
      : fallbackEnd.toISOString());

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link href="/dashboard/reservations" className="text-sm underline">
        Rezervasyonlara dön
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">
          {r.customer_full_name ?? "Rezervasyon"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {r.event_type ?? "—"} · {r.event_date ?? "tarih yok"} · {r.status}
        </p>
      </div>

      <ReservationDetailActions
        reservationId={r.id}
        canConfirmDeposit={Boolean(verifiedReceipt)}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Telefon" value={r.customer_phone ?? "—"} />
        <Info label="Saat" value={r.start_time ?? "SAAT BEKLENİYOR"} />
        <Info
          label="Mekân"
          value={
            r.venue_name ??
            (r.location_status === "unknown" ? "KONUM BEKLENİYOR" : "—")
          }
        />
        <Info
          label="Toplam"
          value={`${Number(r.total_price).toLocaleString("tr-TR")} TL`}
        />
        <Info
          label="Kapora"
          value={`${Number(r.deposit_amount).toLocaleString("tr-TR")} TL (${r.deposit_status})`}
        />
        <Info
          label="Kalan"
          value={`${Number(r.remaining_amount).toLocaleString("tr-TR")} TL (${r.remaining_payment_status})`}
        />
      </section>

      <section className="border-border space-y-2 rounded-lg border p-4">
        <h2 className="font-semibold">Paket / Zaman Planı</h2>
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.id} className="border-border border-b pb-2">
              <div className="font-medium">{item.service_name_snapshot}</div>
              <div className="text-muted-foreground">
                {Number(item.final_price).toLocaleString("tr-TR")} TL · süre{" "}
                {item.service_duration_minutes ?? "—"} dk · yol önce{" "}
                {item.travel_before_minutes} dk
              </div>
              <div className="text-muted-foreground text-xs">
                Efektif meşgul: {item.effective_busy_start_at ?? "—"} →{" "}
                {item.effective_busy_end_at ?? "—"}
              </div>
            </li>
          ))}
          {items.length === 0 ? (
            <li className="text-muted-foreground">Kalem yok.</li>
          ) : null}
        </ul>
      </section>

      <section className="border-border rounded-lg border p-4">
        <ReservationStaffAssignPanel
          reservationId={r.id}
          roleSlots={roleSlots.map((s) => ({
            roleSlug: s.roleSlug as StaffRoleSlug,
            roleLabel: s.roleLabel,
            reason: s.reason,
            quantity: s.quantity,
          }))}
          candidateStartAt={candidateStartAt}
          candidateEndAt={candidateEndAt}
          existingAssignments={existingAssignments.map((a) => ({
            id: a.id,
            staff_member_id: a.staff_member_id,
            assigned_role: a.assigned_role,
            assignment_status: a.assignment_status,
            staff_members: a.staff_members as { full_name: string } | null,
          }))}
        />
      </section>

      <section className="border-border space-y-2 rounded-lg border p-4">
        <h2 className="font-semibold">Değişiklik geçmişi</h2>
        <ul className="space-y-2 text-sm">
          {changes.map((c) => (
            <li key={c.id}>
              <span className="font-medium">{c.field_name}</span> —{" "}
              {c.reason ?? "—"}{" "}
              <span className="text-muted-foreground">
                ({new Date(c.created_at).toLocaleString("tr-TR")})
              </span>
            </li>
          ))}
          {changes.length === 0 ? (
            <li className="text-muted-foreground">Kayıt yok.</li>
          ) : null}
        </ul>
      </section>

      {(r.internal_notes || r.customer_notes) && (
        <section className="border-border space-y-2 rounded-lg border p-4 text-sm">
          <h2 className="font-semibold">Notlar</h2>
          {r.customer_notes ? <p>Müşteri: {r.customer_notes}</p> : null}
          {r.internal_notes ? <p>Admin: {r.internal_notes}</p> : null}
        </section>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
