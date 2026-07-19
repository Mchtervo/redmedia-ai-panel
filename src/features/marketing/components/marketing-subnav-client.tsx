"use client";

import { usePathname } from "next/navigation";
import { MarketingSubnav } from "@/features/marketing/components/marketing-subnav";

export function MarketingSubnavClient() {
  const pathname = usePathname();
  return <MarketingSubnav pathname={pathname} />;
}
