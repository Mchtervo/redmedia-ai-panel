"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  markFollowUpSentAction,
  sendFollowUpViaMetaAction,
  skipFollowUpAction,
} from "@/features/follow-ups/actions/follow-up-actions";

export type FollowUpQueueItem = {
  id: string;
  reason: string;
  status: string;
  scheduled_at: string;
  attempt_count: number;
  ai_generated_message: string | null;
  conversation_id: string | null;
  contact_id: string | null;
  canSendViaMeta?: boolean;
  contactUsername?: string | null;
};

type FollowUpQueueProps = {
  tasks: FollowUpQueueItem[];
};

function statusTone(
  status: string
): "success" | "warning" | "info" | "neutral" | "danger" {
  if (status === "queued") return "warning";
  if (status === "sent") return "success";
  if (status === "pending") return "info";
  if (status === "skipped" || status === "cancelled") return "neutral";
  if (status === "failed") return "danger";
  return "neutral";
}

export function FollowUpQueue({ tasks }: FollowUpQueueProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Mesaj panoya kopyalandı. Gerekirse Instagram’a yapıştırın.");
    } catch {
      setMessage("Kopyalanamadı. Metni elle seçin.");
    }
  }

  function sendViaMeta(id: string) {
    startTransition(async () => {
      const result = await sendFollowUpViaMetaAction(id);
      setMessage(
        result.success
          ? "Meta üzerinden Instagram DM gönderildi."
          : result.error
      );
    });
  }

  function markSent(id: string) {
    startTransition(async () => {
      const result = await markFollowUpSentAction(id);
      setMessage(
        result.success
          ? "Gönderildi olarak işaretlendi."
          : result.error
      );
    });
  }

  function skip(id: string) {
    startTransition(async () => {
      const result = await skipFollowUpAction(id);
      setMessage(result.success ? "Görev atlandı." : result.error);
    });
  }

  if (tasks.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Bekleyen görev yok.</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Meta IGSID eşleşmiş müşterilerde doğrudan Instagram DM gönderilir.
        Eşleşme yoksa: kopyala → Instagram’da gönder → &quot;Gönderildi&quot;
        işaretle.
      </p>
      {message ? (
        <p className="text-sm" role="status">
          {message}
        </p>
      ) : null}
      <ul className="space-y-3">
        {tasks.map((t) => (
          <li
            key={t.id}
            className="border-border space-y-2 rounded-xl border p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">
                {t.reason}
                {t.contactUsername ? (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · @{t.contactUsername}
                  </span>
                ) : null}{" "}
                <StatusBadge tone={statusTone(t.status)} withDot={false}>
                  {t.status}
                </StatusBadge>
                {t.canSendViaMeta ? (
                  <StatusBadge tone="success" withDot={false}>
                    Meta hazır
                  </StatusBadge>
                ) : null}
              </div>
              <span className="text-muted-foreground text-xs">
                {new Date(t.scheduled_at).toLocaleString("tr-TR")} · deneme{" "}
                {t.attempt_count}
              </span>
            </div>
            <p className="bg-muted/40 rounded-lg p-2 text-sm whitespace-pre-wrap">
              {t.ai_generated_message ?? "(mesaj yok)"}
            </p>
            <div className="flex flex-wrap gap-2">
              {t.canSendViaMeta &&
              (t.status === "queued" || t.status === "pending") &&
              t.ai_generated_message ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => sendViaMeta(t.id)}
                >
                  Meta ile gönder
                </Button>
              ) : null}
              {t.ai_generated_message ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => copyText(t.ai_generated_message!)}
                >
                  Kopyala
                </Button>
              ) : null}
              {t.conversation_id ? (
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/dashboard/inbox/${t.conversation_id}`} />}
                >
                  Inbox
                </Button>
              ) : null}
              {t.contact_id ? (
                <Button
                  size="sm"
                  variant="ghost"
                  render={<Link href={`/dashboard/customers/${t.contact_id}`} />}
                >
                  Müşteri
                </Button>
              ) : null}
              {(t.status === "queued" || t.status === "pending") && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => markSent(t.id)}
                  >
                    Gönderildi işaretle
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => skip(t.id)}
                  >
                    Atla
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
