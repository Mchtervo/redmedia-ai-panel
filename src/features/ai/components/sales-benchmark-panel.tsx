"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  getLatestSalesBenchmarkAction,
  listSalesBenchmarkScenariosAction,
  runSalesBenchmarkAction,
  runSingleSalesBenchmarkAction,
} from "@/features/ai/actions/sales-benchmark-actions";
import type {
  BenchmarkDifficulty,
  BenchmarkRunSummary,
  ScenarioRunResult,
} from "@/features/ai/benchmarks/sales-benchmark.types";

type ScenarioRow = {
  id: string;
  name: string;
  difficulty: BenchmarkDifficulty;
  category: string;
  targetCustomerType: string;
  turnCount: number;
  isMasterStress: boolean;
};

const DIFFS: Array<BenchmarkDifficulty | "all"> = [
  "all",
  "easy",
  "medium",
  "hard",
  "stress",
];

export function SalesBenchmarkPanel() {
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [filter, setFilter] = useState<BenchmarkDifficulty | "all">("all");
  const [selectedId, setSelectedId] = useState<string>("");
  const [summary, setSummary] = useState<BenchmarkRunSummary | null>(null);
  const [single, setSingle] = useState<ScenarioRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const list = await listSalesBenchmarkScenariosAction();
      if (list.success) {
        setScenarios(list.data);
        setSelectedId(list.data[0]?.id ?? "");
      }
      const latest = await getLatestSalesBenchmarkAction();
      if (latest.success && latest.data) setSummary(latest.data);
    });
  }, []);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? scenarios
        : scenarios.filter((s) => s.difficulty === filter),
    [scenarios, filter]
  );

  function runAll() {
    setError(null);
    setSingle(null);
    startTransition(async () => {
      const result = await runSalesBenchmarkAction({
        difficulties: filter === "all" ? undefined : [filter],
        useLlmJudge: true,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSummary(result.data);
      setReportText(result.reportText);
    });
  }

  function runSelected() {
    if (!selectedId) return;
    setError(null);
    startTransition(async () => {
      const result = await runSingleSalesBenchmarkAction(selectedId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSingle(result.data);
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Sales Benchmark</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Gerçek asistan motoru + Satış Beyni üzerinden otomatik senaryo
          koşusu. Instagram&apos;a mesaj gitmez. OpenAI + AI_MASTER gerekir.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-muted-foreground text-xs" htmlFor="bench-diff">
          Zorluk
        </label>
        <select
          id="bench-diff"
          value={filter}
          onChange={(e) =>
            setFilter(e.target.value as BenchmarkDifficulty | "all")
          }
          className="border-border rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          {DIFFS.map((d) => (
            <option key={d} value={d}>
              {d === "all" ? "Tümü" : d}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending}
          onClick={runAll}
          className="border-border hover:bg-muted disabled:opacity-40 rounded-md border px-3 py-1.5 text-xs font-medium"
        >
          {pending ? "Çalışıyor…" : "Filtrelenenleri çalıştır"}
        </button>
        <button
          type="button"
          disabled={pending || !selectedId}
          onClick={runSelected}
          className="border-border hover:bg-muted disabled:opacity-40 rounded-md border px-3 py-1.5 text-xs font-medium"
        >
          Seçili senaryoyu çalıştır
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {summary ? (
        <div className="border-border grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Ortalama puan" value={String(summary.averageScore)} />
          <Stat label="Başarı %" value={String(summary.passRate)} />
          <Stat label="Hard fail" value={String(summary.hardFailCount)} />
          <Stat
            label="Geçen / toplam"
            value={`${summary.passedCount}/${summary.scenarioCount}`}
          />
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="text-muted-foreground text-xs">Regression</p>
            <p className="text-sm">
              {summary.regression.comparedTo
                ? `${summary.regression.failed ? "FAIL" : "OK"} · ${summary.regression.comparedTo}`
                : "Önceki sürüm yok"}
            </p>
            {summary.regression.reasons.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 text-xs text-red-700">
                {summary.regression.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Henüz kayıtlı benchmark yok. Çalıştırınca burada görünecek.
        </p>
      )}

      <div className="border-border max-h-64 overflow-auto rounded-lg border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 sticky top-0">
            <tr>
              <th className="px-2 py-2">Seç</th>
              <th className="px-2 py-2">ID</th>
              <th className="px-2 py-2">Ad</th>
              <th className="px-2 py-2">Zorluk</th>
              <th className="px-2 py-2">Kategori</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-border border-t">
                <td className="px-2 py-1.5">
                  <input
                    type="radio"
                    name="bench-scenario"
                    checked={selectedId === s.id}
                    onChange={() => setSelectedId(s.id)}
                    aria-label={s.name}
                  />
                </td>
                <td className="px-2 py-1.5 font-mono">{s.id}</td>
                <td className="px-2 py-1.5">
                  {s.name}
                  {s.isMasterStress ? " · MASTER" : ""}
                </td>
                <td className="px-2 py-1.5">{s.difficulty}</td>
                <td className="px-2 py-1.5">{s.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {single ? (
        <div className="border-border space-y-2 rounded-lg border p-4 text-sm">
          <p className="font-medium">
            {single.scenario.name} — puan {single.evaluation.totalScore}{" "}
            {single.evaluation.pass ? "(geçti)" : "(kaldı)"}
          </p>
          {single.evaluation.hardFails.length > 0 ? (
            <p className="text-red-700 text-xs">
              Hard fail: {single.evaluation.hardFails.join(", ")}
            </p>
          ) : null}
          <ol className="space-y-3">
            {single.turns.map((t) => (
              <li key={t.turnIndex} className="border-border rounded border p-2">
                <p>
                  <span className="font-medium">Müşteri:</span>{" "}
                  {t.customerMessage}
                </p>
                <p className="mt-1">
                  <span className="font-medium">Asistan:</span> {t.finalReply}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  state={t.funnelState} · tip={t.customerType} · obj=
                  {t.objective} · nba={t.nextBestAction} · skor=
                  {t.scores
                    ? `${t.scores.trust}/${t.scores.purchaseIntent}/${t.scores.priceSensitivity}/${t.scores.urgency}`
                    : "—"}
                  {t.reflection.rewritten ? " · rewrite" : ""}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {summary && summary.worstReplies.length > 0 ? (
        <div className="border-border rounded-lg border p-4">
          <h3 className="text-sm font-semibold">En kötü 10 cevap</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-xs">
            {summary.worstReplies.map((w, i) => (
              <li key={`${w.scenarioId}-${i}`}>
                <span className="font-mono">{w.scenarioId}</span> ({w.score}) —{" "}
                {w.reason}
                <p className="text-muted-foreground mt-0.5">{w.reply}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {summary && summary.hardFailList.length > 0 ? (
        <div className="border-border rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Hard fail listesi</h3>
          <ul className="mt-2 list-disc pl-5 text-xs">
            {summary.hardFailList.map((h) => (
              <li key={h.scenarioId}>
                {h.scenarioId}: {h.reasons.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {reportText ? (
        <pre className="border-border max-h-80 overflow-auto rounded-lg border bg-neutral-50 p-3 text-[11px] whitespace-pre-wrap dark:bg-neutral-950">
          {reportText}
        </pre>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-[11px] uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
