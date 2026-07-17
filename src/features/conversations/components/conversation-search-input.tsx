"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 400;

// Sidebar (arama/filtre) hem /dashboard/inbox hem /dashboard/inbox/[id]
// altında render edilir; filtre değiştiğinde her zaman liste köküne
// dönülür (detay sayfasının kendi searchParams'ı yoktur).
const INBOX_LIST_PATH = "/dashboard/inbox";

export function ConversationSearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function handleChange(next: string) {
    setValue(next);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = next.trim();

      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      params.delete("page");

      router.push(`${INBOX_LIST_PATH}?${params.toString()}`);
    }, DEBOUNCE_MS);
  }

  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="Müşteri, Instagram veya mesaj ara…"
        className="pl-8"
        aria-label="Konuşma ara"
      />
    </div>
  );
}
