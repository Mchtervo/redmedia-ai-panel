import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getTodayIsoInIstanbul } from "@/features/ai/prompts/simple-assistant";
import type {
  CeoHotOpportunity,
  CeoMetricsSnapshot,
  CeoNamedCount,
} from "@/features/ceo-intelligence/types";
import {
  addDaysIso,
  getMonthRangeIstanbul,
  getWeekRangeIstanbul,
  istanbulDayEnd,
  istanbulDayStart,
} from "@/features/ceo-intelligence/utils/time";

type TypedSupabaseClient = SupabaseClient<Database>;

const REVENUE_STATUSES = [
  "confirmed",
  "deposit_pending",
  "payment_review",
  "shoot_completed",
  "completed",
] as const;

function countByLabel(rows: { label: string; id?: string }[]): CeoNamedCount[] {
  const map = new Map<string, CeoNamedCount>();
  for (const row of rows) {
    const key = row.label.trim() || "Bilinmiyor";
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { id: row.id ?? key, label: key, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function parseObjections(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n|/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

/** Tüm CEO metriklerini DB'den toplar. Yazma yok. */
export async function collectCeoMetrics(
  supabase: TypedSupabaseClient,
  now = new Date()
): Promise<CeoMetricsSnapshot> {
  const reportDate = getTodayIsoInIstanbul(now);
  const yesterday = addDaysIso(reportDate, -1);
  const week = getWeekRangeIstanbul(reportDate);
  const month = getMonthRangeIstanbul(reportDate);
  const dayStart = istanbulDayStart(reportDate).toISOString();
  const dayEnd = istanbulDayEnd(reportDate).toISOString();
  const yesterdayStart = istanbulDayStart(yesterday).toISOString();
  const yesterdayEnd = istanbulDayEnd(yesterday).toISOString();
  const monthStart = istanbulDayStart(month.start).toISOString();
  const monthEnd = istanbulDayEnd(month.end).toISOString();
  const ago30 = istanbulDayStart(addDaysIso(reportDate, -30)).toISOString();
  const aheadEndDate = addDaysIso(reportDate, 7);

  const dataGaps: string[] = [];

  const [
    newCustomersRes,
    activeConvRes,
    depositProfilesRes,
    receiptsRes,
    shootsTodayRes,
    staffActiveRes,
    todayReservationIdsRes,
    weekReservationsRes,
    monthReservationsRes,
    pendingCollectRes,
    hotRes,
    plateausRes,
    servicesRes,
    attributionRes,
    campaignsRes,
    objectionsRes,
    negotiatingRes,
    aheadReservationsRes,
    monthWithServicesRes,
    monthReservationIdsRes,
    depositsVerifiedTodayRes,
    salesTodayRes,
    salesYesterdayRes,
  ] = await Promise.all([
    supabase
      .from("customer_profiles")
      .select("id", { count: "exact", head: true })
      .gte("first_seen", dayStart)
      .lte("first_seen", dayEnd),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "pending"]),
    supabase
      .from("customer_profiles")
      .select("id", { count: "exact", head: true })
      .eq("lifecycle_stage", "awaiting_deposit"),
    supabase
      .from("payment_receipts")
      .select("id", { count: "exact", head: true })
      .in("status", ["uploaded", "analyzing", "needs_review"])
      .eq("payment_confirmed", false),
    supabase
      .from("reservations")
      .select(
        "id, total_price, selected_plato_id, selected_service_ids, status, event_date"
      )
      .eq("event_date", reportDate)
      .in("status", [...REVENUE_STATUSES]),
    supabase
      .from("staff_members")
      .select("id, full_name")
      .eq("active", true),
    supabase
      .from("reservations")
      .select("id")
      .eq("event_date", reportDate)
      .in("status", [...REVENUE_STATUSES]),
    supabase
      .from("reservations")
      .select("id, total_price, event_date, status")
      .gte("event_date", week.start)
      .lte("event_date", week.end)
      .in("status", [...REVENUE_STATUSES]),
    supabase
      .from("reservations")
      .select("id, status, created_at, total_price")
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd),
    supabase
      .from("reservations")
      .select("id, remaining_amount, remaining_payment_status, status")
      .in("status", ["confirmed", "shoot_completed", "completed"])
      .in("remaining_payment_status", ["unpaid", "partial"])
      .gt("remaining_amount", 0),
    supabase
      .from("customer_profiles")
      .select(
        "contact_id, full_name, username, opportunity_score, lifecycle_stage, tags, last_seen"
      )
      .gte("opportunity_score", 60)
      .not("lifecycle_stage", "in", '("completed","cancelled","passive")')
      .order("opportunity_score", { ascending: false })
      .limit(8),
    supabase.from("plateaus").select("id, name"),
    supabase.from("services").select("id, name"),
    supabase
      .from("attribution_events")
      .select("campaign_id, event_type")
      .gte("occurred_at", monthStart)
      .not("campaign_id", "is", null),
    supabase.from("campaigns").select("id, name"),
    supabase
      .from("customer_profiles")
      .select("objections")
      .not("objections", "is", null)
      .gte("updated_at", ago30)
      .limit(500),
    supabase
      .from("customer_profiles")
      .select("id", { count: "exact", head: true })
      .eq("lifecycle_stage", "negotiating")
      .gte("updated_at", ago30),
    supabase
      .from("reservations")
      .select("event_date, status")
      .gte("event_date", reportDate)
      .lte("event_date", aheadEndDate)
      .in("status", [...REVENUE_STATUSES]),
    supabase
      .from("reservations")
      .select("selected_service_ids")
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd)
      .in("status", [...REVENUE_STATUSES])
      .limit(400),
    supabase
      .from("reservations")
      .select("id")
      .gte("event_date", month.start)
      .lte("event_date", month.end)
      .in("status", [...REVENUE_STATUSES]),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("deposit_status", "verified")
      .gte("deposit_verified_at", dayStart)
      .lte("deposit_verified_at", dayEnd),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .in("status", ["confirmed", "completed", "shoot_completed"])
      .gte("updated_at", dayStart)
      .lte("updated_at", dayEnd),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .in("status", ["confirmed", "completed", "shoot_completed"])
      .gte("updated_at", yesterdayStart)
      .lte("updated_at", yesterdayEnd),
  ]);

  const todayReservationIds = (todayReservationIdsRes.data ?? []).map(
    (r) => r.id
  );
  const monthReservationIds = (monthReservationIdsRes.data ?? []).map(
    (r) => r.id
  );

  const [assignmentsTodayRes, monthAssignmentsRes] = await Promise.all([
    todayReservationIds.length === 0
      ? Promise.resolve({ data: [] as { staff_member_id: string }[] })
      : supabase
          .from("reservation_staff_assignments")
          .select("staff_member_id")
          .in("reservation_id", todayReservationIds)
          .in("assignment_status", ["proposed", "assigned", "accepted"]),
    monthReservationIds.length === 0
      ? Promise.resolve({ data: [] as { staff_member_id: string }[] })
      : supabase
          .from("reservation_staff_assignments")
          .select("staff_member_id")
          .in("reservation_id", monthReservationIds)
          .in("assignment_status", ["assigned", "accepted", "completed"]),
  ]);

  const shootsToday = shootsTodayRes.data ?? [];
  const weekReservations = weekReservationsRes.data ?? [];
  const estimatedRevenueToday = shootsToday.reduce(
    (sum, r) => sum + Number(r.total_price ?? 0),
    0
  );
  const estimatedRevenueThisWeek = weekReservations.reduce(
    (sum, r) => sum + Number(r.total_price ?? 0),
    0
  );

  const pendingCollect = pendingCollectRes.data ?? [];
  const pendingCollections = pendingCollect.reduce(
    (sum, r) => sum + Number(r.remaining_amount ?? 0),
    0
  );

  const staffActive = staffActiveRes.data ?? [];
  const staffMap = new Map(staffActive.map((s) => [s.id, s.full_name]));
  const onDutyIds = new Set(
    (assignmentsTodayRes.data ?? [])
      .map((a) => a.staff_member_id)
      .filter((id): id is string => Boolean(id))
  );

  const monthRows = monthReservationsRes.data ?? [];
  const reservationsThisMonth = monthRows.filter((r) =>
    REVENUE_STATUSES.includes(
      r.status as (typeof REVENUE_STATUSES)[number]
    )
  ).length;
  const cancelledThisMonth = monthRows.filter(
    (r) => r.status === "cancelled" || r.status === "lost"
  ).length;
  const conversionRateMonth =
    monthRows.length === 0
      ? null
      : Math.round((reservationsThisMonth / monthRows.length) * 1000) / 10;

  const plateauMap = new Map(
    (plateausRes.data ?? []).map((p) => [p.id, p.name])
  );
  const serviceMap = new Map(
    (servicesRes.data ?? []).map((s) => [s.id, s.name])
  );
  const campaignMap = new Map(
    (campaignsRes.data ?? []).map((c) => [c.id, c.name ?? c.id])
  );

  const monthPlatoRes = await supabase
    .from("reservations")
    .select("selected_plato_id")
    .gte("created_at", monthStart)
    .lte("created_at", monthEnd)
    .in("status", [...REVENUE_STATUSES])
    .not("selected_plato_id", "is", null)
    .limit(400);

  const topPlateausFromToday = countByLabel(
    shootsToday
      .filter((r) => r.selected_plato_id)
      .map((r) => ({
        id: r.selected_plato_id!,
        label: plateauMap.get(r.selected_plato_id!) ?? "Plato",
      }))
  );

  const topPlateausMonth = countByLabel(
    (monthPlatoRes.data ?? []).map((r) => ({
      id: r.selected_plato_id!,
      label: plateauMap.get(r.selected_plato_id!) ?? "Plato",
    }))
  ).slice(0, 8);

  const packageRows: { label: string; id?: string }[] = [];
  for (const r of monthWithServicesRes.data ?? []) {
    for (const sid of r.selected_service_ids ?? []) {
      packageRows.push({ id: sid, label: serviceMap.get(sid) ?? sid });
    }
  }
  const topPackages = countByLabel(packageRows).slice(0, 8);

  const staffShootRows: { label: string; id: string }[] = [];
  for (const a of monthAssignmentsRes.data ?? []) {
    const sid = a.staff_member_id;
    if (!sid) continue;
    staffShootRows.push({
      id: sid,
      label: staffMap.get(sid) ?? sid,
    });
  }
  const topStaffByShoots = countByLabel(staffShootRows).slice(0, 8);

  const attrRows = attributionRes.data ?? [];
  if (attrRows.length === 0) {
    dataGaps.push(
      "Reklam atıf verisi (attribution_events) boş veya kampanya bağlı değil."
    );
  }
  const topCampaignsByAttribution = countByLabel(
    attrRows
      .filter((e) => e.campaign_id)
      .map((e) => ({
        id: e.campaign_id!,
        label: campaignMap.get(e.campaign_id!) ?? e.campaign_id!,
      }))
  ).slice(0, 8);

  const objectionParts: { label: string }[] = [];
  for (const row of objectionsRes.data ?? []) {
    for (const o of parseObjections(row.objections)) {
      objectionParts.push({ label: o });
    }
  }
  const topObjections = countByLabel(objectionParts).slice(0, 8);

  const busyFromAhead = new Map<string, number>();
  for (const r of aheadReservationsRes.data ?? []) {
    if (!r.event_date) continue;
    busyFromAhead.set(
      r.event_date,
      (busyFromAhead.get(r.event_date) ?? 0) + 1
    );
  }
  // Geçmiş günler "boş gün fırsatı" değildir; yalnızca bugün ve sonrası.
  const freeDaysThisWeek = week.days.filter(
    (d) => d >= reportDate && (busyFromAhead.get(d) ?? 0) === 0
  );
  const busyDaysAhead: CeoNamedCount[] = [...busyFromAhead.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([date, count]) => ({ id: date, label: date, count }));

  const hotOpportunities: CeoHotOpportunity[] = (hotRes.data ?? []).map(
    (p) => ({
      contactId: p.contact_id,
      name: p.full_name || p.username || "Müşteri",
      opportunityScore: p.opportunity_score,
      lifecycleStage: p.lifecycle_stage,
      tags: p.tags ?? [],
      lastSeen: p.last_seen,
    })
  );

  return {
    reportDate,
    generatedAt: now.toISOString(),
    newCustomersToday: newCustomersRes.count ?? 0,
    activeConversations: activeConvRes.count ?? 0,
    awaitingDeposit: depositProfilesRes.count ?? 0,
    awaitingReceiptReview: receiptsRes.count ?? 0,
    shootsToday: shootsToday.length,
    staffOnDutyToday: onDutyIds.size,
    staffIdleToday: Math.max(0, staffActive.length - onDutyIds.size),
    staffActiveTotal: staffActive.length,
    estimatedRevenueToday,
    estimatedRevenueThisWeek,
    pendingCollections,
    pendingCollectionsCount: pendingCollect.length,
    reservationsThisMonth,
    cancelledThisMonth,
    depositsVerifiedToday: depositsVerifiedTodayRes.count ?? 0,
    conversionRateMonth,
    hotOpportunities,
    topPackages,
    topPlateaus:
      topPlateausMonth.length > 0 ? topPlateausMonth : topPlateausFromToday,
    topStaffByShoots,
    topCampaignsByAttribution,
    topObjections,
    negotiatingLast30Days: negotiatingRes.count ?? 0,
    freeDaysThisWeek,
    busyDaysAhead,
    salesYesterday: salesYesterdayRes.count ?? 0,
    salesToday: salesTodayRes.count ?? 0,
    dataGaps,
  };
}
