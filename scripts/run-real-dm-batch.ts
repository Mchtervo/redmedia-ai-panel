/**
 * Gerçek Instagram DM batch (ChatPlace salt okuma).
 * npx tsx --env-file=.env.local scripts/run-real-dm-batch.ts
 * npx tsx --env-file=.env.local scripts/run-real-dm-batch.ts --max=100 --compare=20
 */

import { createAdminClient } from "../src/server/supabase/admin";
import {
  formatRealDmBatchReport,
  runRealDmBatchAnalysis,
} from "../src/features/ai/services/real-dm-batch.service";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const max = Number(arg("max") ?? "500");
  const compare = Number(arg("compare") ?? "20");
  const syncFirst = !hasFlag("no-sync");
  const admin = createAdminClient();

  console.log(
    `Gerçek DM batch: max=${max} compare=${compare} sync=${syncFirst} (gönderim YOK)`
  );

  const summary = await runRealDmBatchAnalysis(admin, {
    maxConversations: max,
    compareLimit: compare,
    syncFirst,
    maxHvATurns: 3,
  });

  console.log(formatRealDmBatchReport(summary));
  console.log(`\nKaydedildi: .data/real-dm-batches/${summary.id}.json`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
