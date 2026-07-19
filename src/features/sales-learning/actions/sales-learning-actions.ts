"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { generateAiWeeklyReport } from "@/features/sales-learning/services/weekly-report.service";

export type SalesLearningActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

async function requireCurrentUserId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    throw new Error("Oturum bulunamadı.");
  }
  return data.user.id;
}

export async function generateWeeklyReportAction(): Promise<SalesLearningActionResult> {
  try {
    await requireCurrentUserId();
    const admin = createAdminClient();
    const result = await generateAiWeeklyReport(admin, { force: true });
    revalidatePath("/dashboard/ai");
    return {
      success: true,
      message: `Haftalık rapor oluşturuldu (${result.report.week_start} – ${result.report.week_end}).`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "İşlem başarısız.";
    return { success: false, error: message };
  }
}

const resolveMistakeSchema = z.object({
  mistakeId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export async function resolveMistakeAction(
  input: unknown
): Promise<SalesLearningActionResult> {
  const parsed = resolveMistakeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Geçersiz girdi." };
  }

  try {
    await requireCurrentUserId();
    const admin = createAdminClient();
    const { error } = await admin
      .from("ai_mistakes")
      .update({
        is_resolved: true,
        resolved_note: parsed.data.note?.trim() || "Panelden çözüldü olarak işaretlendi.",
      })
      .eq("id", parsed.data.mistakeId);
    if (error) {
      throw new Error(error.message);
    }
    revalidatePath("/dashboard/ai");
    return { success: true, message: "Hata çözüldü olarak işaretlendi." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "İşlem başarısız.";
    return { success: false, error: message };
  }
}
