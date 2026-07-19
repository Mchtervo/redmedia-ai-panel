import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  CeoActionItem,
  CeoMetricsSnapshot,
  CeoRiskItem,
} from "@/features/ceo-intelligence/types";
import {
  addDaysIso,
  istanbulDayEnd,
  istanbulDayStart,
} from "@/features/ceo-intelligence/utils/time";

type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Kural tabanlı risk tespiti — yazma yok, yalnızca okuma + metrik birleştirme.
 */
export async function detectCeoRisks(
  supabase: TypedSupabaseClient,
  metrics: CeoMetricsSnapshot
): Promise<CeoRiskItem[]> {
  const risks: CeoRiskItem[] = [];
  const today = metrics.reportDate;
  const dayStart = istanbulDayStart(today).toISOString();
  const ago24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  if (metrics.awaitingReceiptReview > 0) {
    risks.push({
      id: "pending-receipts",
      severity: metrics.awaitingReceiptReview >= 3 ? "high" : "medium",
      title: "Bekleyen dekont incelemesi",
      detail: `${metrics.awaitingReceiptReview} dekont admin onayı bekliyor.`,
      href: "/dashboard/payments",
    });
  }

  if (metrics.awaitingDeposit > 0) {
    risks.push({
      id: "pending-deposits",
      severity: metrics.awaitingDeposit >= 5 ? "high" : "medium",
      title: "Kapora bekleyen müşteriler",
      detail: `${metrics.awaitingDeposit} müşteri kapora aşamasında.`,
      href: "/dashboard/customers",
    });
  }

  // Aynı gün personel çift atama (basit: aynı staff + aynı gün >1 assignment)
  const { data: todayResRows } = await supabase
    .from("reservations")
    .select("id")
    .eq("event_date", today)
    .not("status", "in", '("cancelled","lost","draft")');
  const todayResIds = (todayResRows ?? []).map((r) => r.id);
  if (todayResIds.length > 0) {
    const { data: assignmentRows } = await supabase
      .from("reservation_staff_assignments")
      .select("staff_member_id")
      .in("reservation_id", todayResIds)
      .in("assignment_status", ["proposed", "assigned", "accepted"]);

    const byStaff = new Map<string, number>();
    for (const a of assignmentRows ?? []) {
      if (!a.staff_member_id) continue;
      byStaff.set(
        a.staff_member_id,
        (byStaff.get(a.staff_member_id) ?? 0) + 1
      );
    }
    const overlapIds = [...byStaff.entries()]
      .filter(([, count]) => count >= 2)
      .map(([id]) => id);
    if (overlapIds.length > 0) {
      const { data: staffRows } = await supabase
        .from("staff_members")
        .select("id, full_name")
        .in("id", overlapIds);
      const nameMap = new Map(
        (staffRows ?? []).map((s) => [s.id, s.full_name])
      );
      for (const staffId of overlapIds) {
        const count = byStaff.get(staffId) ?? 0;
        risks.push({
          id: `staff-overlap-${staffId}`,
          severity: "critical",
          title: "Aynı gün personel çoklu görev",
          detail: `${nameMap.get(staffId) ?? "Personel"} bugün ${count} rezervasyona atanmış — çakışma riski.`,
          href: "/dashboard/team/calendar",
        });
      }
    }
  }

  // Cevap verilmeyen sıcak müşteri
  const silentHot = await supabase
    .from("customer_profiles")
    .select(
      "contact_id, full_name, username, opportunity_score, last_seen, last_outbound_at"
    )
    .gte("opportunity_score", 70)
    .gte("last_seen", ago24h)
    .not("lifecycle_stage", "in", '("completed","cancelled","passive","reservation_confirmed")')
    .limit(20);

  for (const p of silentHot.data ?? []) {
    const lastOut = p.last_outbound_at
      ? new Date(p.last_outbound_at).getTime()
      : 0;
    const lastSeen = p.last_seen ? new Date(p.last_seen).getTime() : 0;
    if (lastSeen > 0 && lastSeen > lastOut + 2 * 60 * 60 * 1000) {
      risks.push({
        id: `silent-hot-${p.contact_id}`,
        severity: "high",
        title: "Cevapsız sıcak müşteri",
        detail: `${p.full_name || p.username || "Müşteri"} (skor ${p.opportunity_score}) — son mesajdan sonra outbound gecikmiş olabilir.`,
        href: `/dashboard/customers/${p.contact_id}`,
      });
    }
  }

  for (const day of metrics.busyDaysAhead.slice(0, 3)) {
    if (day.count >= 3) {
      risks.push({
        id: `busy-${day.label}`,
        severity: day.count >= 5 ? "high" : "medium",
        title: "Yaklaşan yoğun gün",
        detail: `${day.label} tarihinde ${day.count} çekim/rezervasyon planlı.`,
        href: "/dashboard/reservations",
      });
    }
  }

  // Takip edilmeyen (pending follow-ups overdue)
  const overdueFollowUps = await supabase
    .from("follow_up_tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString());

  if ((overdueFollowUps.count ?? 0) > 0) {
    risks.push({
      id: "overdue-followups",
      severity: "medium",
      title: "Gecikmiş takip görevleri",
      detail: `${overdueFollowUps.count} takip zamanı geçmiş.`,
      href: "/dashboard/follow-ups",
    });
  }

  // Yaklaşan teslim / kalan ödeme
  const dueSoon = await supabase
    .from("reservations")
    .select("id, customer_full_name, remaining_payment_due_at, remaining_amount")
    .in("remaining_payment_status", ["unpaid", "partial"])
    .not("remaining_payment_due_at", "is", null)
    .lte("remaining_payment_due_at", istanbulDayEnd(addDaysIso(today, 3)).toISOString())
    .gte("remaining_payment_due_at", dayStart)
    .limit(10);

  for (const r of dueSoon.data ?? []) {
    risks.push({
      id: `payment-due-${r.id}`,
      severity: "medium",
      title: "Yaklaşan tahsilat / teslim ödeme",
      detail: `${r.customer_full_name ?? "Müşteri"} — kalan ${r.remaining_amount} TL, vade ${r.remaining_payment_due_at?.slice(0, 10) ?? "?"}.`,
      href: `/dashboard/reservations/${r.id}`,
    });
  }

  // İptal riski etiketi
  const risky = await supabase
    .from("customer_profiles")
    .select("contact_id, full_name, username, tags, opportunity_score")
    .contains("tags", ["riskli müşteri"])
    .not("lifecycle_stage", "in", '("completed","cancelled","passive")')
    .limit(5);

  for (const p of risky.data ?? []) {
    risks.push({
      id: `cancel-risk-${p.contact_id}`,
      severity: "high",
      title: "İptal riski yüksek müşteri",
      detail: `${p.full_name || p.username || "Müşteri"} — etiket: riskli müşteri.`,
      href: `/dashboard/customers/${p.contact_id}`,
    });
  }

  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return risks.sort(
    (a, b) => severityOrder[a.severity]! - severityOrder[b.severity]!
  );
}

export function buildCeoActionItems(
  metrics: CeoMetricsSnapshot,
  risks: CeoRiskItem[]
): CeoActionItem[] {
  const items: CeoActionItem[] = [];

  if (metrics.awaitingReceiptReview > 0) {
    items.push({
      id: "review-receipts",
      title: "Dekontları incele",
      detail: `${metrics.awaitingReceiptReview} dekont onay bekliyor.`,
      href: "/dashboard/payments",
    });
  }
  if (metrics.awaitingDeposit > 0) {
    items.push({
      id: "nudge-deposits",
      title: "Kapora bekleyenleri kontrol et",
      detail: `${metrics.awaitingDeposit} müşteri kapora aşamasında.`,
      href: "/dashboard/customers",
    });
  }
  if (metrics.shootsToday > 0) {
    items.push({
      id: "today-shoots",
      title: "Bugünkü çekimleri doğrula",
      detail: `${metrics.shootsToday} çekim; ${metrics.staffOnDutyToday} personel görevli.`,
      href: "/dashboard/reservations",
    });
  }
  for (const hot of metrics.hotOpportunities.slice(0, 3)) {
    items.push({
      id: `hot-${hot.contactId}`,
      title: `Sıcak fırsat: ${hot.name}`,
      detail: `Skor ${hot.opportunityScore} — takip et.`,
      href: `/dashboard/customers/${hot.contactId}`,
    });
  }
  for (const risk of risks.filter((r) => r.severity === "critical").slice(0, 3)) {
    items.push({
      id: `act-${risk.id}`,
      title: risk.title,
      detail: risk.detail,
      href: risk.href,
    });
  }

  if (items.length === 0) {
    items.push({
      id: "all-clear",
      title: "Acil iş yok",
      detail: "Kritik bekleyen işlem görünmüyor; Inbox ve rezervasyonları gözden geçirin.",
      href: "/dashboard/inbox",
    });
  }

  return items.slice(0, 12);
}
