import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import { listCustomers } from "@/features/contacts/services/contacts.service";
import { parseListContactsQuery } from "@/features/contacts/validators/list-contacts-query";
import { CustomersTable } from "@/features/contacts/components/customers-table";
import { CustomersSearchInput } from "@/features/contacts/components/customers-search-input";
import { CustomersStatusFilter } from "@/features/contacts/components/customers-status-filter";
import { Pagination } from "@/components/dashboard/pagination";

export const metadata: Metadata = { title: "Customers — Redmedia AI Panel" };

type CustomersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const rawSearchParams = await searchParams;
  const query = parseListContactsQuery(rawSearchParams);

  // İnternal panel içi okuma: RLS henüz personel rol politikaları
  // içermediği için (bkz. docs/DATABASE.md, Aşama 2 bekleniyor) service
  // role istemcisi kullanılır. Anon+cookie istemcisi (server/supabase/server.ts)
  // şu an tüm satırları RLS ile reddeder.
  const supabase = createAdminClient();
  const result = await listCustomers(supabase, query);

  const hasActiveFilters = Boolean(query.search || query.status);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Instagram ve Facebook üzerinden gelen müşterileriniz.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CustomersSearchInput />
        <CustomersStatusFilter />
      </div>

      <CustomersTable items={result.items} hasActiveFilters={hasActiveFilters} />

      {result.items.length > 0 ? (
        <Pagination
          basePath="/dashboard/customers"
          searchParams={{ q: query.search, status: query.status }}
          currentPage={result.page}
          totalPages={result.totalPages}
        />
      ) : null}
    </div>
  );
}
