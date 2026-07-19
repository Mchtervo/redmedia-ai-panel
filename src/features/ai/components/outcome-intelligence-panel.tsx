import Link from "next/link";
import type { OutcomeIntelligenceDashboard } from "@/features/ai/services/outcome-kpi.service";
import type { QualityFactor } from "@/features/ai/services/conversation-quality.service";

type Props = {
  data: OutcomeIntelligenceDashboard;
};

function FunnelStep({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function FactorChips({ factors }: { factors: QualityFactor[] }) {
  const visible = factors.filter((f) => f.label !== "Başlangıç tabanı");
  if (visible.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {visible.slice(0, 4).map((f) => (
        <li
          key={`${f.sign}${f.label}`}
          className={
            f.sign === "+"
              ? "bg-muted text-foreground rounded px-1.5 py-0.5 text-[11px]"
              : "border-border text-muted-foreground rounded border px-1.5 py-0.5 text-[11px]"
          }
        >
          {f.sign}
          {f.delta} {f.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Aksiyon odaklı Outcome Intelligence — rapor değil, düzeltme.
 */
export function OutcomeIntelligencePanel({ data }: Props) {
  const {
    kpi,
    ab,
    funnel,
    leaderboard,
    worstConversations,
    heat,
    topImprovements,
    humanVsAiInsight,
    suggestionSuccess,
  } = data;
  const maxHeat = Math.max(1, ...heat.current.map((h) => h.count));

  const trendWeeks = [...new Set(heat.weeklyTrend.map((t) => t.weekStart))]
    .sort()
    .slice(-6);

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Outcome Intelligence
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Amaç rapor değil: en yüksek etkili 3 iyileştirmeyi uygulamak. Demo /
          seed / test konuşmalar üretim listesinde yok.
        </p>
      </div>

      {/* Top 3 improvements — hero */}
      <div className="border-border rounded-lg border p-4 sm:p-6">
        <h3 className="text-lg font-semibold">Bu hafta yapılacak 3 iyileştirme</h3>
        <p className="text-muted-foreground mt-0.5 text-sm">
          En yüksek etki sırası — tek tek uygulayın, conversion’ı izleyin.
        </p>
        <ol className="mt-4 space-y-4">
          {topImprovements.map((item) => (
            <li
              key={item.rank}
              className="border-border flex flex-col gap-2 rounded-md border p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs tabular-nums">
                  #{item.rank} · {item.metric}
                </p>
                <p className="mt-0.5 text-base font-semibold">{item.title}</p>
                <p className="text-muted-foreground mt-1 text-sm">{item.why}</p>
                <p className="mt-2 text-sm">
                  <span className="font-medium">Nasıl: </span>
                  {item.how}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Etki: {item.impact}
                </p>
              </div>
              {item.href ? (
                <Link
                  href={item.href}
                  className="border-border hover:bg-muted shrink-0 rounded-md border px-3 py-2 text-center text-sm font-medium"
                >
                  Düzeltmeye git
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      {/* Funnel */}
      <div className="border-border rounded-lg border p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold">{funnel.periodLabel}</h3>
          <p className="text-muted-foreground text-xs">
            Conversion hedef metrik · {funnel.monthStart} → {funnel.monthEnd}
          </p>
        </div>
        <ol className="mt-4 space-y-3">
          {(
            [
              ["Konuşma", String(funnel.conversations)],
              ["Fiyat verildi", String(funnel.priceGiven)],
              ["Takip", String(funnel.followUp)],
              ["Kapora (verified)", String(funnel.deposit)],
              ["Rezervasyon (confirmed+)", String(funnel.reservation)],
              ["Conversion", `%${funnel.conversionPct}`],
            ] as const
          ).map(([label, value], i, arr) => (
            <li key={label}>
              <FunnelStep label={label} value={value} />
              {i < arr.length - 1 ? (
                <p className="text-muted-foreground pl-1 text-sm" aria-hidden>
                  ↓
                </p>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground mt-3 text-xs">
          Kapora = deposit_status verified · Rezervasyon = confirmed /
          completed / shoot_completed · Pipeline aday:{" "}
          {funnel.reservationPipeline} · Kapora oranı: %{funnel.depositRatePct}
        </p>
        {funnel.biggestDrop ? (
          <p className="border-border mt-3 border-t pt-3 text-sm">
            <span className="font-medium">En büyük sızıntı: </span>
            {funnel.biggestDrop.from} → {funnel.biggestDrop.to} (
            {funnel.biggestDrop.lost} konuşma, %{funnel.biggestDrop.rate})
          </p>
        ) : null}
      </div>

      {/* Suggestion success rates */}
      <div className="border-border rounded-lg border p-4">
        <h3 className="text-base font-semibold">
          Öneri başarı oranları
        </h3>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Düzeltme ekranından gönderilen cevaplar → gerçek rezervasyon.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs">Uygulandı</p>
            <p className="text-2xl font-semibold tabular-nums">
              {suggestionSuccess.applied}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Müşteri yanıtladı</p>
            <p className="text-2xl font-semibold tabular-nums">
              {suggestionSuccess.customerReplied}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Kapora</p>
            <p className="text-2xl font-semibold tabular-nums">
              {suggestionSuccess.deposits}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Rezervasyon oranı</p>
            <p className="text-2xl font-semibold tabular-nums">
              %{suggestionSuccess.reservationRatePct}
            </p>
          </div>
        </div>
        {suggestionSuccess.byLossReason.length > 0 ? (
          <ul className="mt-4 space-y-1.5 text-sm">
            {suggestionSuccess.byLossReason.slice(0, 5).map((row) => (
              <li
                key={row.lossReason}
                className="flex flex-wrap justify-between gap-2"
              >
                <span>{row.lossReason}</span>
                <span className="tabular-nums text-muted-foreground">
                  {row.reservations}/{row.applied} (%{row.reservationRatePct})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground mt-3 text-sm">
            Henüz uygulama yok. En kötü konuşmayı açıp “Tek tıkla gönder”
            kullanın.
          </p>
        )}
      </div>

      {/* Worst 20 */}
      <div className="border-border rounded-lg border p-4">
        <h3 className="text-base font-semibold">En kötü 20 konuşma</h3>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Skor + nedenler. Tıklayınca tam konuşma, analiz ve alternatif cevap.
        </p>
        {worstConversations.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            Skor yok. Migration sonrası{" "}
            <code className="text-xs">npm run quality:score</code> çalıştırın.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {worstConversations.map((row) => (
              <li key={row.conversationId} className="py-3">
                <Link
                  href={`/dashboard/ai/corrections/${row.conversationId}`}
                  className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium underline-offset-2 hover:underline">
                        {row.contactName ??
                          row.externalConversationId ??
                          row.conversationId.slice(0, 8)}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-sm">
                        {row.lossReason ?? row.primaryIssue ?? row.summary}
                      </p>
                      <FactorChips factors={row.factors} />
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold tabular-nums">
                        {row.score}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {row.grade}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Leaderboard */}
      <div className="border-border rounded-lg border p-4">
        <h3 className="text-base font-semibold">Leaderboard — Bu hafta</h3>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {leaderboard.weekStart} → {leaderboard.weekEnd}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="border-border rounded-md border p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              AI
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {leaderboard.aiReservations}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">rezervasyon</p>
            <p className="mt-2 text-sm">
              Kapora:{" "}
              <span className="font-medium tabular-nums">
                {leaderboard.aiDeposits}
              </span>
              {" · "}
              Ort. kalite:{" "}
              <span className="font-medium tabular-nums">
                {leaderboard.aiAvgQuality ?? "—"}
              </span>
            </p>
          </div>
          <div className="border-border rounded-md border p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Personel
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {leaderboard.staffReservations}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">rezervasyon</p>
            <p className="mt-2 text-sm">
              Kapora:{" "}
              <span className="font-medium tabular-nums">
                {leaderboard.staffDeposits}
              </span>
              {" · "}
              Ort. kalite:{" "}
              <span className="font-medium tabular-nums">
                {leaderboard.staffAvgQuality ?? "—"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Human vs AI with examples */}
      <div className="border-border rounded-lg border p-4">
        <h3 className="text-base font-semibold">Human vs AI — neden?</h3>
        <p className="mt-2 text-sm">{humanVsAiInsight.explanation}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Ortalama: İnsan {humanVsAiInsight.humanAverage ?? "—"} · AI{" "}
          {humanVsAiInsight.aiAverage ?? "—"} · Kazanan:{" "}
          {humanVsAiInsight.winner === "human"
            ? "Personel"
            : humanVsAiInsight.winner === "ai"
              ? "AI"
              : "Berabere / veri yok"}
        </p>
        <ul className="mt-4 space-y-3">
          {humanVsAiInsight.examples.map((ex) => (
            <li
              key={ex.title}
              className="border-border rounded-md border p-3 text-sm"
            >
              <p className="font-medium">{ex.title}</p>
              <p className="text-muted-foreground mt-1">{ex.whyBetter}</p>
              {ex.snippet ? (
                <p className="mt-2 whitespace-pre-wrap text-xs opacity-90">
                  “{ex.snippet}”
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {/* Heat map + weekly trend */}
      <div className="border-border rounded-lg border p-4">
        <h3 className="text-base font-semibold">Kayıp Heat Map</h3>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Gerçek kayıp nedenleri + haftalık trend.
        </p>
        {heat.current.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            Henüz kayıp analizi yok. En kötü konuşmaları açıp analiz üretin.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {heat.current.map((row) => (
              <li key={row.reason} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0">{row.label}</span>
                <div className="bg-muted h-2 flex-1 overflow-hidden rounded">
                  <div
                    className="bg-foreground h-full rounded"
                    style={{ width: `${(row.count / maxHeat) * 100}%` }}
                  />
                </div>
                <span className="w-8 tabular-nums font-medium">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
        {trendWeeks.length > 0 ? (
          <div className="border-border mt-4 overflow-x-auto border-t pt-3">
            <p className="mb-2 text-xs font-medium">Haftalık trend</p>
            <table className="w-full min-w-[320px] text-left text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-1 pr-2 font-medium">Hafta</th>
                  {heat.current.slice(0, 4).map((r) => (
                    <th key={r.reason} className="px-1 py-1 font-medium">
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trendWeeks.map((week) => (
                  <tr key={week} className="border-border border-t">
                    <td className="py-1.5 pr-2 tabular-nums">{week}</td>
                    {heat.current.slice(0, 4).map((r) => {
                      const n =
                        heat.weeklyTrend.find(
                          (t) => t.weekStart === week && t.reason === r.reason
                        )?.count ?? 0;
                      return (
                        <td key={r.reason} className="px-1 py-1.5 tabular-nums">
                          {n || "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* Compact secondary metrics */}
      <details className="border-border rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          İkincil metrikler (Reply / A/B)
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="border-border rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Reply Rate</p>
            <p className="text-xl font-semibold tabular-nums">
              %{kpi.replyRate}
            </p>
          </div>
          <div className="border-border rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Conversation</p>
            <p className="text-xl font-semibold tabular-nums">
              %{kpi.conversationRate}
            </p>
          </div>
          <div className="border-border rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Price Accepted</p>
            <p className="text-xl font-semibold tabular-nums">
              %{kpi.priceAcceptedRate}
            </p>
          </div>
          <div className="border-border rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">A/B kazanan</p>
            <p className="text-xl font-semibold">
              {ab.winner === "insufficient" ? "—" : ab.winner}
            </p>
          </div>
          <div className="border-border rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Haftalık konuşma</p>
            <p className="text-xl font-semibold tabular-nums">
              {kpi.totalConversations}
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}
