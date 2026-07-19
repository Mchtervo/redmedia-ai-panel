"use client";

import { useEffect, useState, useTransition } from "react";
import {
  compareRealDmConversationAction,
  getLatestRealDmBatchAction,
  runRealDmBatchAction,
} from "@/features/ai/actions/real-dm-actions";
import type { RealDmBatchSummary } from "@/features/ai/services/real-dm-batch.service";
import type { HumanVsAiResult } from "@/features/ai/benchmarks/human-vs-ai.service";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function HumanVsAiPanel() {
  const [batch, setBatch] = useState<RealDmBatchSummary | null>(null);
  const [comparison, setComparison] = useState<HumanVsAiResult | null>(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const latest = await getLatestRealDmBatchAction();
      if (latest.success && latest.data) setBatch(latest.data);
    });
  }, []);

  function runBatch(max: number, compare: number) {
    setError(null);
    setComparison(null);
    startTransition(async () => {
      const result = await runRealDmBatchAction({
        maxConversations: max,
        compareLimit: compare,
        syncFirst: true,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setBatch(result.data);
      setReportText(result.reportText);
    });
  }

  function compareOne(conversationId: string) {
    setError(null);
    startTransition(async () => {
      const result = await compareRealDmConversationAction(conversationId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setComparison(result.data);
      setReportText(result.reportText);
    });
  }

  const tableRows = batch?.conversations ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Human vs AI — Gerçek DM</h2>
        <p className="text-muted-foreground text-sm">
          Instagram DM geçmişi ChatPlace üzerinden salt okunur çekilir. Spam ve
          alakasız elenir, metinler anonimleştirilir. Canlı hesaba mesaj
          gönderilmez.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="bg-foreground text-background rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={pending}
          onClick={() => runBatch(20, 20)}
        >
          {pending ? "Çalışıyor…" : "Son 20 konuşmayı karşılaştır"}
        </button>
        <button
          type="button"
          className="border-border rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={pending}
          onClick={() => runBatch(100, 0)}
        >
          Son 100 konuşmayı analiz et
        </button>
        <button
          type="button"
          className="border-border rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={pending}
          onClick={() => runBatch(500, 20)}
        >
          Son 500 çek + 20 karşılaştır
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {batch ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-border rounded-md border p-3 text-sm">
            <div className="text-muted-foreground">Bulunan / Analiz</div>
            <div className="text-lg font-semibold">
              {batch.found} / {batch.analyzed}
            </div>
          </div>
          <div className="border-border rounded-md border p-3 text-sm">
            <div className="text-muted-foreground">Elendi</div>
            <div className="text-lg font-semibold">{batch.rejected}</div>
          </div>
          <div className="border-border rounded-md border p-3 text-sm">
            <div className="text-muted-foreground">İnsan / AI ort.</div>
            <div className="text-lg font-semibold">
              {batch.humanVsAi.humanAverage ?? "—"} /{" "}
              {batch.humanVsAi.aiAverage ?? "—"}
            </div>
          </div>
          <div className="border-border rounded-md border p-3 text-sm">
            <div className="text-muted-foreground">Rezervasyon</div>
            <div className="text-lg font-semibold">{batch.reservations}</div>
          </div>
        </div>
      ) : null}

      <div className="border-border overflow-x-auto rounded-md border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-border bg-muted/40 border-b">
            <tr>
              <th className="px-3 py-2 font-medium">Tarih</th>
              <th className="px-3 py-2 font-medium">Müşteri</th>
              <th className="px-3 py-2 font-medium">Durum</th>
              <th className="px-3 py-2 font-medium">Personel</th>
              <th className="px-3 py-2 font-medium">Rezervasyon</th>
              <th className="px-3 py-2 font-medium">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-muted-foreground px-3 py-6 text-center"
                >
                  Henüz veri yok. Yukarıdaki butonlarla Instagram DM&apos;lerini
                  çekin.
                </td>
              </tr>
            ) : (
              tableRows.map((row) => (
                <tr key={row.conversationId} className="border-border border-t">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDate(row.lastMessageAt)}
                  </td>
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="px-3 py-2">{row.statusLabel}</td>
                  <td className="px-3 py-2">
                    {row.hasStaff ? "Var" : "Yok"}
                  </td>
                  <td className="px-3 py-2">
                    {row.reservation ? "Evet" : "Hayır"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="underline disabled:opacity-40"
                      disabled={pending || !row.hasStaff}
                      onClick={() => compareOne(row.conversationId)}
                    >
                      Karşılaştır
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {comparison ? (
        <div className="space-y-3">
          <h3 className="font-medium">
            Karşılaştırma — İnsan {comparison.humanAverage} / AI{" "}
            {comparison.aiAverage}
          </h3>
          <p className="text-muted-foreground text-sm">
            İlk geride kalınan tur:{" "}
            {comparison.firstBehindTurnIndex ?? "—"}
            {comparison.betterAlternativeOverall
              ? ` · Alternatif: ${comparison.betterAlternativeOverall}`
              : ""}
          </p>
          <ul className="space-y-2">
            {comparison.turns.map((t) => (
              <li
                key={t.turnIndex}
                className="border-border rounded-md border p-3 text-sm"
              >
                <div className="font-medium">
                  Tur {t.turnIndex} — İnsan {t.humanScore} / AI {t.aiScore}
                  {t.multiJudge
                    ? ` · MJ ${t.multiJudge.average} (S${t.multiJudge.sales}/P${t.multiJudge.psychologist}/M${t.multiJudge.customer})`
                    : ""}
                </div>
                <p className="text-muted-foreground mt-1">
                  Müşteri: {t.customerMessage}
                </p>
                <p className="mt-1">Personel: {t.humanReply}</p>
                <p className="mt-1">AI: {t.aiReply}</p>
                {t.betterAlternative ? (
                  <p className="mt-1 text-emerald-800 dark:text-emerald-300">
                    Alternatif: {t.betterAlternative}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {reportText ? (
        <pre className="border-border bg-muted/40 max-h-80 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap">
          {reportText}
        </pre>
      ) : null}
    </div>
  );
}
