import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LogoutButton } from "@/components/dashboard/logout-button";

type AppHeaderProps = {
  userEmail: string;
};

export function AppHeader({ userEmail }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <span className="truncate text-sm font-semibold">Redmedia AI Panel</span>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden max-w-40 truncate text-sm text-muted-foreground sm:inline">
          {userEmail}
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
