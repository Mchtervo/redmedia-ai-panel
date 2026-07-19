"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { askCeoAssistant } from "@/features/ceo-intelligence/services/assistant.service";
import { generateCeoDailyReport } from "@/features/ceo-intelligence/services/daily-report.service";

const questionSchema = z.object({
  question: z.string().trim().min(2).max(2000),
});

export type AskCeoAssistantActionResult =
  | { success: true; answer: string; status: string }
  | { success: false; error: string };

export async function askCeoAssistantAction(
  raw: unknown
): Promise<AskCeoAssistantActionResult> {
  const parsed = questionSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Geçerli bir soru girin." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Oturum gerekli." };
  }

  const admin = createAdminClient();
  const result = await askCeoAssistant(
    admin,
    parsed.data.question,
    user.id
  );

  return {
    success: true,
    answer: result.answer,
    status: result.status,
  };
}

export async function regenerateCeoDailyReportAction(): Promise<
  | { success: true; reportDate: string }
  | { success: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Oturum gerekli." };
  }

  try {
    const admin = createAdminClient();
    const result = await generateCeoDailyReport(admin);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/ceo");
    return { success: true, reportDate: result.reportDate };
  } catch {
    return { success: false, error: "Rapor üretilemedi." };
  }
}
