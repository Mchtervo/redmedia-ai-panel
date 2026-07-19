"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { reviewKnowledgeCandidate } from "@/features/ai-brain/services/ai-brain.service";

export type ActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

async function requireUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Oturum bulunamadı.");
  return data.user.id;
}

const reviewSchema = z.object({
  id: z.string().uuid(),
  action: z.enum([
    "approve",
    "reject",
    "archive",
    "test_mode",
    "edit_approve",
  ]),
  title: z.string().optional(),
  proposedRule: z.string().optional(),
  reviewNotes: z.string().optional(),
});

export async function reviewBrainCandidateAction(
  raw: z.infer<typeof reviewSchema>
): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Geçersiz",
    };
  }
  try {
    const userId = await requireUserId();
    const admin = createAdminClient();
    await reviewKnowledgeCandidate(admin, {
      ...parsed.data,
      reviewedBy: userId,
    });
    revalidatePath("/dashboard/ai-brain");
    revalidatePath("/dashboard/ai");
    return { success: true, message: "Güncellendi." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "İşlem başarısız",
    };
  }
}
