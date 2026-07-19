import Link from "next/link";
import { BellRing, CheckCheck } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  userEmail: string;
  unreadNotifications?: number;
  pendingApprovals?: number;
};

function CountBadge({ count, tone }: { count: number; tone: "brand" | "warning" }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
        tone === "brand"
          ? "bg-primary text-primary-foreground"
          : "bg-warning text-warning-foreground"
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AppHeader({
  userEmail,
  unreadNotifications = 0,
  pendingApprovals = 0,
}: AppHeaderProps) {
  return (
    <header className="bg-background/80 sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 backdrop-blur-md sm:px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <CommandPalette />
      <div className="ml-auto flex items-center gap-1.5">
        <Link
          href="/dashboard/approvals"
          aria-label={
            pendingApprovals > 0
              ? `Onay kuyruğu: ${pendingApprovals} bekleyen talep`
              : "Onay kuyruğu"
          }
          className="hover:bg-muted focus-visible:ring-ring/50 relative flex size-8 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2"
        >
          <CheckCheck aria-hidden className="size-4" />
          <CountBadge count={pendingApprovals} tone="warning" />
        </Link>
        <Link
          href="/dashboard/notifications"
          aria-label={
            unreadNotifications > 0
              ? `Bildirimler: ${unreadNotifications} okunmamış`
              : "Bildirimler"
          }
          className="hover:bg-muted focus-visible:ring-ring/50 relative flex size-8 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2"
        >
          <BellRing aria-hidden className="size-4" />
          <CountBadge count={unreadNotifications} tone="brand" />
        </Link>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <span className="text-muted-foreground hidden max-w-40 truncate text-xs sm:inline">
          {userEmail}
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
