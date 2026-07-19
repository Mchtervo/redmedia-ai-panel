import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AppSidebar,
  SIDEBAR_GROUPS_COOKIE,
} from "@/components/dashboard/app-sidebar";
import { AppHeader } from "@/components/dashboard/app-header";
import { countUnreadNotifications } from "@/features/notifications/services/notifications.service";
import { countPendingApprovals } from "@/features/approvals/repositories/approvals.repository";

async function loadHeaderCounts(): Promise<{
  unreadNotifications: number;
  pendingApprovals: number;
}> {
  // Rozet sayaçları kritik değil; tablolar henüz kurulmamışsa 0 göster.
  try {
    const admin = createAdminClient();
    const [unreadNotifications, pendingApprovals] = await Promise.all([
      countUnreadNotifications(admin),
      countPendingApprovals(admin),
    ]);
    return { unreadNotifications, pendingApprovals };
  } catch {
    return { unreadNotifications: 0, pendingApprovals: 0 };
  }
}

function parseCollapsedGroupsCookie(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const sidebarState = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarState !== "false";
  const collapsedGroups = parseCollapsedGroupsCookie(
    cookieStore.get(SIDEBAR_GROUPS_COOKIE)?.value
  );

  const counts = await loadHeaderCounts();

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar defaultCollapsedGroups={collapsedGroups} />
        <SidebarInset>
          <AppHeader
            userEmail={data.user.email ?? ""}
            unreadNotifications={counts.unreadNotifications}
            pendingApprovals={counts.pendingApprovals}
          />
          <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 sm:p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
