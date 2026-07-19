import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/server/supabase/admin";
import { getCustomerDetail } from "@/features/contacts/services/contacts.service";
import { CustomerDetail } from "@/features/contacts/components/customer-detail";

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Müşteri Detayı — Redmedia AI Panel",
};

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;

  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  const supabase = createAdminClient();
  const detail = await getCustomerDetail(supabase, parsedId.data);

  if (!detail) {
    notFound();
  }

  return (
    <CustomerDetail
      contact={detail.contact}
      crmProfile={detail.crmProfile}
      timelineEvents={detail.timelineEvents}
      adminNotes={detail.adminNotes}
      recentMessages={detail.recentMessages}
      attribution={detail.attribution}
    />
  );
}
