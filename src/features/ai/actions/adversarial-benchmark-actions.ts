"use server";

import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import {
  isAdversarialBenchmarkRunnable,
  runAdversarialSalesBenchmark,
} from "@/features/ai/benchmarks/adversarial-sales-benchmark-runner.service";
import {
  formatAdversarialReportText,
  loadLatestAdversarialSummary,
} from "@/features/ai/benchmarks/adversarial-sales-benchmark-report.service";
import { listAdversarialScenarioSeeds } from "@/features/ai/benchmarks/adversarial-sales-benchmark-scenarios";
import type { AdversarialRunSummary } from "@/features/ai/benchmarks/adversarial-sales-benchmark.types";

async function requireSession(): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Oturum bulunamadı.");
}

const runSchema = z.object({
  scenarioIds: z.array(z.string()).max(20).optional(),
  customersPerScenario: z.number().int().min(1).max(5).optional(),
  maxTurnsOverride: z.number().int().min(2).max(12).optional(),
});

export async function listAdversarialScenariosAction() {
  await requireSession();
  return {
    success: true as const,
    data: listAdversarialScenarioSeeds().map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      maxTurns: s.maxTurns,
    })),
  };
}

export async function getLatestAdversarialBenchmarkAction(): Promise<
  | { success: true; data: AdversarialRunSummary | null }
  | { success: false; error: string }
> {
  try {
    await requireSession();
    const prev = await loadLatestAdversarialSummary();
    return { success: true, data: prev };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Okuma başarısız",
    };
  }
}

export async function runAdversarialBenchmarkAction(
  input: z.infer<typeof runSchema> = {}
): Promise<
  | { success: true; data: AdversarialRunSummary; reportText: string }
  | { success: false; error: string }
> {
  const parsed = runSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Geçersiz adversarial ayarı." };
  }

  try {
    await requireSession();
    if (!isAdversarialBenchmarkRunnable()) {
      return {
        success: false,
        error: "OpenAI yapılandırılmamış — adversarial koşu çalıştırılamaz.",
      };
    }
    const admin = createAdminClient();
    const summary = await runAdversarialSalesBenchmark(admin, {
      scenarioIds: parsed.data.scenarioIds,
      customersPerScenario: parsed.data.customersPerScenario ?? 5,
      maxTurnsOverride: parsed.data.maxTurnsOverride,
      saveResult: true,
    });
    return {
      success: true,
      data: summary,
      reportText: formatAdversarialReportText(summary),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Adversarial benchmark başarısız",
    };
  }
}
