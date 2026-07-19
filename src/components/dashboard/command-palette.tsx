"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import {
  DASHBOARD_NAV_GROUPS,
  type NavItem,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

type PaletteEntry = NavItem & { groupLabel: string };

const ALL_ENTRIES: PaletteEntry[] = DASHBOARD_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupLabel: group.label }))
);

function normalize(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

function matches(entry: PaletteEntry, query: string): boolean {
  const q = normalize(query);
  if (normalize(entry.label).includes(q)) return true;
  if (normalize(entry.groupLabel).includes(q)) return true;
  return (entry.keywords ?? []).some((k) => normalize(k).includes(q));
}

/**
 * Komut paleti: Ctrl/Cmd+K ile açılır, tüm sayfalarda arama + hızlı geçiş.
 * Klavye: ↑↓ seçim, Enter git, Esc kapat.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return ALL_ENTRIES;
    return ALL_ENTRIES.filter((entry) => matches(entry, query.trim()));
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const navigateTo = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") {
        close();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    const activeEl = listRef.current?.querySelector('[data-active="true"]');
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = results[activeIndex];
      if (target) navigateTo(target.href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-input bg-background text-muted-foreground hover:bg-muted focus-visible:ring-ring/50 hidden h-8 w-56 items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors outline-none focus-visible:ring-2 md:flex"
        aria-label="Sayfa ara (Ctrl+K)"
      >
        <Search aria-hidden className="size-3.5 shrink-0" />
        <span className="flex-1 truncate text-left text-xs">Sayfa ara…</span>
        <kbd className="bg-muted text-muted-foreground pointer-events-none rounded border border-border px-1.5 font-mono text-[10px]">
          Ctrl K
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hover:bg-muted focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 md:hidden"
        aria-label="Sayfa ara"
      >
        <Search aria-hidden className="size-4" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 p-4 pt-[14vh] backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Komut paleti"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="bg-popover text-popover-foreground animate-rise w-full max-w-lg overflow-hidden rounded-xl border border-border shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-border px-3.5">
              <Search aria-hidden className="text-muted-foreground size-4 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder="Sayfa veya bölüm ara…"
                aria-label="Sayfa veya bölüm ara"
                className="placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-none"
              />
              <kbd className="bg-muted text-muted-foreground pointer-events-none shrink-0 rounded border border-border px-1.5 font-mono text-[10px]">
                Esc
              </kbd>
            </div>
            {results.length === 0 ? (
              <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                &quot;{query}&quot; ile eşleşen sayfa yok.
              </p>
            ) : (
              <ul
                ref={listRef}
                role="listbox"
                aria-label="Arama sonuçları"
                className="scrollbar-thin max-h-72 overflow-y-auto p-1.5"
              >
                {results.map((entry, index) => (
                  <li key={entry.href} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      data-active={index === activeIndex}
                      onClick={() => navigateTo(entry.href)}
                      onMouseMove={() => setActiveIndex(index)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                        index === activeIndex
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      <entry.icon aria-hidden className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">
                        {entry.label}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-[11px]">
                        {entry.groupLabel}
                      </span>
                      {index === activeIndex ? (
                        <CornerDownLeft
                          aria-hidden
                          className="text-muted-foreground size-3.5 shrink-0"
                        />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
