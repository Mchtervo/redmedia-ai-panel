"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { decideApproval } from "@/features/approvals/repositories/approvals.repository";

export type ApprovalActionResult =
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

const decideSchema = z.object({
  approvalId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(500).optional(),
});

/** Onay kararı — karar veren kullanıcı ve zaman loglanır (docs/43 §12). */
export async function decideApprovalAction(
  input: unknown
): Promise<ApprovalActionResult> {
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Geçersiz girdi." };
  }

  try {
    const userId = await requireCurrentUserId();
    const admin = createAdminClient();
    await decideApproval(admin, {
      approvalId: parsed.data.approvalId,
      decision: parsed.data.decision,
      decidedBy: userId,
      note: parsed.data.note ?? null,
    });
    revalidatePath("/dashboard/approvals");
    return {
      success: true,
      message:
        parsed.data.decision === "approved" ? "Onaylandı." : "Reddedildi.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "İşlem başarısız.";
    return { success: false, error: message };
  }
}
