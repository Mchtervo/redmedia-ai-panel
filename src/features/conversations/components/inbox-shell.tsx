import type { ReactNode } from "react";

type InboxShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

/**
 * İki sütunlu Inbox iskeleti (konuşma listesi + seçilen konuşma).
 * Hem `/dashboard/inbox` hem `/dashboard/inbox/[id]` bu bileşeni kullanır;
 * bir Next.js `layout.tsx` DEĞİLDİR çünkü layout'lar `searchParams`
 * alamaz — arama/filtre bu nedenle her sayfanın kendi `page.tsx`'inde
 * okunup buraya prop olarak geçirilir.
 */
export function InboxShell({ sidebar, children }: InboxShellProps) {
  return (
    <div className="flex min-h-[32rem] flex-1 flex-col overflow-hidden rounded-lg border border-border md:flex-row">
      <aside className="w-full shrink-0 border-b border-border md:h-auto md:w-72 md:border-b-0 md:border-r">
        {sidebar}
      </aside>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
