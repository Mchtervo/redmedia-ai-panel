import { Skeleton } from "@/components/ui/skeleton";

export default function ConversationDetailLoading() {
  return (
    <div className="flex h-full flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex min-h-[32rem] flex-1 flex-col overflow-hidden rounded-lg border border-border md:flex-row">
        <div className="flex w-full flex-col gap-3 border-b border-border p-3 md:w-72 md:border-b-0 md:border-r">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-2/3" />
          ))}
        </div>
      </div>
    </div>
  );
}
