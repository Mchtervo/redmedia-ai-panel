import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/server/supabase/admin";
import {
  listStaffMembers,
  listStaffRoles,
  mapMemberRoleSlugs,
} from "@/features/team/services/staff.service";
import { listStaffCalendarAssignments } from "@/features/team/repositories/staff.repository";
import { StaffMemberForm } from "@/features/team/components/staff-member-form";
import { STAFF_ROLE_LABELS, type StaffRoleSlug } from "@/features/team/types";

export const metadata: Metadata = { title: "Ekip — Redmedia AI Panel" };

export default async function TeamPage() {
  const supabase = createAdminClient();
  const [members, roles] = await Promise.all([
    listStaffMembers(supabase),
    listStaffRoles(supabase),
  ]);

  const todayDate = new Date();
  const today = todayDate.toISOString().slice(0, 10);
  const in30Date = new Date(todayDate);
  in30Date.setUTCDate(in30Date.getUTCDate() + 30);
  const in30 = in30Date.toISOString().slice(0, 10);
  const upcoming = await listStaffCalendarAssignments(supabase, {
    fromDate: today,
    toDate: in30,
  });

  const todayAssignments = upcoming.filter((a) => {
    const res = a.reservations as { event_date: string | null } | null;
    return res?.event_date === today;
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ekip</h1>
          <p className="text-muted-foreground text-sm">
            Personel, rol ve müsaitlik yönetimi
          </p>
        </div>
        <Link
          href="/dashboard/team/calendar"
          className="text-sm underline-offset-4 hover:underline"
        >
          Personel takvimi
        </Link>
      </div>

      <StaffMemberForm roles={roles} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Ad soyad</th>
              <th className="py-2 pr-3 font-medium">Telefon</th>
              <th className="py-2 pr-3 font-medium">Roller</th>
              <th className="py-2 pr-3 font-medium">Durum</th>
              <th className="py-2 pr-3 font-medium">Bugün</th>
              <th className="py-2 pr-3 font-medium">Yaklaşan</th>
              <th className="py-2 font-medium">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const roleSlugs = mapMemberRoleSlugs(m);
              const myUpcoming = upcoming.filter(
                (a) => a.staff_member_id === m.id
              );
              const myToday = todayAssignments.filter(
                (a) => a.staff_member_id === m.id
              );
              const todayRes = myToday[0]?.reservations as
                | { customer_full_name: string | null; venue_name: string | null }
                | null
                | undefined;
              return (
                <tr key={m.id} className="border-b border-border/60">
                  <td className="py-3 pr-3">
                    <Link
                      href={`/dashboard/team/${m.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {m.full_name}
                    </Link>
                    {m.notes ? (
                      <div className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                        {m.notes}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3">{m.phone ?? "—"}</td>
                  <td className="py-3 pr-3">
                    {roleSlugs
                      .map((s) => STAFF_ROLE_LABELS[s as StaffRoleSlug] ?? s)
                      .join(", ") || "—"}
                  </td>
                  <td className="py-3 pr-3">
                    {m.active ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Aktif
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Pasif</span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {todayRes
                      ? `${todayRes.customer_full_name ?? "Görev"}${todayRes.venue_name ? ` · ${todayRes.venue_name}` : ""}`
                      : myToday.length === 0
                        ? "Müsait"
                        : `${myToday.length} görev`}
                  </td>
                  <td className="py-3 pr-3">{myUpcoming.length}</td>
                  <td className="py-3">{myUpcoming.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {members.length === 0 ? (
          <p className="text-muted-foreground py-6 text-sm">
            Henüz personel yok. Yukarıdan ekleyin.
          </p>
        ) : null}
      </div>
    </div>
  );
}
