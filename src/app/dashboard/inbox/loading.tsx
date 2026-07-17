import { Skeleton } from "@/components/ui/skeleton";

export default function InboxLoading() {
  return (
    <div className="flex h-full flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex min-h-[32rem] flex-1 flex-col overflow-hidden rounded-lg border border-border md:flex-row">
        <div className="flex w-full flex-col gap-3 border-b border-border p-3 md:w-72 md:border-b-0 md:border-r">
          <Skeleton className="h-9 w-full" />
          <div className="flex gap-1.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-6 w-14 rounded-full" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Skeleton className="h-6 w-48" />
        </div>
      </div>
    </div>
  );
}
