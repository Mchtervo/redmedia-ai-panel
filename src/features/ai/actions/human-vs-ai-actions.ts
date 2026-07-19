"use server";

import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import {
  formatHumanVsAiReport,
  loadLatestHumanVsAi,
  runHumanVsAiBenchmark,
} from "@/features/ai/benchmarks/human-vs-ai.service";
import type { HumanVsAiResult } from "@/features/ai/benchmarks/human-vs-ai.service";
import { isOpenAiConfigured } from "@/lib/ai/openai-client";

async function requireSession(): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Oturum bulunamadı.");
}

const runSchema = z.object({
  conversationId: z.string().uuid(),
  maxTurns: z.number().int().min(1).max(20).optional(),
});

export async function getLatestHumanVsAiAction(): Promise<
  | { success: true; data: HumanVsAiResult | null }
  | { success: false; error: string }
> {
  try {
    await requireSession();
    return { success: true, data: await loadLatestHumanVsAi() };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Okuma başarısız",
    };
  }
}

export async function runHumanVsAiAction(
  input: z.infer<typeof runSchema>
): Promise<
  | { success: true; data: HumanVsAiResult; reportText: string }
  | { success: false; error: string }
> {
  const parsed = runSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Geçersiz konuşma kimliği." };
  }

  try {
    await requireSession();
    if (!isOpenAiConfigured()) {
      return { success: false, error: "OpenAI yapılandırılmamış." };
    }
    const admin = createAdminClient();
    const result = await runHumanVsAiBenchmark(
      admin,
      parsed.data.conversationId,
      { maxTurns: parsed.data.maxTurns }
    );
    return {
      success: true,
      data: result,
      reportText: formatHumanVsAiReport(result),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Human vs AI başarısız",
    };
  }
}
