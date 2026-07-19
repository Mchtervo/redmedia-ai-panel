"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { DASHBOARD_NAV_GROUPS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Kapalı gruplar cookie'de tutulur (sidebar_state ile aynı desen):
 * sunucu ve istemci aynı başlangıç durumunu görür, hydration uyumsuzluğu olmaz.
 */
export const SIDEBAR_GROUPS_COOKIE = "sidebar_groups";

type AppSidebarProps = {
  /** Sunucuda cookie'den okunan kapalı grup id'leri. */
  defaultCollapsedGroups?: string[];
};

export function AppSidebar({ defaultCollapsedGroups = [] }: AppSidebarProps) {
  const pathname = usePathname();
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>(
    defaultCollapsedGroups
  );

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((current) => {
      const next = current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId];
      document.cookie = `${SIDEBAR_GROUPS_COOKIE}=${encodeURIComponent(
        JSON.stringify(next)
      )}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <div className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-lg shadow-sm">
            <Sparkles aria-hidden className="size-4" />
          </div>
          <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-semibold tracking-tight">
              Redmedia
            </span>
            <span className="text-sidebar-foreground/60 block truncate text-[11px]">
              AI Growth OS
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="scrollbar-thin">
        {DASHBOARD_NAV_GROUPS.map((group) => {
          const isCollapsed = collapsedGroups.includes(group.id);
          const groupHasActive = group.items.some((item) =>
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href)
          );

          return (
            <SidebarGroup key={group.id} className="py-1">
              <SidebarGroupLabel
                render={
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={!isCollapsed}
                    aria-label={`${group.label} bölümünü ${
                      isCollapsed ? "aç" : "kapat"
                    }`}
                  />
                }
                className="w-full cursor-pointer justify-between gap-2 select-none hover:text-sidebar-foreground"
              >
                <span className="truncate">{group.label}</span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-3.5 shrink-0 transition-transform duration-200",
                    isCollapsed && "-rotate-90"
                  )}
                />
              </SidebarGroupLabel>
              {/* İkon moduna daralınca gruplar daima açık kalır. */}
              <SidebarGroupContent
                className={cn(
                  isCollapsed &&
                    "not-group-data-[collapsible=icon]:hidden"
                )}
              >
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive =
                      item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname.startsWith(item.href);

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={<Link href={item.href} />}
                          isActive={isActive}
                          tooltip={item.label}
                          className={cn(
                            isActive &&
                              "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          )}
                        >
                          <item.icon
                            className={cn(isActive && "text-primary")}
                          />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
              {isCollapsed && groupHasActive ? (
                <p className="text-sidebar-foreground/50 px-2 pb-1 text-[11px] group-data-[collapsible=icon]:hidden">
                  Aktif sayfa bu bölümde
                </p>
              ) : null}
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
