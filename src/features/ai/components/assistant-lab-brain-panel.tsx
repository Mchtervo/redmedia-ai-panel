"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { LabBrainTrace } from "@/features/ai/services/lab-brain.service";
import { formatLabBrainTraceForCopy } from "@/features/ai/services/lab-brain.service";

type Props = {
  traces: LabBrainTrace[];
  pending: boolean;
};

function NumberedList({
  items,
  empty,
}: {
  items: string[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{empty}</p>;
  }
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-sm">
      {items.map((item, index) => (
        <li key={`${index}-${item.slice(0, 40)}`} className="leading-snug">
          {item}
        </li>
      ))}
    </ol>
  );
}

function GroupCard({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: "danger" | "ok" | "warn" | "neutral";
  children: ReactNode;
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-500/50 bg-red-500/5"
      : tone === "ok"
        ? "border-emerald-500/50 bg-emerald-500/5"
        : tone === "warn"
          ? "border-amber-500/50 bg-amber-500/5"
          : "border-border";

  return (
    <section className={`rounded-lg border p-3 sm:p-4 ${toneClass}`}>
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold tracking-tight">{title}</h4>
        <span className="text-muted-foreground text-xs tabular-nums">
          {count} madde
        </span>
      </header>
      {children}
    </section>
  );
}

export function AssistantLabBrainPanel({ traces, pending }: Props) {
  const [copied, setCopied] = useState(false);
  const latest = traces[traces.length - 1] ?? null;

  const sessionTotals = useMemo(() => {
    const errors = [...new Set(traces.flatMap((t) => t.errors))];
    const goods = [...new Set(traces.flatMap((t) => t.goodPoints))];
    const improvements = [...new Set(traces.flatMap((t) => t.improvements))];
    return { errors, goods, improvements };
  }, [traces]);

  async function copyReport() {
    const text = formatLabBrainTraceForCopy(traces, latest);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      id="lab-brain-panel"
      className="border-border mt-3 rounded-lg border"
    >
      <div className="border-border flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            Asistan beyni — canlı analiz (gruplu)
          </h3>
          <p className="text-muted-foreground text-xs">
            Hatalar / doğrular / iyileştirmeler listelenir. Ekran görüntüsü al
            veya raporu kopyalayıp yapıştır.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copyReport()}
          disabled={!latest}
          className="border-border hover:bg-muted disabled:opacity-40 rounded-md border px-3 py-1.5 text-xs font-medium"
        >
          {copied ? "Kopyalandı" : "Raporu kopyala"}
        </button>
      </div>

      <div className="space-y-4 p-4">
        {pending ? (
          <p className="text-muted-foreground text-sm">
            Canlı analiz çalışıyor…
          </p>
        ) : null}

        {!pending && !latest ? (
          <p className="text-muted-foreground text-sm">
            Henüz analiz yok. Test sohbetinde mesaj at; burada grup grup
            listelenecek.
          </p>
        ) : null}

        {latest ? (
          <>
            <div className="border-border rounded-md border border-dashed p-3 text-xs">
              <p className="text-muted-foreground mb-1 uppercase tracking-wide">
                Son tur özeti
              </p>
              <p>
                <span className="font-medium">Müşteri:</span>{" "}
                {latest.customerMessage || "—"}
              </p>
              <p className="mt-1">
                <span className="font-medium">Asistan:</span>{" "}
                {latest.replyPreview || "—"}
              </p>
            </div>

            {latest.salesBrain ? (
              <GroupCard
                title="0) Satış Beyni (skor · tip · objective · NBA)"
                count={10}
                tone="warn"
              >
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground text-xs">State</dt>
                    <dd className="font-medium">{latest.salesBrain.state}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      Müşteri tipi
                    </dt>
                    <dd className="font-medium">
                      {latest.salesBrain.customerType}
                      {latest.salesBrain.customerTypeLocked
                        ? " · kilitli"
                        : ` · %${latest.salesBrain.customerTypeConfidence}`}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground text-xs">
                      Lead skorları (Güven / Niyet / Fiyat hass. / Aciliyet)
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {latest.salesBrain.scores.trust} /{" "}
                      {latest.salesBrain.scores.purchaseIntent} /{" "}
                      {latest.salesBrain.scores.priceSensitivity} /{" "}
                      {latest.salesBrain.scores.urgency}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      Konuşma hedefi
                    </dt>
                    <dd className="font-medium">
                      {latest.salesBrain.objective}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      Next Best Action
                    </dt>
                    <dd className="font-medium">
                      {latest.salesBrain.nextBestAction}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      Emotion · Style
                    </dt>
                    <dd className="font-medium">
                      {latest.salesBrain.emotion} · {latest.salesBrain.style}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Engel</dt>
                    <dd className="font-medium">
                      {latest.salesBrain.mainBlocker}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground text-xs">Tek hedef</dt>
                    <dd>{latest.salesBrain.singleGoal}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground text-xs">Memory</dt>
                    <dd className="break-all font-mono text-xs">
                      {latest.salesBrain.memoryJson}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground text-xs">
                      Reflection
                    </dt>
                    <dd>
                      {latest.salesBrain.reflectPass == null
                        ? "—"
                        : latest.salesBrain.reflectPass
                          ? "Geçti"
                          : "Fail"}
                      {latest.salesBrain.reflectRewritten
                        ? " · yeniden yazıldı"
                        : ""}
                      {latest.salesBrain.reflectIssues.length > 0
                        ? ` — ${latest.salesBrain.reflectIssues.join("; ")}`
                        : ""}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground text-xs">
                      Decision Engine
                    </dt>
                    <dd>
                      {latest.salesBrain.strategyId ? (
                        <>
                          <span className="font-medium">
                            {latest.salesBrain.strategyId}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {latest.salesBrain.analysisPersona ?? "—"} ·{" "}
                            {latest.salesBrain.analysisStage ?? "—"} · sıcaklık{" "}
                            {latest.salesBrain.analysisLeadTemp ?? "—"} · risk{" "}
                            {latest.salesBrain.analysisRisk ?? "—"}
                          </span>
                        </>
                      ) : latest.salesBrain.strategistMove ? (
                        `${latest.salesBrain.strategistMove} — ${latest.salesBrain.strategistDirective ?? ""}`
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground text-xs">
                      Multi Judge (AI Judge)
                    </dt>
                    <dd>
                      {latest.salesBrain.criticOverallPass == null
                        ? "—"
                        : latest.salesBrain.criticOverallPass
                          ? "Geçti"
                          : "Zayıf"}
                      {latest.salesBrain.multiJudgeAverage != null
                        ? ` · ort ${latest.salesBrain.multiJudgeAverage}`
                        : ""}
                      {latest.salesBrain.criticRewritten
                        ? " · rewrite uygulandı"
                        : ""}
                      {latest.salesBrain.criticFeeling
                        ? ` — his: ${latest.salesBrain.criticFeeling}`
                        : ""}
                      {latest.salesBrain.criticNotes.length > 0
                        ? ` · ${latest.salesBrain.criticNotes.join("; ")}`
                        : ""}
                    </dd>
                  </div>
                </dl>
              </GroupCard>
            ) : null}

            <GroupCard title="1) Ne düşündü" count={1} tone="neutral">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {latest.thinking}
              </p>
            </GroupCard>

            {latest.salesSelfEval ? (
              <GroupCard
                title="2) Satış öz-değerlendirme"
                count={5}
                tone="warn"
              >
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground text-xs">Aşama</dt>
                    <dd className="font-medium">
                      {latest.salesSelfEval.customerStage}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      Rezervasyon olasılığı
                    </dt>
                    <dd className="font-medium tabular-nums">
                      %{latest.salesSelfEval.reservationProbabilityPct}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      Kaybetme riski
                    </dt>
                    <dd>{latest.salesSelfEval.lossRiskReason}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      Neden bu cevap
                    </dt>
                    <dd>{latest.salesSelfEval.whyThisReply}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      Daha iyi alternatif
                    </dt>
                    <dd>
                      {latest.salesSelfEval.betterAlternative ??
                        "(Mevcut cevap yeterli / alternatif yok)"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Baskı</dt>
                    <dd>{latest.salesSelfEval.pressureNote}</dd>
                  </div>
                </dl>
                <p className="text-muted-foreground mt-3 text-xs">
                  İlke: Rezervasyon almak, müşteriyi sıkıştırmaktan önemli.
                  Hazır değilse güven + takip.
                </p>
              </GroupCard>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-3">
              <GroupCard
                title="3) Hatalar"
                count={latest.errors.length}
                tone="danger"
              >
                <NumberedList
                  items={latest.errors}
                  empty="Bu turda hata listesi boş."
                />
              </GroupCard>

              <GroupCard
                title="4) Doğrular"
                count={latest.goodPoints.length}
                tone="ok"
              >
                <NumberedList
                  items={latest.goodPoints}
                  empty="Bu turda doğru madde yok."
                />
              </GroupCard>

              <GroupCard
                title="5) İyileştirmeler"
                count={latest.improvements.length}
                tone="warn"
              >
                <NumberedList
                  items={latest.improvements}
                  empty="İyileştirme önerisi yok."
                />
              </GroupCard>
            </div>

            <GroupCard
              title="6) Detaylar"
              count={latest.details.length}
              tone="neutral"
            >
              <NumberedList items={latest.details} empty="Detay yok." />
            </GroupCard>

            <GroupCard
              title="7) Kural motoru"
              count={latest.ruleChecks.length}
              tone="neutral"
            >
              <ol className="list-decimal space-y-2 pl-5 text-sm">
                {latest.ruleChecks.map((c) => (
                  <li key={c.rule}>
                    <span
                      className={
                        c.pass
                          ? "font-medium text-emerald-600 dark:text-emerald-400"
                          : "font-medium text-red-600 dark:text-red-400"
                      }
                    >
                      {c.pass ? "GEÇTİ" : "HATA"}
                    </span>
                    {" — "}
                    <span className="font-medium">{c.rule}</span>
                    <span className="text-muted-foreground"> · {c.note}</span>
                  </li>
                ))}
              </ol>
            </GroupCard>

            {traces.length > 1 ? (
              <GroupCard
                title={`8) Oturum birikimi (${traces.length} tur)`}
                count={
                  sessionTotals.errors.length +
                  sessionTotals.goods.length +
                  sessionTotals.improvements.length
                }
                tone="neutral"
              >
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold text-red-600 dark:text-red-400">
                      Tüm hatalar ({sessionTotals.errors.length})
                    </p>
                    <NumberedList
                      items={sessionTotals.errors}
                      empty="—"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Tüm doğrular ({sessionTotals.goods.length})
                    </p>
                    <NumberedList items={sessionTotals.goods} empty="—" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Tüm iyileştirmeler ({sessionTotals.improvements.length})
                    </p>
                    <NumberedList
                      items={sessionTotals.improvements}
                      empty="—"
                    />
                  </div>
                </div>
              </GroupCard>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
