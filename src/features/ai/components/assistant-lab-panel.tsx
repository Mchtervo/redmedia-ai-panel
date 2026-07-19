import type { ReactNode } from "react";
import type { AssistantLabDashboardData } from "@/features/ai/services/assistant-lab.service";
import { AssistantLabTabs } from "@/features/ai/components/assistant-lab-tabs";
import { AssistantLabLearnButton } from "@/features/ai/components/assistant-lab-learn-button";
import {
  PERSONALITY_TRAIT_TYPE_LABELS,
  SALES_PATTERN_TYPE_LABELS,
  AI_MISTAKE_TYPE_LABELS,
} from "@/features/sales-learning/types";

type Props = {
  data: AssistantLabDashboardData;
};

function formatLabPrice(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatusStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border rounded-md border bg-background px-3 py-2">
      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
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
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function formatRunTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AssistantLabPanel({ data }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Asistan Laboratuvarı
        </h1>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          Geçmiş konuşmalardan öğrenilen hafıza, şirket karakteri, hizmet
          kataloğu ve canlı asistan motoru burada birleşir. Aşağıda müşteri
          gibi yazıp cevabı test edebilirsiniz — mesaj Instagram&apos;a
          gitmez.
        </p>
      </div>

      <div className="border-border space-y-4 rounded-lg border bg-neutral-50 px-4 py-4 text-sm dark:bg-neutral-950">
        <div>
          <p className="font-medium">Asistan ne öğrendi? — durum</p>
          <p className="text-muted-foreground mt-1">
            {data.learningScheduleNote}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatusStat
            label="Satış kalıbı"
            value={data.learningStatus.patternCount}
          />
          <StatusStat
            label="Kişilik / karakter"
            value={data.learningStatus.personalityCount}
          />
          <StatusStat
            label="İyileştirme notu"
            value={data.learningStatus.activeMistakeCount}
          />
          <StatusStat
            label="En iyi konuşma"
            value={data.learningStatus.bestConversationCount}
          />
          <StatusStat
            label="Öğrenilecek (yaklaşık)"
            value={data.learningStatus.pendingLearnApprox}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-muted-foreground text-xs">
            Son koşu:{" "}
            {data.learningStatus.lastRunAt
              ? `${formatRunTime(data.learningStatus.lastRunAt)} · ${data.learningStatus.lastRunStatus} · ${data.learningStatus.lastRunAnalyzed ?? 0} analiz`
              : "henüz yok — aşağıdaki düğmeyle başlatın"}
          </p>
          <AssistantLabLearnButton />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Hizmet kataloğu (kaynak)"
          description="Fiyat ve paket yalnızca buradaki aktif kayıtlardan gelir; asistan uydurmaz."
        >
          {data.catalog.services.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aktif hizmet yok. Katalog / hizmetler ekranından ekleyin.
            </p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {data.catalog.services.map((s) => (
                <li key={s.id}>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatLabPrice(s.basePrice)}
                  </span>
                  {s.description ? (
                    <p className="text-muted-foreground text-xs">
                      {s.description.slice(0, 140)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {data.catalog.campaigns.length > 0 ? (
            <div className="border-border mt-4 border-t pt-3">
              <p className="mb-2 text-xs font-medium tracking-wide uppercase">
                Aktif kampanyalar
              </p>
              <ul className="space-y-2 text-sm">
                {data.catalog.campaigns.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{c.name}</span>
                    {c.description ? (
                      <p className="text-muted-foreground text-xs">
                        {c.description}
                      </p>
                    ) : null}
                    {c.requiredServiceNames.length > 0 ? (
                      <p className="text-muted-foreground text-xs">
                        Gerekli: {c.requiredServiceNames.join(" + ")}
                        {c.rewardedServiceName
                          ? ` · hediye/ek: ${c.rewardedServiceName}`
                          : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground mt-3 text-xs">
              Aktif kampanya yok. Paket fırsatları yalnızca katalogda
              tanımlıysa asistan önerebilir.
            </p>
          )}
        </Section>

        <Section
          title="Asistan karakteri"
          description="Geçmiş konuşmalardan öğrenilen şirket kişiliği (AI Memory)."
        >
          {data.personality.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Henüz kişilik gözlemi yok. Öğrenme koşusu çalıştıkça dolacak.
            </p>
          ) : (
            <ul className="max-h-64 space-y-3 overflow-y-auto text-sm">
              {data.personality.map((trait) => (
                <li key={trait.id}>
                  <p className="font-medium">
                    {PERSONALITY_TRAIT_TYPE_LABELS[trait.trait_type] ??
                      trait.trait_type}
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
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Öğrenilen satış kalıpları"
          description="İkna, itiraz, kayıp nedeni — üslup için; fiyat kaynağı değil."
        >
          {data.topPatterns.length === 0 ? (
            <p className="text-muted-foreground text-sm">Henüz kalıp yok.</p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
              {data.topPatterns.map((p) => (
                <li key={p.id}>
                  <p className="font-medium">
                    {SALES_PATTERN_TYPE_LABELS[p.pattern_type] ??
                      p.pattern_type}
                  </p>
                  <p className="text-muted-foreground">{p.pattern_text}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Son öğrenme koşuları"
          description="Cron / manuel analiz özeti."
        >
          {data.recentLearningRuns.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Henüz koşu yok. Aşağıdaki AI Öğrenme araçlarından manuel
              çalıştırabilirsiniz.
            </p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
              {data.recentLearningRuns.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap items-baseline justify-between gap-2"
                >
                  <span>
                    {formatRunTime(run.started_at)}
                    <span className="text-muted-foreground">
                      {" "}
                      · {run.trigger_source} · {run.status}
                    </span>
                  </span>
                  <span className="text-muted-foreground tabular-nums text-xs">
                    tarama {run.conversations_scanned} · analiz{" "}
                    {run.conversations_analyzed} · bilgi{" "}
                    {run.knowledge_proposed}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.activeMistakes.length > 0 ? (
            <div className="border-border mt-3 border-t pt-3">
              <p className="mb-2 text-xs font-medium tracking-wide uppercase">
                Aktif iyileştirme notları
              </p>
              <ul className="space-y-2 text-sm">
                {data.activeMistakes.map((m) => (
                  <li key={m.id} className="text-muted-foreground">
                    <span className="text-foreground font-medium">
                      {AI_MISTAKE_TYPE_LABELS[m.mistake_type] ??
                        m.mistake_type}
                    </span>
                    {" — "}
                    {m.trigger_context}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>
      </div>

      <AssistantLabTabs
        labReady={data.labReady}
        labReadyReason={data.labReadyReason}
      />
    </div>
  );
}
