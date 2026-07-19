import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/server/supabase/admin";
import { listReservationsForCalendar } from "@/features/reservations/services/reservations.service";
import { listActiveServices } from "@/features/catalog/repositories/catalog.repository";
import { listActivePlateaus } from "@/features/plateaus/repositories/plateaus.repository";
import { ManualReservationForm } from "@/features/reservations/components/manual-reservation-form";

export const metadata: Metadata = {
  title: "Rezervasyonlar — Redmedia AI Panel",
};

const STATUS_TR: Record<string, string> = {
  draft: "Taslak",
  inquiry: "Talep",
  confirmed: "Kesin",
  deposit_pending: "Kapora bekleniyor",
  payment_review: "Ödeme inceleme",
  completed: "Tamamlandı",
  cancelled: "İptal",
  lost: "Kayıp",
  shoot_completed: "Çekim bitti",
};

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string }>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const statusFilter =
    params.status === "confirmed" ||
    params.status === "draft" ||
    params.status === "inquiry" ||
    params.status === "deposit_pending" ||
    params.status === "payment_review" ||
    params.status === "completed" ||
    params.status === "cancelled" ||
    params.status === "lost" ||
    params.status === "shoot_completed" ||
    params.status === "availability_check" ||
    params.status === "pending_customer"
      ? params.status
      : undefined;
  const [reservations, services, plateaus] = await Promise.all([
    listReservationsForCalendar(supabase, {
      status: statusFilter,
    }),
    listActiveServices(supabase),
    listActivePlateaus(supabase),
  ]);

  const view = params.view ?? "list";
  const upcoming = reservations.filter(
    (r) => r.event_date && r.status === "confirmed"
  );
  const paymentPending = reservations.filter((r) =>
    ["deposit_pending", "payment_review"].includes(r.status)
  );

  const rows =
    view === "upcoming"
      ? upcoming
      : view === "payments"
        ? paymentPending
        : reservations;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rezervasyonlar</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Takvim, ödeme bekleyenler ve manuel rezervasyon.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link className="underline" href="/dashboard/reservations?view=list">
          Liste
        </Link>
        <Link className="underline" href="/dashboard/reservations?view=upcoming">
          Yaklaşan çekimler
        </Link>
        <Link className="underline" href="/dashboard/reservations?view=payments">
          Ödeme bekleyenler
        </Link>
      </div>

      <section className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b">
              <th className="py-2 pr-2">Müşteri</th>
              <th className="py-2 pr-2">Tür</th>
              <th className="py-2 pr-2">Tarih</th>
              <th className="py-2 pr-2">Saat</th>
              <th className="py-2 pr-2">Mekân</th>
              <th className="py-2 pr-2">Toplam</th>
              <th className="py-2 pr-2">Kapora</th>
              <th className="py-2 pr-2">Kalan</th>
              <th className="py-2 pr-2">Durum</th>
              <th className="py-2">Kaynak</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-border border-b">
                <td className="py-2 pr-2">
                  <Link
                    className="underline"
                    href={`/dashboard/reservations/${row.id}`}
                  >
                    {row.customer_full_name ?? "—"}
                  </Link>
                  <div className="text-muted-foreground text-xs">
                    {row.customer_phone ?? ""}
                  </div>
                </td>
                <td className="py-2 pr-2">{row.event_type ?? "—"}</td>
                <td className="py-2 pr-2">{row.event_date ?? "—"}</td>
                <td className="py-2 pr-2">
                  {row.start_time ?? "SAAT BEKLENİYOR"}
                </td>
                <td className="py-2 pr-2">
                  {row.venue_name ??
                    (row.location_status === "unknown"
                      ? "KONUM BEKLENİYOR"
                      : "—")}
                </td>
                <td className="py-2 pr-2 tabular-nums">
                  {Number(row.total_price).toLocaleString("tr-TR")} TL
                </td>
                <td className="py-2 pr-2">{row.deposit_status}</td>
                <td className="py-2 pr-2 tabular-nums">
                  {Number(row.remaining_amount).toLocaleString("tr-TR")} TL
                </td>
                <td className="py-2 pr-2">
                  {STATUS_TR[row.status] ?? row.status}
                </td>
                <td className="py-2">{row.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">Kayıt yok.</p>
        ) : null}
      </section>

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-base font-semibold">Manuel rezervasyon</h2>
        <ManualReservationForm
          services={services.map((s) => ({
            id: s.id,
            name: s.name,
            base_price: Number(s.base_price),
          }))}
          plateaus={plateaus.map((p) => ({ id: p.id, name: p.name }))}
        />
      </section>
    </div>
  );
}
