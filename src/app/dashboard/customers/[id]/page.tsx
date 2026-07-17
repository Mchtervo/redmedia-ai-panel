import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/server/supabase/admin";
import { getCustomerDetail } from "@/features/contacts/services/contacts.service";
import { CustomerDetail } from "@/features/contacts/components/customer-detail";

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = { title: "Müşteri Detayı — Redmedia AI Panel" };

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;

  // `id` bir dış girdi (rota parametresi); geçersiz UUID formatında bir
  // Postgres hatası yerine temiz bir 404 dönmesi için önce doğrulanır.
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  // İnternal panel içi okuma: bkz. ../page.tsx üstündeki not (service role,
  // RLS henüz personel rol politikaları içermediği için).
  const supabase = createAdminClient();
  const contact = await getCustomerDetail(supabase, parsedId.data);

  if (!contact) {
    notFound();
  }

  return <CustomerDetail contact={contact} />;
}
