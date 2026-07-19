import type { ReactNode } from "react";
import type { SalesLearningDashboardData } from "@/features/sales-learning/types";
import {
  AI_MISTAKE_TYPE_LABELS,
  PERSONALITY_TRAIT_TYPE_LABELS,
  SALES_PATTERN_TYPE_LABELS,
} from "@/features/sales-learning/types";
import {
  ResolveMistakeButton,
  WeeklyReportButton,
} from "@/features/sales-learning/components/sales-learning-panel-client";
import {
  GeneratePlaybookButton,
  PlaybookStatusButtons,
} from "@/features/playbooks/components/playbook-panel-client";
import {
  jsonToStringArray,
  PLAYBOOK_CATEGORY_LABELS,
  PLAYBOOK_STATUS_LABELS,
} from "@/features/playbooks/types";

type Props = {
  data: SalesLearningDashboardData;
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border rounded-lg border p-4">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? (
          <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case "won":
      return "Kazanıldı";
    case "lost":
      return "Kaybedildi";
    case "open":
      return "Devam ediyor";
    default:
      return "Bilinmiyor";
  }
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export function SalesLearningDashboard({ data }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          AI Satış Öğrenme Motoru
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          AI her konuşmadan öğrenir: başarılı satış kalıpları, Redmedia
          iletişim kimliği, kendi hataları ve en iyi satış konuşmaları kalıcı
          hafızada tutulur. Her cevap öncesi bu hafıza kullanılır.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Öğrenilen satış kalıbı" value={data.patternCount} />
        <StatCard
          label="Şirket kişiliği gözlemi"
          value={data.personalityCount}
        />
        <StatCard label="Aktif AI hatası" value={data.activeMistakeCount} />
        <StatCard
          label="En iyi konuşma kütüphanesi"
          value={data.bestConversationCount}
        />
      </div>

      <Section
        title="Konuşma puanları"
        description="Her analiz edilen konuşma 5 boyutta puanlanır; eksikler yazılır."
      >
        {data.scoredAnalyses.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Henüz puanlanmış konuşma yok. Analiz koşusu sonrası burada
            görünecek.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-medium">Müşteri isteği</th>
                  <th className="py-2 pr-3 font-medium">Satış</th>
                  <th className="py-2 pr-3 font-medium">Empati</th>
                  <th className="py-2 pr-3 font-medium">Hız</th>
                  <th className="py-2 pr-3 font-medium">İkna</th>
                  <th className="py-2 pr-3 font-medium">Kapanış</th>
                  <th className="py-2 pr-3 font-medium">Sonuç</th>
                  <th className="py-2 font-medium">Eksikler</th>
                </tr>
              </thead>
              <tbody>
                {data.scoredAnalyses.map((row) => (
                  <tr key={row.id} className="border-border border-b">
                    <td className="max-w-56 py-2 pr-3">
                      {row.customerIntent ?? "—"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.scoreSalesQuality ?? "—"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.scoreEmpathy ?? "—"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.scoreSpeed ?? "—"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.scorePersuasion ?? "—"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.scoreClosing ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {outcomeLabel(row.saleOutcome)}
                    </td>
                    <td className="text-muted-foreground max-w-72 py-2">
                      {row.scoreNotes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Öğrenilen satış kalıpları"
          description="Başarı oranı yüksek kalıplar cevaplarda öncelik alır."
        >
          {data.topPatterns.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Henüz öğrenilmiş kalıp yok.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {data.topPatterns.map((pattern) => (
                <li key={pattern.id}>
                  <p className="font-medium">
                    {SALES_PATTERN_TYPE_LABELS[pattern.pattern_type]}
                    {pattern.success_rate != null ? (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · başarı %{Math.round(pattern.success_rate)} ·{" "}
                        {pattern.seen_count} konuşma
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {pattern.seen_count} konuşma
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    {pattern.pattern_text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Şirket kişiliği (AI Memory)"
          description="AI'nin Redmedia hakkında öğrendikleri; kalıcıdır ve her gün büyür."
        >
          {data.personality.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Henüz kişilik gözlemi yok.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {data.personality.map((trait) => (
                <li key={trait.id}>
                  <p className="font-medium">
                    {PERSONALITY_TRAIT_TYPE_LABELS[trait.trait_type]}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {trait.evidence_count} kanıt
                    </span>
                  </p>
                  <p className="text-muted-foreground">{trait.trait_text}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="AI hataları (Self Improvement)"
          description="AI aynı hatayı ikinci kez yapmamak için bu listeyi her cevapta kullanır."
        >
          {data.activeMistakes.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aktif AI hatası yok.
            </p>
          ) : (
            <ul className="space-y-4 text-sm">
              {data.activeMistakes.map((mistake) => (
                <li key={mistake.id} className="space-y-1">
                  <p className="font-medium">
                    {AI_MISTAKE_TYPE_LABELS[mistake.mistake_type]}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {mistake.occurrence_count} kez
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Durum: {mistake.trigger_context}
                  </p>
                  <p className="text-muted-foreground">
                    Doğrusu: {mistake.correct_approach}
                  </p>
                  <ResolveMistakeButton mistakeId={mistake.id} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="En iyi satış konuşmaları"
          description="Rezervasyonla sonuçlanan yüksek puanlı konuşmalar; yeni cevaplarda örnek alınır."
        >
          {data.bestConversations.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Henüz kütüphaneye eklenen konuşma yok. Kazanılan ve yüksek
              puanlı konuşmalar otomatik eklenir.
            </p>
          ) : (
            <ul className="space-y-4 text-sm">
              {data.bestConversations.map((best) => (
                <li key={best.analysisId} className="space-y-1">
                  <p className="font-medium">
                    {best.customerIntent ?? "Müşteri isteği bilinmiyor"}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {best.scoreSalesQuality ?? "—"}/100 ·{" "}
                      {formatDate(best.analyzedAt)}
                    </span>
                  </p>
                  {best.firstCustomerQuestion ? (
                    <p className="text-muted-foreground">
                      İlk soru: {best.firstCustomerQuestion}
                    </p>
                  ) : null}
                  {best.advancingReply ? (
                    <p className="text-muted-foreground">
                      Satışı ilerleten cevap: {best.advancingReply}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section
        title="Playbook'lar"
        description="Kazanan konuşmalardan derlenen, yeniden kullanılabilir satış akışları. Taslaklar siz aktifleştirmeden AI cevaplarında kullanılmaz."
      >
        <GeneratePlaybookButton />
        {data.playbooks.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Henüz playbook yok. Yeterli kanıt biriktiğinde otomatik taslak
            üretilir veya yukarıdaki butonla şimdi deneyebilirsiniz.
          </p>
        ) : (
          <ul className="space-y-5 text-sm">
            {data.playbooks.map((playbook) => {
              const steps = jsonToStringArray(playbook.steps);
              const rules = jsonToStringArray(playbook.decision_rules);
              return (
                <li
                  key={playbook.id}
                  className="border-border space-y-2 rounded-md border p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{playbook.title}</p>
                    <span className="text-muted-foreground text-xs">
                      {PLAYBOOK_CATEGORY_LABELS[playbook.category]} ·{" "}
                      {PLAYBOOK_STATUS_LABELS[playbook.status]} · güven %
                      {Math.round(playbook.confidence)}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    Ne zaman: {playbook.trigger_context}
                  </p>
                  {steps.length > 0 ? (
                    <ol className="text-muted-foreground list-decimal space-y-0.5 pl-5">
                      {steps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  ) : null}
                  {rules.length > 0 ? (
                    <div>
                      <p className="font-medium">Karar kuralları</p>
                      <ul className="text-muted-foreground list-disc space-y-0.5 pl-5">
                        {rules.map((rule, index) => (
                          <li key={index}>{rule}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {playbook.source_note ? (
                    <p className="text-muted-foreground text-xs">
                      {playbook.source_note}
                    </p>
                  ) : null}
                  <PlaybookStatusButtons
                    playbookId={playbook.id}
                    status={playbook.status}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section
        title="Neden rezervasyon olmuyor?"
        description={`Son ${data.reservationBlockers.periodDays} gün — konuşma analizlerinden deterministik özet (uydurma yok).`}
      >
        {data.reservationBlockers.dataSufficiency === "insufficient" ? (
          <p className="text-muted-foreground text-sm">
            Yeterli kayıp/analiz verisi yok. Konuşmalar öğrenildikçe burada
            toplanır.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <p>
              Rezervasyonsuz:{" "}
              <strong>
                {data.reservationBlockers.analyzedWithoutReservation}
              </strong>{" "}
              · Kayıp: <strong>{data.reservationBlockers.lostCount}</strong> ·
              Açık: <strong>{data.reservationBlockers.openCount}</strong>
            </p>
            {data.reservationBlockers.topReasons.length > 0 ? (
              <ul className="list-inside list-disc space-y-1">
                {data.reservationBlockers.topReasons.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    {r.label}{" "}
                    <span className="text-muted-foreground">({r.count})</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {data.reservationBlockers.suggestions[0] ? (
              <p className="text-muted-foreground">
                {data.reservationBlockers.suggestions[0]}
              </p>
            ) : null}
          </div>
        )}
      </Section>

      <Section
        title="Haftalık AI öz değerlendirme"
        description="AI her hafta kendini değerlendirir: öğrendikleri, hataları, düzelttikleri ve en iyi/kötü cevapları."
      >
        <WeeklyReportButton />
        {data.latestWeeklyReport ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Son rapor: {data.latestWeeklyReport.week_start} –{" "}
              {data.latestWeeklyReport.week_end}
              {data.latestWeeklyReport.data_sufficiency === "insufficient"
                ? " · Yeterli veri bulunamadı"
                : data.latestWeeklyReport.data_sufficiency === "partial"
                  ? " · Kısmi veri"
                  : " · Yeterli veri"}
            </p>
            <pre className="border-border bg-muted/30 max-h-96 overflow-auto rounded-md border p-4 text-xs leading-relaxed whitespace-pre-wrap">
              {data.latestWeeklyReport.summary_md}
            </pre>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Henüz haftalık rapor yok. Rapor her Pazartesi otomatik oluşturulur
            veya yukarıdaki butonla şimdi oluşturabilirsiniz.
          </p>
        )}
      </Section>
    </div>
  );
}
