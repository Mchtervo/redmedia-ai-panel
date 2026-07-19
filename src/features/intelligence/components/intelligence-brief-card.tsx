import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/dashboard/status-badge";
import {
  INSUFFICIENT_EVIDENCE_MESSAGE,
  INTELLIGENCE_PRIORITY_LABELS,
  INTELLIGENCE_QUESTIONS,
  type IntelligenceBrief,
  type IntelligencePriority,
} from "@/features/intelligence/types";

function priorityTone(p: IntelligencePriority): StatusTone {
  if (p === "critical") return "danger";
  if (p === "high") return "danger";
  if (p === "medium") return "warning";
  return "neutral";
}

function bandLabel(band: IntelligenceBrief["confidenceBand"]): string {
  if (band === "exact") return "Doğrulanmış kaynak";
  if (band === "probable") return "Olası kaynak";
  return "Yetersiz veri";
}

function ConfidenceMeter({ value }: { value: number }) {
  const tone =
    value >= 75 ? "bg-success" : value >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
        <span
          className={`block h-full rounded-full ${tone}`}
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">
        %{value} güven
      </span>
    </span>
  );
}

export function IntelligenceBriefCard({
  brief,
}: {
  brief: IntelligenceBrief;
}) {
  const evidence =
    brief.evidence.length > 0
      ? brief.evidence
      : [{ label: "Kanıt", value: INSUFFICIENT_EVIDENCE_MESSAGE }];

  return (
    <article
      className="bg-card space-y-3 rounded-xl p-4 text-sm ring-1 ring-foreground/10"
      aria-label={brief.title}
    >
      <header className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={priorityTone(brief.priority)}>
            {INTELLIGENCE_PRIORITY_LABELS[brief.priority]}
          </StatusBadge>
          <ConfidenceMeter value={brief.confidence} />
          <span className="text-muted-foreground text-xs">
            {bandLabel(brief.confidenceBand)}
          </span>
        </div>
        <h3 className="text-base font-medium">{brief.title}</h3>
        <p className="text-muted-foreground text-sm">{brief.summary}</p>
      </header>

      <dl className="grid gap-2.5 rounded-lg border border-border/50 p-3 sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {INTELLIGENCE_QUESTIONS.why}
          </dt>
          <dd className="mt-0.5">{brief.why}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {INTELLIGENCE_QUESTIONS.whatNext}
          </dt>
          <dd className="mt-0.5">{brief.whatNext}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {INTELLIGENCE_QUESTIONS.doNow}
          </dt>
          <dd className="mt-0.5 font-medium">{brief.doNow}</dd>
        </div>
      </dl>

      <section aria-label="Kanıtlar">
        <h4 className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
          Kanıtlar
        </h4>
        <ul className="flex flex-wrap gap-1.5">
          {evidence.map((e) => (
            <li
              key={`${e.label}-${e.value}`}
              className="bg-muted/50 rounded-md px-2 py-1 text-xs"
            >
              <span className="text-muted-foreground">{e.label}: </span>
              <span className="font-medium tabular-nums">{e.value}</span>
            </li>
          ))}
        </ul>
      </section>

      {brief.href ? (
        <Link
          href={brief.href}
          className="text-primary inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
        >
          {brief.hrefLabel ?? "Panele git"}
          <ArrowRight aria-hidden className="size-3" />
        </Link>
      ) : null}
    </article>
  );
}

export function IntelligenceBriefList({
  briefs,
  emptyMessage = INSUFFICIENT_EVIDENCE_MESSAGE,
}: {
  briefs: IntelligenceBrief[];
  emptyMessage?: string;
}) {
  if (briefs.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
  }
  return (
    <ul className="space-y-3">
      {briefs.map((b) => (
        <li key={b.id}>
          <IntelligenceBriefCard brief={b} />
        </li>
      ))}
    </ul>
  );
}
