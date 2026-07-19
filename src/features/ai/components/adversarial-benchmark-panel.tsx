"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getLatestAdversarialBenchmarkAction,
  listAdversarialScenariosAction,
  runAdversarialBenchmarkAction,
} from "@/features/ai/actions/adversarial-benchmark-actions";
import type { AdversarialRunSummary } from "@/features/ai/benchmarks/adversarial-sales-benchmark.types";

type ScenarioRow = {
  id: string;
  name: string;
  category: string;
  maxTurns: number;
};

export function AdversarialBenchmarkPanel() {
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [customers, setCustomers] = useState(5);
  const [summary, setSummary] = useState<AdversarialRunSummary | null>(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const list = await listAdversarialScenariosAction();
      if (list.success) {
        setScenarios(list.data);
        setSelectedId(list.data[0]?.id ?? "");
      }
      const latest = await getLatestAdversarialBenchmarkAction();
      if (latest.success && latest.data) setSummary(latest.data);
    });
  }, []);

  function runSelected() {
    setError(null);
    startTransition(async () => {
      const result = await runAdversarialBenchmarkAction({
        scenarioIds: selectedId ? [selectedId] : undefined,
        customersPerScenario: customers,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSummary(result.data);
      setReportText(result.reportText);
    });
  }

  function runAll() {
    setError(null);
    startTransition(async () => {
      const result = await runAdversarialBenchmarkAction({
        customersPerScenario: customers,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSummary(result.data);
      setReportText(result.reportText);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Adversarial Sales Benchmark</h2>
        <p className="text-muted-foreground text-sm">
          Sabit müşteri mesajı yok. LLM müşteri rolüne girer; satış AI gerçek
          motorla konuşur; hakem tüm konuşmayı analiz eder. Her senaryo varsayılan
          5 farklı müşteri kişiliğiyle tekrarlanır.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
          <span>Senaryo</span>
          <select
            className="border-border bg-background rounded-md border px-2 py-1.5"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={pending || scenarios.length === 0}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.maxTurns} tur)
              </option>
            ))}
          </select>
        </label>

        <label className="flex w-28 flex-col gap-1 text-sm">
          <span>Müşteri ×</span>
          <select
            className="border-border bg-background rounded-md border px-2 py-1.5"
            value={customers}
            onChange={(e) => setCustomers(Number(e.target.value))}
            disabled={pending}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="border-border rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={runSelected}
            disabled={pending || !selectedId}
          >
            {pending ? "Çalışıyor…" : "Seçili senaryo"}
          </button>
          <button
            type="button"
            className="bg-foreground text-background rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={runAll}
            disabled={pending}
          >
            Tüm senaryolar
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {summary ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="border-border rounded-md border p-3 text-sm">
              <div className="text-muted-foreground">Ortalama skor</div>
              <div className="text-lg font-semibold">
                {summary.avgOverallScore}
              </div>
            </div>
            <div className="border-border rounded-md border p-3 text-sm">
              <div className="text-muted-foreground">Koşu sayısı</div>
              <div className="text-lg font-semibold">
                {summary.variantRunCount}
              </div>
            </div>
            <div className="border-border rounded-md border p-3 text-sm">
              <div className="text-muted-foreground">Süre</div>
              <div className="text-lg font-semibold">
                {Math.round(summary.durationMs / 1000)}s
              </div>
            </div>
          </div>

          <ul className="space-y-2">
            {summary.aggregates.map((agg) => (
              <li
                key={agg.scenarioId}
                className="border-border rounded-md border p-3 text-sm"
              >
                <div className="font-medium">
                  {agg.name}{" "}
                  <span className="text-muted-foreground font-normal">
                    ort. {agg.avgOverallScore}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1">
                  trust Δ {agg.avgTrustDelta ?? "—"} · intent Δ{" "}
                  {agg.avgPurchaseIntentDelta ?? "—"} · ilk hata turu{" "}
                  {agg.firstMistakeTurnAvg ?? "—"}
                </p>
                <p className="mt-1">
                  Kayıplar:{" "}
                  {Object.entries(agg.lossTagCounts)
                    .map(([k, v]) => `${k}×${v}`)
                    .join(", ") || "—"}
                </p>
                <ul className="mt-2 space-y-1">
                  {agg.variants.map((v) => (
                    <li key={`${agg.scenarioId}-${v.variantIndex}`}>
                      <span className="font-medium">{v.seedLabel}</span>:{" "}
                      {v.judge.overallScore}
                      {v.judge.whereCustomerWasLost
                        ? ` — ${v.judge.whereCustomerWasLost}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {reportText ? (
        <pre className="border-border bg-muted/40 max-h-96 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap">
          {reportText}
        </pre>
      ) : null}
    </div>
  );
}
