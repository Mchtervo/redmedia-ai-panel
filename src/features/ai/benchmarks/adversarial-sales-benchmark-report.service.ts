import { promises as fs } from "fs";
import path from "path";
import type { AdversarialRunSummary } from "./adversarial-sales-benchmark.types";

const LOCAL_DIR = path.join(process.cwd(), ".data", "adversarial-benchmarks");

async function ensureDir(): Promise<void> {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
}

export async function saveAdversarialSummary(
  summary: AdversarialRunSummary
): Promise<string> {
  await ensureDir();
  const filePath = path.join(LOCAL_DIR, `${summary.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(summary, null, 2), "utf8");
  const latest = path.join(LOCAL_DIR, "latest.json");
  await fs.writeFile(latest, JSON.stringify(summary, null, 2), "utf8");
  return filePath;
}

export async function loadLatestAdversarialSummary(): Promise<AdversarialRunSummary | null> {
  try {
    const latest = path.join(LOCAL_DIR, "latest.json");
    const raw = await fs.readFile(latest, "utf8");
    return JSON.parse(raw) as AdversarialRunSummary;
  } catch {
    return null;
  }
}

export function formatAdversarialReportText(
  summary: AdversarialRunSummary
): string {
  const lines: string[] = [
    `# Adversarial Sales Benchmark`,
    `id: ${summary.id}`,
    `prompt: ${summary.promptVersion}`,
    `senaryo: ${summary.scenarioCount} × müşteri: ${summary.customersPerScenario} = ${summary.variantRunCount} koşu`,
    `ortalama skor: ${summary.avgOverallScore}`,
    `süre: ${Math.round(summary.durationMs / 1000)}s`,
    "",
  ];

  for (const agg of summary.aggregates) {
    lines.push(`## ${agg.scenarioId} — ${agg.name}`);
    lines.push(`ortalama: ${agg.avgOverallScore}`);
    lines.push(
      `trust Δ ort: ${agg.avgTrustDelta ?? "—"} | intent Δ ort: ${agg.avgPurchaseIntentDelta ?? "—"}`
    );
    lines.push(
      `ilk hata turu ort: ${agg.firstMistakeTurnAvg ?? "—"}`
    );
    lines.push(
      `kayıp etiketleri: ${Object.entries(agg.lossTagCounts)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ") || "—"}`
    );

    for (const v of agg.variants) {
      lines.push(
        `  - ${v.seedLabel}: skor=${v.judge.overallScore}` +
          (v.judge.whereCustomerWasLost
            ? ` | kayıp: ${v.judge.whereCustomerWasLost}`
            : "")
      );
      if (v.judge.betterAlternativeReply) {
        lines.push(
          `    alternatif: ${v.judge.betterAlternativeReply.slice(0, 160)}`
        );
      }
    }
    lines.push("");
  }

  lines.push("## Notlar");
  for (const n of summary.notes) lines.push(`- ${n}`);
  return lines.join("\n");
}
