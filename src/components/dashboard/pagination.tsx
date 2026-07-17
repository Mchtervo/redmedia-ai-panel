import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaginationProps = {
  basePath: string;
  searchParams: Record<string, string | undefined>;
  currentPage: number;
  totalPages: number;
};

/**
 * Panel genelinde (Customers, Leads, Reservations vb.) liste sayfalama için
 * paylaşılan, feature-agnostic bileşen. Sunucu tarafında saf `<Link>` ile
 * çalışır — istemci JS gerektirmez.
 */
export function Pagination({
  basePath,
  searchParams,
  currentPage,
  totalPages,
}: PaginationProps) {
  function hrefForPage(page: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) {
        params.set(key, value);
      }
    }
    params.set("page", String(page));
    return `${basePath}?${params.toString()}`;
  }

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        Sayfa {currentPage} / {Math.max(totalPages, 1)}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={!hasPrevious} render={
          hasPrevious ? <Link href={hrefForPage(currentPage - 1)} /> : undefined
        }>
          <ChevronLeft />
          Önceki
        </Button>
        <Button variant="outline" size="sm" disabled={!hasNext} render={
          hasNext ? <Link href={hrefForPage(currentPage + 1)} /> : undefined
        }>
          Sonraki
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
