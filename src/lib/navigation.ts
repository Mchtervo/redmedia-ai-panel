import {
  LayoutDashboard,
  Inbox,
  Users,
  Target,
  CalendarCheck,
  Sparkles,
  Megaphone,
  BarChart3,
  BookOpen,
  Plug,
  UsersRound,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const DASHBOARD_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Inbox", href: "/dashboard/inbox", icon: Inbox },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  { label: "Leads", href: "/dashboard/leads", icon: Target },
  { label: "Reservations", href: "/dashboard/reservations", icon: CalendarCheck },
  { label: "AI", href: "/dashboard/ai", icon: Sparkles },
  { label: "Ads", href: "/dashboard/ads", icon: Megaphone },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Knowledge", href: "/dashboard/knowledge", icon: BookOpen },
  { label: "Integrations", href: "/dashboard/integrations", icon: Plug },
  { label: "Team", href: "/dashboard/team", icon: UsersRound },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];
