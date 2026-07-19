import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/server/supabase/admin";
import { getCorrectionCase } from "@/features/ai/services/correction-case.service";
import { CorrectionCaseView } from "@/features/ai/components/correction-case-view";

export const metadata: Metadata = {
  title: "Düzeltme vakası — Redmedia AI Panel",
};

type Props = {
  params: Promise<{ conversationId: string }>;
};

export default async function CorrectionCasePage({ params }: Props) {
  const { conversationId } = await params;
  const supabase = createAdminClient();
  const data = await getCorrectionCase(supabase, conversationId);

  if (!data) notFound();

  return <CorrectionCaseView data={data} />;
}
