import Link from "next/link";
import { cn } from "@/lib/utils";

const LINKS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/dashboard/marketing", label: "Genel Bakış", exact: true },
  { href: "/dashboard/marketing/performance", label: "Reklam Performansı" },
  { href: "/dashboard/marketing/instagram", label: "Instagram İçerikleri" },
  { href: "/dashboard/marketing/attribution", label: "Attribution" },
  { href: "/dashboard/marketing/reports", label: "AI Raporlar" },
  { href: "/dashboard/marketing/strategies", label: "AI Stratejileri" },
  { href: "/dashboard/marketing/experiments", label: "Deneyler" },
  { href: "/dashboard/marketing/memory", label: "Memory" },
  { href: "/dashboard/marketing/connections", label: "Bağlantılar" },
];

export function MarketingSubnav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Marketing alt menü"
      className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 pb-px"
    >
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative shrink-0 rounded-t-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
              active
                ? "text-foreground font-medium after:absolute after:right-2 after:bottom-0 after:left-2 after:h-0.5 after:rounded-full after:bg-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
