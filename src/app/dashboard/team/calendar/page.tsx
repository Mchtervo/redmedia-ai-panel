import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/server/supabase/admin";
import {
  listStaffCalendarAssignments,
  listStaffMembers,
} from "@/features/team/repositories/staff.repository";
import { STAFF_ROLE_LABELS, type StaffRoleSlug } from "@/features/team/types";

export const metadata: Metadata = {
  title: "Personel takvimi — Redmedia AI Panel",
};

type Props = {
  searchParams: Promise<{ staff?: string; view?: string }>;
};

export default async function TeamCalendarPage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = createAdminClient();
  const members = await listStaffMembers(supabase);

  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 7);
  const to = new Date(today);
  to.setDate(to.getDate() + 30);

  const fromDate = from.toISOString().slice(0, 10);
  const toDate = to.toISOString().slice(0, 10);

  const assignments = await listStaffCalendarAssignments(supabase, {
    fromDate,
    toDate,
    staffMemberId: sp.staff || undefined,
  });

  const byDate = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const res = a.reservations as { event_date: string | null } | null;
    const d = res?.event_date ?? "bilinmeyen";
    const list = byDate.get(d) ?? [];
    list.push(a);
    byDate.set(d, list);
  }

  const dates = [...byDate.keys()].sort();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/dashboard/team"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            ← Ekibe dön
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Personel takvimi</h1>
          <p className="text-muted-foreground text-sm">
            {fromDate} → {toDate} · yol/hazırlık blokları rezervasyon
            effective_busy içinde
          </p>
        </div>
      </div>

      <form className="flex flex-wrap gap-2">
        <select
          name="staff"
          defaultValue={sp.staff ?? ""}
          className="border-input bg-background rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Tüm ekip</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm"
        >
          Filtrele
        </button>
      </form>

      <div className="space-y-4">
        {dates.map((date) => (
          <section key={date} className="space-y-2">
            <h2 className="font-medium">
              {new Date(`${date}T12:00:00`).toLocaleDateString("tr-TR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h2>
            <ul className="space-y-2">
              {(byDate.get(date) ?? []).map((a) => {
                const res = a.reservations as {
                  id: string;
                  customer_full_name: string | null;
                  start_time: string | null;
                  end_time: string | null;
                  venue_name: string | null;
                  status: string;
                  effective_busy_start_at: string | null;
                  effective_busy_end_at: string | null;
                  customer_phone: string | null;
                } | null;
                const staff = a.staff_members as {
                  full_name: string;
                } | null;
                return (
                  <li
                    key={a.id}
                    className="rounded-lg border px-3 py-3 text-sm"
                  >
                    <div className="font-medium">
                      {staff?.full_name ?? "—"} ·{" "}
                      {STAFF_ROLE_LABELS[a.assigned_role as StaffRoleSlug] ??
                        a.assigned_role}
                    </div>
                    <div>
                      <Link
                        href={`/dashboard/reservations/${res?.id ?? ""}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {res?.customer_full_name ?? "Müşteri"}
                      </Link>
                      {" · "}
                      {res?.start_time ?? "saat yok"}–
                      {res?.end_time ?? "—"}
                      {" · "}
                      {res?.venue_name ?? "konum yok"}
                      {" · "}
                      {res?.status}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Meşgul pencere:{" "}
                      {res?.effective_busy_start_at
                        ? new Date(res.effective_busy_start_at).toLocaleTimeString(
                            "tr-TR",
                            { hour: "2-digit", minute: "2-digit" }
                          )
                        : "—"}{" "}
                      →{" "}
                      {res?.effective_busy_end_at
                        ? new Date(res.effective_busy_end_at).toLocaleTimeString(
                            "tr-TR",
                            { hour: "2-digit", minute: "2-digit" }
                          )
                        : "—"}
                      {res?.customer_phone
                        ? ` · Tel: ${res.customer_phone}`
                        : ""}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {dates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Bu aralıkta atama yok.
          </p>
        ) : null}
      </div>
    </div>
  );
}
