"use server";

import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import {
  isBenchmarkRunnable,
  runSalesBenchmark,
  runSingleBenchmarkScenario,
} from "@/features/ai/benchmarks/sales-benchmark-runner.service";
import {
  formatBenchmarkReportText,
  loadPreviousBenchmarkSummary,
} from "@/features/ai/benchmarks/sales-benchmark-report.service";
import { listBenchmarkScenarios } from "@/features/ai/benchmarks/sales-benchmark-scenarios";
import type {
  BenchmarkDifficulty,
  BenchmarkRunSummary,
  ScenarioRunResult,
} from "@/features/ai/benchmarks/sales-benchmark.types";

async function requireSession(): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Oturum bulunamadı.");
}

const runSchema = z.object({
  scenarioIds: z.array(z.string()).max(50).optional(),
  difficulties: z
    .array(z.enum(["easy", "medium", "hard", "stress"]))
    .optional(),
  useLlmJudge: z.boolean().optional(),
});

export async function listSalesBenchmarkScenariosAction() {
  await requireSession();
  return {
    success: true as const,
    data: listBenchmarkScenarios().map((s) => ({
      id: s.id,
      name: s.name,
      difficulty: s.difficulty,
      category: s.category,
      targetCustomerType: s.targetCustomerType,
      turnCount: s.turns.length,
      isMasterStress: Boolean(s.isMasterStress),
    })),
  };
}

export async function getLatestSalesBenchmarkAction(): Promise<
  | { success: true; data: BenchmarkRunSummary | null }
  | { success: false; error: string }
> {
  try {
    await requireSession();
    const admin = createAdminClient();
    const prev = await loadPreviousBenchmarkSummary(admin);
    return { success: true, data: prev };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Okuma başarısız",
    };
  }
}

export async function runSalesBenchmarkAction(
  input: z.infer<typeof runSchema> = {}
): Promise<
  | { success: true; data: BenchmarkRunSummary; reportText: string }
  | { success: false; error: string }
> {
  const parsed = runSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Geçersiz benchmark ayarı." };
  }

  try {
    await requireSession();
    if (!isBenchmarkRunnable()) {
      return {
        success: false,
        error: "OpenAI yapılandırılmamış — gerçek motor çalıştırılamaz.",
      };
    }
    const admin = createAdminClient();
    const summary = await runSalesBenchmark(admin, {
      scenarioIds: parsed.data.scenarioIds,
      difficulties: parsed.data.difficulties as BenchmarkDifficulty[] | undefined,
      useLlmJudge: parsed.data.useLlmJudge ?? true,
      saveResult: true,
    });
    return {
      success: true,
      data: summary,
      reportText: formatBenchmarkReportText(summary),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Benchmark başarısız",
    };
  }
}

export async function runSingleSalesBenchmarkAction(
  scenarioId: string
): Promise<
  | { success: true; data: ScenarioRunResult }
  | { success: false; error: string }
> {
  try {
    await requireSession();
    if (!isBenchmarkRunnable()) {
      return {
        success: false,
        error: "OpenAI yapılandırılmamış — gerçek motor çalıştırılamaz.",
      };
    }
    const admin = createAdminClient();
    const result = await runSingleBenchmarkScenario(admin, scenarioId, {
      useLlmJudge: true,
    });
    return { success: true, data: result };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Senaryo başarısız",
    };
  }
}
