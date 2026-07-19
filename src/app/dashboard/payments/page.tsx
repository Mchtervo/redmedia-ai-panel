import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/server/supabase/admin";
import { listPaymentReceipts } from "@/features/payments/services/payments.service";
import { RegisterReceiptForm } from "@/features/payments/components/register-receipt-form";
import { listReservations } from "@/features/reservations/repositories/reservations.repository";

export const metadata: Metadata = { title: "Ödemeler — Redmedia AI Panel" };

export default async function PaymentsPage() {
  const supabase = createAdminClient();
  const [receipts, reservations] = await Promise.all([
    listPaymentReceipts(supabase),
    listReservations(supabase, {}),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ödemeler ve dekontlar</h1>
        <p className="text-muted-foreground text-sm">
          Görsel dekont tek başına payment_confirmed değildir. Admin onayı gerekir.
        </p>
      </div>

      <RegisterReceiptForm
        reservations={reservations.map((r) => ({
          id: r.id,
          label: `${r.customer_full_name ?? "—"} · ${r.event_date ?? "?"}`,
        }))}
      />

      <ul className="space-y-3">
        {receipts.map((r) => (
          <li key={r.id} className="border-border rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <Link
                className="font-medium underline"
                href={`/dashboard/reservations/${r.reservation_id}`}
              >
                Rezervasyon {r.reservation_id.slice(0, 8)}
              </Link>
              <span>{r.status}</span>
            </div>
            <div className="text-muted-foreground mt-1">
              Tutar: {r.detected_amount ?? "—"} · IBAN: {r.detected_iban ?? "—"} ·
              güven: {r.confidence_score ?? "—"} · receipt_verified:{" "}
              {r.receipt_verified ? "evet" : "hayır"} · payment_confirmed:{" "}
              {r.payment_confirmed ? "evet" : "hayır"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
