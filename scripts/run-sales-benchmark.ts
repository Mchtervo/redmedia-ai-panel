/**
 * Gerçek Sales Benchmark koşusu (labMode).
 * Kullanım:
 *   npx tsx scripts/run-sales-benchmark.ts
 *   npx tsx scripts/run-sales-benchmark.ts --ids memory-01,price-hunter-01,master-stress-01
 *   npx tsx scripts/run-sales-benchmark.ts --difficulty hard,stress
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createAdminClient } from "../src/server/supabase/admin";
import { runSalesBenchmark } from "../src/features/ai/benchmarks/sales-benchmark-runner.service";
import { formatBenchmarkReportText } from "../src/features/ai/benchmarks/sales-benchmark-report.service";
import type { BenchmarkDifficulty } from "../src/features/ai/benchmarks/sales-benchmark.types";
import { SALES_BENCHMARK_SCENARIOS } from "../src/features/ai/benchmarks/sales-benchmark-scenarios";

function parseArgs(argv: string[]) {
  const idsArg = argv.find((a) => a.startsWith("--ids="))?.slice(6);
  const diffArg = argv.find((a) => a.startsWith("--difficulty="))?.slice(13);
  return {
    scenarioIds: idsArg ? idsArg.split(",").map((s) => s.trim()) : undefined,
    difficulties: diffArg
      ? (diffArg.split(",").map((s) => s.trim()) as BenchmarkDifficulty[])
      : undefined,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `Senaryo havuzu: ${SALES_BENCHMARK_SCENARIOS.length}. Başlıyor…`,
    args
  );
  const admin = createAdminClient();
  const summary = await runSalesBenchmark(admin, {
    ...args,
    useLlmJudge: false,
    saveResult: true,
  });
  console.log(formatBenchmarkReportText(summary));
  console.log(
    JSON.stringify(
      {
        averageScore: summary.averageScore,
        passRate: summary.passRate,
        hardFailCount: summary.hardFailCount,
        passedCount: summary.passedCount,
        failedCount: summary.failedCount,
        scenarioCount: summary.scenarioCount,
        regression: summary.regression,
        hardFailList: summary.hardFailList,
      },
      null,
      2
    )
  );
  if (summary.regression.failed) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
