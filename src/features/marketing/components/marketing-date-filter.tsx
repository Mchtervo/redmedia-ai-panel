"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { DatePreset } from "@/features/marketing/types";
import { Button } from "@/components/ui/button";

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Bugün" },
  { id: "last_7", label: "Son 7 gün" },
  { id: "last_30", label: "Son 30 gün" },
  { id: "last_90", label: "Son 90 gün" },
];

export function MarketingDateFilter({ current }: { current: DatePreset }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setPreset(preset: DatePreset) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", preset);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p.id}
          type="button"
          size="sm"
          variant={current === p.id ? "default" : "outline"}
          onClick={() => setPreset(p.id)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
