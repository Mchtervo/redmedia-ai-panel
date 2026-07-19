import type { Metadata } from "next";
import Link from "next/link";
import { CheckCheck, History } from "lucide-react";
import { createAdminClient } from "@/server/supabase/admin";
import { listApprovals } from "@/features/approvals/repositories/approvals.repository";
import {
  APPROVAL_ACTION_LABELS,
  APPROVAL_STATUS_LABELS,
} from "@/features/approvals/types";
import {
  ApprovalQueue,
  type ApprovalQueueItem,
} from "@/features/approvals/components/approval-queue";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatusBadge, type StatusTone } from "@/components/dashboard/status-badge";
import { KpiCard } from "@/components/dashboard/kpi-card";

export const metadata: Metadata = {
  title: "Onay Kuyruğu — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

function payloadField(payload: unknown, key: string): string | null {
  if (payload && typeof payload === "object" && key in payload) {
    const value = (payload as Record<string, unknown>)[key];
    return typeof value === "string" ? value : null;
  }
  return null;
}

const STATUS_TONES: Record<string, StatusTone> = {
  approved: "success",
  rejected: "danger",
  expired: "neutral",
  pending: "warning",
};

export default async function ApprovalsPage() {
  const supabase = createAdminClient();
  const [pending, recent] = await Promise.all([
    listApprovals(supabase, { status: "pending", limit: 50 }),
    listApprovals(supabase, { limit: 30 }),
  ]);
  const recentDecided = recent.filter((a) => a.status !== "pending");
  const decidedToday = recentDecided.filter(
    (a) =>
      a.decided_at &&
      new Date(a.decided_at).toDateString() === new Date().toDateString()
  );
  const confidences = pending
    .map((a) => a.confidence)
    .filter((c): c is number => c !== null);
  const avgConfidence =
    confidences.length > 0
      ? Math.round(
          (confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100
        )
      : null;

  const queueItems: ApprovalQueueItem[] = pending.map((approval) => ({
    id: approval.id,
    actionType: approval.action_type,
    title: approval.title,
    confidence: approval.confidence,
    customerMessage: payloadField(approval.payload, "customerMessage"),
    neutralReply: payloadField(approval.payload, "neutralReplySent"),
    conversationId: approval.conversation_id,
    contactId: approval.contact_id,
    createdAt: approval.created_at,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Yapay Zekâ"
        title="Onay Kuyruğu"
        description="Şikayet, indirim, iptal ve özel fiyat taleplerinde AI nihai karar vermez; nötr ara cevap gönderilir ve karar burada size düşer."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Bekleyen talep" value={String(pending.length)} />
        <KpiCard
          label="Bugün karar verilen"
          value={String(decidedToday.length)}
        />
        <KpiCard
          label="Ortalama AI güveni (bekleyen)"
          value={avgConfidence === null ? "—" : `%${avgConfidence}`}
        />
      </div>

      {pending.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title="Bekleyen onay talebi yok"
          description="AI, insan onayı gerektiren bir durum tespit ettiğinde talep burada görünecek."
        />
      ) : (
        <ApprovalQueue items={queueItems} />
      )}

      <SectionCard
        title="Son kararlar"
        description="En son karara bağlanan 10 talep"
        contentClassName="p-0"
      >
        {recentDecided.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={History}
              compact
              title="Henüz karar verilmiş talep yok"
            />
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {recentDecided.slice(0, 10).map((approval) => (
              <li key={approval.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">
                    {approval.title}
                  </p>
                  <StatusBadge tone={STATUS_TONES[approval.status] ?? "neutral"}>
                    {APPROVAL_STATUS_LABELS[approval.status]}
                  </StatusBadge>
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {APPROVAL_ACTION_LABELS[approval.action_type]} ·{" "}
                  {new Date(approval.created_at).toLocaleString("tr-TR")}
                  {approval.decision_note
                    ? ` · Not: ${approval.decision_note}`
                    : ""}
                </p>
                {approval.conversation_id ? (
                  <Link
                    href={`/dashboard/inbox/${approval.conversation_id}`}
                    className="text-primary mt-1 inline-block text-xs underline-offset-4 hover:underline"
                  >
                    Konuşmayı aç
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
