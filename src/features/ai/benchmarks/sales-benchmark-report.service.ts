/**
 * Benchmark rapor + sürüm kaydı + regression.
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type {
  BenchmarkDifficulty,
  BenchmarkRunSummary,
  ScenarioRunResult,
} from "./sales-benchmark.types";
import { BENCHMARK_PROMPT_VERSION } from "./sales-benchmark.types";

type TypedSupabase = SupabaseClient<Database>;

const LOCAL_DIR = path.join(process.cwd(), ".data", "sales-benchmarks");

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function buildBenchmarkSummary(params: {
  results: ScenarioRunResult[];
  model: string | null;
  gitCommit: string | null;
  promptVersion?: string;
  repetitionPenalty: number;
  repeatedPhrases: { phrase: string; count: number }[];
}): BenchmarkRunSummary {
  const { results, model, gitCommit, repetitionPenalty, repeatedPhrases } =
    params;
  const scores = results.map((r) =>
    Math.max(0, r.evaluation.totalScore - repetitionPenalty / results.length)
  );
  const passed = results.filter((r) => r.evaluation.pass);
  const hardFailList = results
    .filter((r) => r.evaluation.hardFails.length > 0)
    .map((r) => ({
      scenarioId: r.scenario.id,
      reasons: r.evaluation.hardFails,
    }));

  const byDifficulty = {} as BenchmarkRunSummary["byDifficulty"];
  for (const d of ["easy", "medium", "hard", "stress"] as BenchmarkDifficulty[]) {
    const subset = results.filter((r) => r.scenario.difficulty === d);
    byDifficulty[d] = {
      count: subset.length,
      avg: avg(subset.map((r) => r.evaluation.totalScore)),
      passRate:
        subset.length === 0
          ? 0
          : Math.round(
              (subset.filter((r) => r.evaluation.pass).length / subset.length) *
                1000
            ) / 10,
    };
  }

  const byCategory: BenchmarkRunSummary["byCategory"] = {};
  for (const r of results) {
    const c = r.scenario.category;
    if (!byCategory[c]) byCategory[c] = { avg: 0, passRate: 0, count: 0 };
    byCategory[c]!.count++;
  }
  for (const c of Object.keys(byCategory)) {
    const subset = results.filter((r) => r.scenario.category === c);
    byCategory[c] = {
      count: subset.length,
      avg: avg(subset.map((r) => r.evaluation.totalScore)),
      passRate:
        Math.round(
          (subset.filter((r) => r.evaluation.pass).length / subset.length) * 1000
        ) / 10,
    };
  }

  const worstReplies = results
    .flatMap((r) =>
      r.turns.map((t) => ({
        scenarioId: r.scenario.id,
        reply: t.finalReply.slice(0, 280),
        reason:
          r.evaluation.hardFails.join(", ") ||
          r.evaluation.behaviorMisses.join(", ") ||
          r.evaluation.notes.slice(0, 2).join("; ") ||
          `score ${r.evaluation.totalScore}`,
        score: r.evaluation.totalScore,
      }))
    )
    .filter((x) => x.reply)
    .sort((a, b) => a.score - b.score)
    .slice(0, 10);

  const bestReplies = results
    .filter((r) => r.evaluation.pass)
    .flatMap((r) => {
      const last = r.turns[r.turns.length - 1];
      if (!last) return [];
      return [
        {
          scenarioId: r.scenario.id,
          reply: last.finalReply.slice(0, 280),
          reason: `pass · ${r.evaluation.totalScore}`,
          score: r.evaluation.totalScore,
        },
      ];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return {
    benchmarkVersion: `sb-${Date.now()}`,
    gitCommit,
    promptVersion: params.promptVersion ?? BENCHMARK_PROMPT_VERSION,
    model,
    date: new Date().toISOString(),
    averageScore: avg(scores),
    passRate:
      results.length === 0
        ? 0
        : Math.round((passed.length / results.length) * 1000) / 10,
    hardFailCount: hardFailList.reduce((n, h) => n + h.reasons.length, 0),
    scenarioCount: results.length,
    passedCount: passed.length,
    failedCount: results.length - passed.length,
    repetitionPenalty,
    repeatedPhrases,
    byDifficulty,
    byCategory,
    hardFailList,
    worstReplies,
    bestReplies,
    regression: { comparedTo: null, failed: false, reasons: [] },
    scenarioResults: results,
  };
}

export function compareRegression(
  current: BenchmarkRunSummary,
  previous: BenchmarkRunSummary | null
): BenchmarkRunSummary["regression"] {
  if (!previous) {
    return { comparedTo: null, failed: false, reasons: [] };
  }
  const reasons: string[] = [];
  if (previous.averageScore - current.averageScore > 3) {
    reasons.push(
      `Ortalama puan ${previous.averageScore} → ${current.averageScore} (>-3)`
    );
  }
  if (current.hardFailCount > previous.hardFailCount) {
    reasons.push(
      `Hard fail arttı: ${previous.hardFailCount} → ${current.hardFailCount}`
    );
  }

  const prevMemory = previous.scenarioResults.filter((r) =>
    r.scenario.category === "memory"
  );
  const curMemory = current.scenarioResults.filter((r) =>
    r.scenario.category === "memory"
  );
  const prevMemPass = prevMemory.filter((r) => r.evaluation.pass).length;
  const curMemPass = curMemory.filter((r) => r.evaluation.pass).length;
  if (curMemory.length > 0 && curMemPass < prevMemPass) {
    reasons.push("Memory senaryo başarıları geriledi");
  }

  const prevPrice = previous.scenarioResults.filter((r) =>
    r.scenario.requirePriceAfterSecondAsk
  );
  const curPrice = current.scenarioResults.filter((r) =>
    r.scenario.requirePriceAfterSecondAsk
  );
  const prevPricePass = prevPrice.filter((r) => r.evaluation.pass).length;
  const curPricePass = curPrice.filter((r) => r.evaluation.pass).length;
  if (curPrice.length > 0 && curPricePass < prevPricePass) {
    reasons.push("Fiyat cevaplama başarısı düştü");
  }

  const prevRep = previous.repeatedPhrases.reduce((n, p) => n + p.count, 0);
  const curRep = current.repeatedPhrases.reduce((n, p) => n + p.count, 0);
  if (prevRep > 0 && curRep > prevRep * 1.1) {
    reasons.push("Tekrar oranı %10'dan fazla arttı");
  }

  const hardPass = current.byDifficulty.hard?.passRate ?? 100;
  const stressPass = current.byDifficulty.stress?.passRate ?? 100;
  if (hardPass < 80 || stressPass < 80) {
    reasons.push(
      `Zor/stres başarı %80 altı (hard ${hardPass}%, stress ${stressPass}%)`
    );
  }

  return {
    comparedTo: previous.benchmarkVersion,
    failed: reasons.length > 0,
    reasons,
  };
}

async function ensureLocalDir(): Promise<void> {
  await mkdir(LOCAL_DIR, { recursive: true });
}

export async function saveBenchmarkSummary(
  supabase: TypedSupabase,
  summary: BenchmarkRunSummary
): Promise<void> {
  await ensureLocalDir();
  const file = path.join(LOCAL_DIR, `${summary.benchmarkVersion}.json`);
  await writeFile(file, JSON.stringify(summary, null, 2), "utf8");

  // latest pointer
  await writeFile(
    path.join(LOCAL_DIR, "latest.json"),
    JSON.stringify({ version: summary.benchmarkVersion, date: summary.date }),
    "utf8"
  );

  const { error } = await supabase.from("sales_benchmark_runs").insert({
    benchmark_version: summary.benchmarkVersion,
    git_commit: summary.gitCommit,
    prompt_version: summary.promptVersion,
    model: summary.model,
    average_score: summary.averageScore,
    pass_rate: summary.passRate,
    hard_fail_count: summary.hardFailCount,
    scenario_count: summary.scenarioCount,
    summary: summary as unknown as Json,
  });
  if (error) {
    // tablo yoksa / migration uygulanmamışsa dosya kaydı yeterli
    console.error("[sales-benchmark] db save skipped:", error.message);
  }
}

export async function loadPreviousBenchmarkSummary(
  supabase: TypedSupabase
): Promise<BenchmarkRunSummary | null> {
  try {
    const { data } = await supabase
      .from("sales_benchmark_runs")
      .select("summary")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.summary && typeof data.summary === "object") {
      return data.summary as unknown as BenchmarkRunSummary;
    }
  } catch {
    // ignore
  }

  try {
    await ensureLocalDir();
    const latestRaw = await readFile(
      path.join(LOCAL_DIR, "latest.json"),
      "utf8"
    ).catch(() => null);
    if (latestRaw) {
      const latest = JSON.parse(latestRaw) as { version: string };
      const body = await readFile(
        path.join(LOCAL_DIR, `${latest.version}.json`),
        "utf8"
      );
      return JSON.parse(body) as BenchmarkRunSummary;
    }
    const files = (await readdir(LOCAL_DIR))
      .filter((f) => f.startsWith("sb-") && f.endsWith(".json"))
      .sort()
      .reverse();
    if (files[0]) {
      const body = await readFile(path.join(LOCAL_DIR, files[0]), "utf8");
      return JSON.parse(body) as BenchmarkRunSummary;
    }
  } catch {
    // ignore
  }
  return null;
}

export function formatBenchmarkReportText(summary: BenchmarkRunSummary): string {
  const lines = [
    "=== SALES BENCHMARK RAPORU ===",
    `Versiyon: ${summary.benchmarkVersion}`,
    `Tarih: ${summary.date}`,
    `Prompt: ${summary.promptVersion}`,
    `Model: ${summary.model ?? "—"}`,
    `Senaryo: ${summary.scenarioCount} · Geçen: ${summary.passedCount} · Kalan: ${summary.failedCount}`,
    `Ortalama puan: ${summary.averageScore}`,
    `Başarı oranı: %${summary.passRate}`,
    `Hard fail (adet): ${summary.hardFailCount}`,
    `Tekrar cezası: ${summary.repetitionPenalty}`,
    "",
    "— Zorluk —",
    ...(["easy", "medium", "hard", "stress"] as const).map(
      (d) =>
        `${d}: n=${summary.byDifficulty[d].count} avg=${summary.byDifficulty[d].avg} pass=${summary.byDifficulty[d].passRate}%`
    ),
    "",
    "— Hard fails —",
    ...(summary.hardFailList.length === 0
      ? ["(yok)"]
      : summary.hardFailList.map(
          (h) => `${h.scenarioId}: ${h.reasons.join(", ")}`
        )),
    "",
    "— Regression —",
    summary.regression.comparedTo
      ? `Karşılaştırılan: ${summary.regression.comparedTo} · ${summary.regression.failed ? "FAIL" : "OK"}`
      : "Önceki sürüm yok",
    ...summary.regression.reasons.map((r) => `  - ${r}`),
    "",
    "— En kötü 10 —",
    ...summary.worstReplies.map(
      (w, i) =>
        `${i + 1}. [${w.scenarioId}] (${w.score}) ${w.reason}\n   ${w.reply}`
    ),
  ];
  return lines.join("\n");
}
