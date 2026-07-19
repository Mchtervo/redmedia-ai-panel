"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/dashboard/status-badge";
import { decideApprovalAction } from "@/features/approvals/actions/approval-actions";
import {
  APPROVAL_ACTION_LABELS,
  type ApprovalActionType,
} from "@/features/approvals/types";

export type ApprovalQueueItem = {
  id: string;
  actionType: ApprovalActionType;
  title: string;
  confidence: number | null;
  customerMessage: string | null;
  neutralReply: string | null;
  conversationId: string | null;
  contactId: string | null;
  createdAt: string;
};

/**
 * Öncelik gösterimi gerçek alanlardan türetilir:
 * düşük güven skoru + hassas aksiyon tipi = yüksek öncelik.
 */
function derivePriority(item: ApprovalQueueItem): {
  label: string;
  tone: StatusTone;
} {
  const sensitive =
    item.actionType === "assistant_reply" || item.actionType === "budget_change";
  const lowConfidence = item.confidence !== null && item.confidence < 0.5;
  if (sensitive && lowConfidence) return { label: "Yüksek öncelik", tone: "danger" };
  if (sensitive || lowConfidence) return { label: "Orta öncelik", tone: "warning" };
  return { label: "Normal", tone: "neutral" };
}

function riskTone(actionType: ApprovalActionType): { label: string; tone: StatusTone } {
  switch (actionType) {
    case "assistant_reply":
      return { label: "Müşteri iletişimi riski", tone: "warning" };
    case "budget_change":
      return { label: "Bütçe riski", tone: "danger" };
    case "knowledge_publish":
      return { label: "İçerik riski", tone: "info" };
    case "playbook_activate":
      return { label: "Süreç riski", tone: "info" };
    default:
      return { label: "Düşük risk", tone: "neutral" };
  }
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function ConfidenceBar({ value }: { value: number }) {
  const percent = Math.round(value * 100);
  const tone =
    percent >= 75 ? "bg-success" : percent >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">
        %{percent} güven
      </span>
    </div>
  );
}

export function ApprovalQueue({ items }: { items: ApprovalQueueItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<ApprovalActionType | "all">("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      typeFilter === "all"
        ? items
        : items.filter((item) => item.actionType === typeFilter),
    [items, typeFilter]
  );

  const availableTypes = useMemo(
    () => [...new Set(items.map((item) => item.actionType))],
    [items]
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function decide(ids: string[], decision: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      for (const id of ids) {
        const result = await decideApprovalAction({
          approvalId: id,
          decision,
          note: notes[id]?.trim() || undefined,
        });
        if (!result.success) {
          setError(result.error);
          return;
        }
      }
      setSelected(new Set());
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Filtre + toplu işlem çubuğu */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Aksiyon tipine göre filtrele">
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              typeFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Tümü ({items.length})
          </button>
          {availableTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                typeFilter === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {APPROVAL_ACTION_LABELS[type]}
            </button>
          ))}
        </div>
        {selected.size > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {selected.size} seçili
            </span>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => decide([...selected], "approved")}
            >
              Seçilenleri onayla
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => decide([...selected], "rejected")}
            >
              Seçilenleri reddet
            </Button>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      <ul className="space-y-3">
        {filtered.map((item) => {
          const priority = derivePriority(item);
          const risk = riskTone(item.actionType);
          return (
            <li
              key={item.id}
              className="bg-card space-y-3 rounded-xl p-4 text-sm ring-1 ring-foreground/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <label className="flex min-w-0 cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggle(item.id)}
                    aria-label={`${item.title} talebini seç`}
                    className="accent-primary mt-0.5 size-4 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {APPROVAL_ACTION_LABELS[item.actionType]}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </span>
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge tone={priority.tone}>{priority.label}</StatusBadge>
                  <StatusBadge tone={risk.tone} withDot={false}>
                    {risk.label}
                  </StatusBadge>
                </div>
              </div>

              <p className="font-medium">{item.title}</p>
              {item.confidence !== null ? (
                <ConfidenceBar value={item.confidence} />
              ) : null}

              {item.customerMessage ? (
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <p className="text-muted-foreground mb-0.5 text-[11px] font-medium tracking-wide uppercase">
                    Kanıt · müşteri mesajı
                  </p>
                  <p className="text-sm">{item.customerMessage}</p>
                </div>
              ) : null}
              {item.neutralReply ? (
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <p className="text-muted-foreground mb-0.5 text-[11px] font-medium tracking-wide uppercase">
                    Gönderilen nötr ara cevap
                  </p>
                  <p className="text-sm">{item.neutralReply}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 text-xs">
                {item.conversationId ? (
                  <Link
                    href={`/dashboard/inbox/${item.conversationId}`}
                    className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
                  >
                    Konuşmayı aç <ArrowRight aria-hidden className="size-3" />
                  </Link>
                ) : null}
                {item.contactId ? (
                  <Link
                    href={`/dashboard/customers/${item.contactId}`}
                    className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
                  >
                    Müşteri kartı <ArrowRight aria-hidden className="size-3" />
                  </Link>
                ) : null}
              </div>

              <div className="border-t border-border/40 pt-3">
                <label className="block">
                  <span className="text-muted-foreground text-xs">
                    Karar notu (opsiyonel)
                  </span>
                  <input
                    type="text"
                    value={notes[item.id] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    maxLength={500}
                    className="border-input bg-background focus-visible:ring-ring/50 mt-1 w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus-visible:ring-2"
                    placeholder="Örn. %10 indirim onaylandı, müşteri arandı"
                  />
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() => decide([item.id], "approved")}
                  >
                    Onayla
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => decide([item.id], "rejected")}
                  >
                    Reddet
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
