import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/server/supabase/admin";
import { getStaffDetailBundle } from "@/features/team/services/staff.service";
import { mapMemberRoleSlugs } from "@/features/team/repositories/staff.repository";
import { StaffMemberForm } from "@/features/team/components/staff-member-form";
import { StaffQuickActions } from "@/features/team/components/staff-quick-actions";
import { STAFF_ROLE_LABELS, type StaffRoleSlug } from "@/features/team/types";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: "Personel detayı — Redmedia AI Panel",
};

export default async function StaffDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = createAdminClient();
  const bundle = await getStaffDetailBundle(supabase, id);
  if (!bundle) notFound();

  const { member, roles, unavailability, assignments } = bundle;
  const roleSlugs = mapMemberRoleSlugs(member);
  const roleIds = (member.staff_member_roles ?? []).map(
    (r) => r.staff_role_id
  );

  const upcoming = assignments.filter((a) => {
    const res = a.reservations as { event_date: string | null; status: string } | null;
    if (!res?.event_date) return false;
    return (
      res.event_date >= new Date().toISOString().slice(0, 10) &&
      a.assignment_status !== "cancelled" &&
      res.status !== "cancelled"
    );
  });
  const completed = assignments.filter(
    (a) => a.assignment_status === "completed"
  );
  const cancelled = assignments.filter(
    (a) => a.assignment_status === "cancelled"
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <Link
          href="/dashboard/team"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          ← Ekibe dön
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{member.full_name}</h1>
        <p className="text-muted-foreground text-sm">
          {roleSlugs
            .map((s) => STAFF_ROLE_LABELS[s as StaffRoleSlug] ?? s)
            .join(" · ") || "Rol yok"}
          {" · "}
          {member.active ? "Aktif" : "Pasif"}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2 text-sm">
          <p>Telefon: {member.phone ?? "—"}</p>
          <p>E-posta: {member.email ?? "—"}</p>
          <p>
            Çalışma:{" "}
            {member.default_start_time?.slice(0, 5) ?? "—"} –{" "}
            {member.default_end_time?.slice(0, 5) ?? "—"}
          </p>
          <p>Notlar: {member.notes ?? "—"}</p>
          <Link
            href={`/dashboard/team/calendar?staff=${member.id}`}
            className="inline-block underline-offset-4 hover:underline"
          >
            Programını görüntüle
          </Link>
        </div>
        <StaffQuickActions staffId={member.id} active={member.active} />
      </div>

      <StaffMemberForm
        roles={roles}
        initial={{
          id: member.id,
          fullName: member.full_name,
          phone: member.phone,
          email: member.email,
          profilePhotoUrl: member.profile_photo_url,
          active: member.active,
          notes: member.notes,
          defaultStartTime: member.default_start_time,
          defaultEndTime: member.default_end_time,
          roleIds,
        }}
      />

      <section className="space-y-2">
        <h2 className="font-medium">İzinler / bloklar</h2>
        <ul className="space-y-1 text-sm">
          {unavailability.map((u) => (
            <li key={u.id} className="rounded border px-3 py-2">
              {u.type}: {new Date(u.start_at).toLocaleString("tr-TR")} →{" "}
              {new Date(u.end_at).toLocaleString("tr-TR")}
              {u.reason ? ` · ${u.reason}` : ""}
            </li>
          ))}
          {unavailability.length === 0 ? (
            <li className="text-muted-foreground">Kayıt yok</li>
          ) : null}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Yaklaşan görevler ({upcoming.length})</h2>
        <AssignmentList rows={upcoming} />
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Tamamlanan ({completed.length})</h2>
        <AssignmentList rows={completed} />
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">İptal ({cancelled.length})</h2>
        <AssignmentList rows={cancelled} />
      </section>
    </div>
  );
}

function AssignmentList({
  rows,
}: {
  rows: Awaited<
    NonNullable<
      Awaited<ReturnType<typeof getStaffDetailBundle>>
    >["assignments"]
  >;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">Kayıt yok</p>;
  }
  return (
    <ul className="space-y-1 text-sm">
      {rows.map((a) => {
        const res = a.reservations as {
          id: string;
          customer_full_name: string | null;
          event_date: string | null;
          start_time: string | null;
          venue_name: string | null;
          status: string;
        } | null;
        return (
          <li key={a.id} className="rounded border px-3 py-2">
            <Link
              href={`/dashboard/reservations/${res?.id ?? ""}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {res?.customer_full_name ?? "Rezervasyon"}
            </Link>
            <div className="text-muted-foreground">
              {res?.event_date} {res?.start_time ?? ""} ·{" "}
              {res?.venue_name ?? "konum yok"} · {a.assigned_role} ·{" "}
              {res?.status}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
