import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/server/supabase/admin";
import { listReminderJobs } from "@/features/reminders/services/reminders.service";

export const metadata: Metadata = { title: "Hatırlatmalar — Redmedia AI Panel" };

export default async function RemindersPage() {
  const supabase = createAdminClient();
  const jobs = await listReminderJobs(supabase);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hatırlatmalar</h1>
        <p className="text-muted-foreground text-sm">
          7 / 3 / 1 gün ve çekim günü; eksik saat/konum hatırlatmaları.
        </p>
      </div>
      <ul className="space-y-3">
        {jobs.map((j) => (
          <li key={j.id} className="border-border rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <Link
                className="underline"
                href={`/dashboard/reservations/${j.reservation_id}`}
              >
                {j.reminder_type}
              </Link>
              <span>{j.status}</span>
            </div>
            <div className="text-muted-foreground">
              {new Date(j.scheduled_at).toLocaleString("tr-TR")} · {j.channel}
            </div>
          </li>
        ))}
        {jobs.length === 0 ? (
          <li className="text-muted-foreground text-sm">Hatırlatma yok.</li>
        ) : null}
      </ul>
    </div>
  );
}
