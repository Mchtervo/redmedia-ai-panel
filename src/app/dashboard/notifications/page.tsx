import type { Metadata } from "next";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { createAdminClient } from "@/server/supabase/admin";
import { listPanelNotifications } from "@/features/notifications/services/notifications.service";
import {
  MarkAllReadButton,
  MarkReadButton,
} from "@/features/notifications/components/notification-buttons";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatusBadge, type StatusTone } from "@/components/dashboard/status-badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Bildirimler — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  ai_approval_pending: "Onay talebi",
  staff_assignment: "Personel ataması",
  reservation: "Rezervasyon",
  automation: "Otomasyon",
};

const TYPE_TONES: Record<string, StatusTone> = {
  ai_approval_pending: "warning",
  staff_assignment: "info",
  reservation: "brand",
  automation: "neutral",
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function approvalLink(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === "object" &&
    "approvalId" in payload &&
    typeof (payload as Record<string, unknown>).approvalId === "string"
  ) {
    return "/dashboard/approvals";
  }
  return null;
}

type Props = {
  searchParams: Promise<{ filter?: string; type?: string }>;
};

export default async function NotificationsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const unreadOnly = sp.filter === "unread";
  const typeFilter = sp.type ?? null;

  const supabase = createAdminClient();
  const all = await listPanelNotifications(supabase, { limit: 100 });
  const unreadCount = all.filter((n) => !n.read_at).length;
  const availableTypes = [...new Set(all.map((n) => n.type))];

  const notifications = all.filter((n) => {
    if (unreadOnly && n.read_at) return false;
    if (typeFilter && n.type !== typeFilter) return false;
    return true;
  });

  const filterHref = (params: { filter?: string; type?: string }) => {
    const search = new URLSearchParams();
    if (params.filter) search.set("filter", params.filter);
    if (params.type) search.set("type", params.type);
    const qs = search.toString();
    return qs ? `/dashboard/notifications?${qs}` : "/dashboard/notifications";
  };

  const chipClass = (active: boolean) =>
    cn(
      "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
      active
        ? "bg-primary text-primary-foreground"
        : "bg-muted text-muted-foreground hover:text-foreground"
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operasyon"
        title="Bildirimler"
        description={
          unreadCount > 0
            ? `${unreadCount} okunmamış bildirim var.`
            : "Tüm bildirimler okundu."
        }
        actions={unreadCount > 0 ? <MarkAllReadButton /> : undefined}
      />

      {/* Filtreler */}
      <nav aria-label="Bildirim filtreleri" className="flex flex-wrap gap-1.5">
        <Link
          href={filterHref({ type: typeFilter ?? undefined })}
          className={chipClass(!unreadOnly)}
        >
          Tümü ({all.length})
        </Link>
        <Link
          href={filterHref({ filter: "unread", type: typeFilter ?? undefined })}
          className={chipClass(unreadOnly)}
        >
          Okunmamış ({unreadCount})
        </Link>
        <span aria-hidden className="bg-border mx-1 w-px self-stretch" />
        <Link
          href={filterHref({ filter: unreadOnly ? "unread" : undefined })}
          className={chipClass(typeFilter === null)}
        >
          Tüm kategoriler
        </Link>
        {availableTypes.map((type) => (
          <Link
            key={type}
            href={filterHref({
              filter: unreadOnly ? "unread" : undefined,
              type,
            })}
            className={chipClass(typeFilter === type)}
          >
            {typeLabel(type)}
          </Link>
        ))}
      </nav>

      {notifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={
            unreadOnly ? "Okunmamış bildirim yok" : "Bildirim bulunamadı"
          }
          description={
            typeFilter
              ? "Bu kategoride bildirim yok. Filtreyi genişletmeyi deneyin."
              : "Sistem olayları gerçekleştikçe bildirimler burada görünecek."
          }
        />
      ) : (
        <ul className="space-y-2">
          {notifications.map((notification) => {
            const link = approvalLink(notification.payload);
            const isUnread = !notification.read_at;
            return (
              <li
                key={notification.id}
                className={cn(
                  "bg-card rounded-xl p-3.5 text-sm ring-1 ring-foreground/10 transition-opacity",
                  !isUnread && "opacity-65"
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      isUnread ? "bg-primary" : "bg-border"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{notification.title}</p>
                      <StatusBadge
                        tone={TYPE_TONES[notification.type] ?? "neutral"}
                        withDot={false}
                      >
                        {typeLabel(notification.type)}
                      </StatusBadge>
                      {isUnread ? (
                        <span className="text-primary text-[11px] font-medium">
                          Yeni
                        </span>
                      ) : null}
                    </div>
                    {notification.body ? (
                      <p className="text-muted-foreground mt-1">
                        {notification.body}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {link ? (
                        <Link
                          href={link}
                          className="text-primary text-xs underline-offset-4 hover:underline"
                        >
                          Onay kuyruğuna git
                        </Link>
                      ) : null}
                      {notification.reservation_id ? (
                        <Link
                          href={`/dashboard/reservations/${notification.reservation_id}`}
                          className="text-primary text-xs underline-offset-4 hover:underline"
                        >
                          Rezervasyonu aç
                        </Link>
                      ) : null}
                      {isUnread ? (
                        <MarkReadButton notificationId={notification.id} />
                      ) : null}
                    </div>
                  </div>
                  <time
                    dateTime={notification.created_at}
                    className="text-muted-foreground shrink-0 text-xs whitespace-nowrap"
                  >
                    {formatDateTime(notification.created_at)}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
