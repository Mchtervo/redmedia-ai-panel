import type { Metadata } from "next";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard — Redmedia AI Panel",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Giriş başarılı — <span className="text-foreground">{data.user?.email}</span>
      </p>
    </div>
  );
}
