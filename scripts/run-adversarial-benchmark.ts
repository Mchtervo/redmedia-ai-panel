/**
 * Adversarial Sales Benchmark CLI
 * npx tsx scripts/run-adversarial-benchmark.ts
 * npx tsx scripts/run-adversarial-benchmark.ts --scenario=adv-price-whiplash --customers=2
 */

import { createAdminClient } from "../src/server/supabase/admin";
import {
  isAdversarialBenchmarkRunnable,
  runAdversarialSalesBenchmark,
} from "../src/features/ai/benchmarks/adversarial-sales-benchmark-runner.service";
import { formatAdversarialReportText } from "../src/features/ai/benchmarks/adversarial-sales-benchmark-report.service";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  if (!isAdversarialBenchmarkRunnable()) {
    console.error("OpenAI yapılandırılmamış.");
    process.exit(1);
  }

  const scenario = arg("scenario");
  const customers = Number(arg("customers") ?? "5");
  const maxTurns = arg("turns") ? Number(arg("turns")) : undefined;

  const admin = createAdminClient();
  console.log(
    `Adversarial başlıyor… customers=${customers}` +
      (scenario ? ` scenario=${scenario}` : " (tüm senaryolar)")
  );

  const summary = await runAdversarialSalesBenchmark(admin, {
    scenarioIds: scenario ? [scenario] : undefined,
    customersPerScenario: Number.isFinite(customers) ? customers : 5,
    maxTurnsOverride: maxTurns,
    saveResult: true,
  });

  console.log(formatAdversarialReportText(summary));
  console.log(`\nKaydedildi: .data/adversarial-benchmarks/${summary.id}.json`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
