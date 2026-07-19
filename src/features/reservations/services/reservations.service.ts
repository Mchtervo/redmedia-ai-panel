import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import {
  quoteServicesByIds,
  getReservationSettings,
} from "@/features/pricing/services/quote-from-db.service";
import {
  checkAvailability,
  computeEffectiveBusyWindow,
} from "@/features/scheduling/services/availability.service";
import {
  findDraftByConversation,
  getReservationById,
  insertReservation,
  insertReservationChange,
  listBusyReservationsForDate,
  listReservationChanges,
  listReservationItems,
  listReservations,
  replaceReservationItems,
  updateReservation,
} from "@/features/reservations/repositories/reservations.repository";
import { runAutomationsForEvent } from "@/features/automations/services/automation-engine.service";

type TypedSupabaseClient = SupabaseClient<Database>;

export type ManualReservationInput = {
  customerFullName: string;
  customerPhone?: string | null;
  contactId?: string | null;
  conversationId?: string | null;
  customerProfileId?: string | null;
  eventType?: string | null;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  selectedPlatoId?: string | null;
  city?: string;
  district?: string | null;
  serviceIds: string[];
  depositAmount?: number;
  customerNotes?: string | null;
  internalNotes?: string | null;
  source?: "manual" | "instagram_ai" | "admin_panel" | "website";
  assignedTeamId?: string | null;
  conflictOverride?: boolean;
  conflictOverrideReason?: string | null;
  createdBy?: string | null;
  status?: Database["public"]["Tables"]["reservations"]["Row"]["status"];
};

function combineDateAndTime(
  eventDate: string,
  time: string | null | undefined,
  fallbackHour: number
): Date {
  if (time && /^\d{2}:\d{2}/.test(time)) {
    return new Date(`${eventDate}T${time.slice(0, 8) || time}:00+03:00`);
  }
  return new Date(
    `${eventDate}T${String(fallbackHour).padStart(2, "0")}:00:00+03:00`
  );
}

export async function createManualReservation(
  supabase: TypedSupabaseClient,
  input: ManualReservationInput
) {
  const settings = await getReservationSettings(supabase);
  const quote = await quoteServicesByIds(
    supabase,
    input.serviceIds,
    input.eventDate
  );
  const deposit =
    input.depositAmount ?? Number(settings?.default_deposit_amount ?? 1000);

  const start = combineDateAndTime(input.eventDate, input.startTime, 12);
  const end = combineDateAndTime(
    input.eventDate,
    input.endTime,
    input.startTime ? 14 : 14
  );
  if (input.endTime == null && input.startTime) {
    end.setHours(start.getHours() + 2);
  }

  const travelBefore = Number(settings?.default_travel_minutes ?? 60);
  const busy = computeEffectiveBusyWindow({
    scheduledStartAt: start,
    scheduledEndAt: end,
    travelBeforeMinutes: input.startTime ? travelBefore : 0,
    preparationBeforeMinutes: 0,
    travelAfterMinutes: 0,
  });

  const existing = await listBusyReservationsForDate(
    supabase,
    input.eventDate
  );
  const availability = checkAvailability({
    candidateStart: busy.effectiveBusyStartAt.toISOString(),
    candidateEnd: busy.effectiveBusyEndAt.toISOString(),
    platoId: input.selectedPlatoId,
    teamId: input.assignedTeamId,
    existing: existing.map((row) => ({
      id: row.id,
      status: row.status,
      platoId: row.selected_plato_id,
      teamId: row.assigned_team_id,
      effectiveBusyStartAt: row.effective_busy_start_at,
      effectiveBusyEndAt: row.effective_busy_end_at,
      timeStatus: row.time_status,
    })),
  });

  if (availability.hardConflict && !input.conflictOverride) {
    throw new Error(
      "Bu tarih/saat/plato için confirmed rezervasyon çakışması var. Devam için gerekçeli override gerekir."
    );
  }

  if (
    input.conflictOverride &&
    !input.conflictOverrideReason?.trim()
  ) {
    throw new Error("Çakışma override için gerekçe zorunludur.");
  }

  const timeStatus = input.startTime ? "confirmed" : "unknown";
  const locationStatus = input.selectedPlatoId || input.venueName
    ? "confirmed"
    : "unknown";

  const reservation = await insertReservation(supabase, {
    contact_id: input.contactId ?? null,
    conversation_id: input.conversationId ?? null,
    customer_profile_id: input.customerProfileId ?? null,
    customer_full_name: input.customerFullName,
    customer_phone: input.customerPhone ?? null,
    event_type: input.eventType ?? null,
    event_date: input.eventDate,
    start_time: input.startTime ?? null,
    end_time: input.endTime ?? null,
    venue_name: input.venueName ?? null,
    selected_plato_id: input.selectedPlatoId ?? null,
    city: input.city ?? "Ankara",
    district: input.district ?? null,
    selected_service_ids: input.serviceIds,
    package_snapshot: quote as unknown as Json,
    subtotal: quote.subtotal,
    discount_amount: quote.discountAmount,
    total_price: quote.totalPrice,
    deposit_amount: Math.min(deposit, quote.totalPrice),
    remaining_amount: Math.max(
      0,
      quote.totalPrice - Math.min(deposit, quote.totalPrice)
    ),
    deposit_status: "not_requested",
    remaining_payment_status: "unpaid",
    status: input.status ?? "inquiry",
    source: input.source ?? "admin_panel",
    assigned_team_id: input.assignedTeamId ?? null,
    customer_notes: input.customerNotes ?? null,
    internal_notes: input.internalNotes ?? null,
    created_by: input.createdBy ?? null,
    time_status: timeStatus,
    location_status: locationStatus,
    needs_time_followup: timeStatus === "unknown",
    needs_location_followup: locationStatus === "unknown",
    conflict_override: Boolean(input.conflictOverride),
    conflict_override_reason: input.conflictOverrideReason ?? null,
    scheduled_start_at: start.toISOString(),
    scheduled_end_at: end.toISOString(),
    effective_busy_start_at: busy.effectiveBusyStartAt.toISOString(),
    effective_busy_end_at: busy.effectiveBusyEndAt.toISOString(),
    location: input.venueName ?? null,
  });

  await replaceReservationItems(
    supabase,
    reservation.id,
    quote.lines.map((line, index) => ({
      reservation_id: reservation.id,
      service_id: line.serviceId,
      service_name_snapshot: line.serviceName,
      unit_price: line.unitPrice,
      quantity: line.quantity,
      discount_amount: line.discountAmount,
      final_price: line.finalPrice,
      sort_order: index,
      scheduled_start_at: start.toISOString(),
      scheduled_end_at: end.toISOString(),
      service_duration_minutes: Math.round(
        (end.getTime() - start.getTime()) / 60000
      ),
      travel_before_minutes: input.startTime ? travelBefore : 0,
      effective_busy_start_at: busy.effectiveBusyStartAt.toISOString(),
      effective_busy_end_at: busy.effectiveBusyEndAt.toISOString(),
      location_id: input.selectedPlatoId ?? null,
      location_text: input.venueName ?? null,
      time_status: timeStatus,
      location_status: locationStatus,
      metadata: {
        appliedCampaignId: line.appliedCampaignId ?? null,
      } as Json,
    }))
  );

  await insertReservationChange(supabase, {
    reservationId: reservation.id,
    changedByType: "staff",
    changedById: input.createdBy,
    fieldName: "created",
    newValue: { status: reservation.status, total: quote.totalPrice },
    reason: "Manuel rezervasyon oluşturuldu",
  });

  // Automation Engine (docs/14,32): reservation_created tetikleyicisi.
  // Hata ana akışı bozmaz.
  try {
    await runAutomationsForEvent(supabase, "reservation_created", {
      reservationId: reservation.id,
      totalPrice: quote.totalPrice,
      eventType: input.eventType ?? undefined,
      conversationId: input.conversationId ?? undefined,
      contactId: input.contactId ?? undefined,
    });
  } catch (automationError) {
    console.error(
      "[reservations] otomasyon hatası:",
      automationError instanceof Error ? automationError.message : "bilinmeyen"
    );
  }

  return { reservation, quote, availability };
}

export async function getReservationDetail(
  supabase: TypedSupabaseClient,
  id: string
) {
  const reservation = await getReservationById(supabase, id);
  if (!reservation) return null;
  const [items, changes] = await Promise.all([
    listReservationItems(supabase, id),
    listReservationChanges(supabase, id),
  ]);
  return { reservation, items, changes };
}

export async function listReservationsForCalendar(
  supabase: TypedSupabaseClient,
  filters?: Parameters<typeof listReservations>[1]
) {
  return listReservations(supabase, filters);
}

/**
 * Kapora kesinleştirme önkoşulu: IBAN'a yatmış + dekont ekran görüntüsü
 * Vision analizinden geçmiş (`receipt_verified=true`) kayıt zorunlu.
 */
export async function requireVerifiedKaporaReceipt(
  supabase: TypedSupabaseClient,
  reservationId: string
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("payment_receipts")
    .select("id, receipt_verified")
    .eq("reservation_id", reservationId)
    .eq("receipt_verified", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      "Kapora dekontu doğrulanmadan rezervasyon kesinleştirilemez. Müşteri IBAN'a kapora yatırmalı, dekont ekran görüntüsü atmalı ve analiz geçmeli (receipt_verified)."
    );
  }
  return { id: data.id };
}

export async function confirmDepositPayment(
  supabase: TypedSupabaseClient,
  reservationId: string,
  verifiedBy: string | null
) {
  const current = await getReservationById(supabase, reservationId);
  if (!current) throw new Error("Rezervasyon bulunamadı.");

  if (current.status === "confirmed") {
    throw new Error("Bu rezervasyon zaten kesinleşmiş.");
  }

  await requireVerifiedKaporaReceipt(supabase, reservationId);

  const updated = await updateReservation(supabase, reservationId, {
    deposit_status: "verified",
    deposit_verified_at: new Date().toISOString(),
    deposit_verified_by: verifiedBy,
    status: "confirmed",
    remaining_amount: Math.max(
      0,
      Number(current.total_price) - Number(current.deposit_amount)
    ),
    remaining_payment_status: "unpaid",
  });

  await supabase
    .from("payment_receipts")
    .update({
      payment_confirmed: true,
      status: "verified",
      reviewed_at: new Date().toISOString(),
      reviewed_by: verifiedBy,
    })
    .eq("reservation_id", reservationId)
    .eq("receipt_verified", true);
  await insertReservationChange(supabase, {
    reservationId,
    changedByType: "staff",
    changedById: verifiedBy,
    fieldName: "deposit_status",
    oldValue: { status: current.deposit_status },
    newValue: { status: "verified", reservationStatus: "confirmed" },
    reason: "Admin ödeme alındı onayı",
  });

  if (current.contact_id) {
    try {
      const { appendTimelineEvent } = await import(
        "@/features/smart-sales/repositories/smart-sales.repository"
      );
      await appendTimelineEvent(supabase, {
        contactId: current.contact_id,
        reservationId,
        conversationId: current.conversation_id,
        eventType: "deposit_confirmed",
        title: "Kapora onaylandı / rezervasyon kesinleşti",
        actorType: "staff",
      });
      await supabase
        .from("customer_profiles")
        .update({ lifecycle_stage: "reservation_confirmed" })
        .eq("contact_id", current.contact_id);
      const { syncFunnelAfterReservationChange } = await import(
        "@/features/marketing/services/attribution-funnel.service"
      );
      await syncFunnelAfterReservationChange(supabase, current.contact_id);
    } catch {
      // timeline opsiyonel
    }
  }

  // Automation Engine (docs/14,32): deposit_verified tetikleyicisi.
  try {
    await runAutomationsForEvent(supabase, "deposit_verified", {
      reservationId,
      totalPrice: Number(current.total_price),
      eventType: current.event_type ?? undefined,
      conversationId: current.conversation_id ?? undefined,
      contactId: current.contact_id ?? undefined,
    });
  } catch (automationError) {
    console.error(
      "[reservations] otomasyon hatası:",
      automationError instanceof Error ? automationError.message : "bilinmeyen"
    );
  }

  return updated;
}

export async function markShootCompleted(
  supabase: TypedSupabaseClient,
  reservationId: string,
  actorId: string | null
) {
  const current = await getReservationById(supabase, reservationId);
  if (!current) throw new Error("Rezervasyon bulunamadı.");

  const remaining = Math.max(
    0,
    Number(current.total_price) - Number(current.deposit_amount)
  );

  const updated = await updateReservation(supabase, reservationId, {
    status: "shoot_completed",
    remaining_amount: remaining,
    remaining_payment_status: remaining > 0 ? "unpaid" : "paid",
    remaining_payment_due_at: new Date().toISOString(),
  });

  await insertReservationChange(supabase, {
    reservationId,
    changedByType: "staff",
    changedById: actorId,
    fieldName: "status",
    oldValue: { status: current.status },
    newValue: { status: "shoot_completed", remaining },
    reason: "Çekim tamamlandı",
  });

  if (current.contact_id) {
    try {
      const { scheduleSatisfactionFlow } = await import(
        "@/features/smart-sales/services/follow-up-cadence.service"
      );
      const { appendTimelineEvent } = await import(
        "@/features/smart-sales/repositories/smart-sales.repository"
      );
      await scheduleSatisfactionFlow(supabase, {
        contactId: current.contact_id,
        reservationId,
        conversationId: current.conversation_id,
      });
      await appendTimelineEvent(supabase, {
        contactId: current.contact_id,
        reservationId,
        conversationId: current.conversation_id,
        eventType: "shoot_completed",
        title: "Çekim tamamlandı",
        actorType: "staff",
      });
      await supabase
        .from("customer_profiles")
        .update({ lifecycle_stage: "shoot_completed" })
        .eq("contact_id", current.contact_id);
      const { syncFunnelAfterReservationChange } = await import(
        "@/features/marketing/services/attribution-funnel.service"
      );
      await syncFunnelAfterReservationChange(supabase, current.contact_id);
    } catch {
      // memnuniyet / attribution opsiyonel
    }
  }

  return updated;
}

export async function markRemainingPaid(
  supabase: TypedSupabaseClient,
  reservationId: string,
  actorId: string | null
) {
  const current = await getReservationById(supabase, reservationId);
  const updated = await updateReservation(supabase, reservationId, {
    remaining_payment_status: "paid",
    remaining_amount: 0,
    status: "completed",
  });

  await insertReservationChange(supabase, {
    reservationId,
    changedByType: "staff",
    changedById: actorId,
    fieldName: "remaining_payment_status",
    newValue: { status: "paid" },
    reason: "Kalan ödeme alındı",
  });

  // Modül 9: funnel + marketing learning
  try {
    const { syncFunnelAfterReservationChange } = await import(
      "@/features/marketing/services/attribution-funnel.service"
    );
    const { learnFromCompletedReservation } = await import(
      "@/features/marketing/services/marketing-learning.service"
    );
    await syncFunnelAfterReservationChange(
      supabase,
      current?.contact_id ?? updated.contact_id
    );
    await learnFromCompletedReservation(supabase, reservationId);
  } catch {
    // attribution öğrenimi rezervasyon tamamlamayı engellemez
  }

  return updated;
}

export async function upsertAiReservationDraft(
  supabase: TypedSupabaseClient,
  params: {
    conversationId: string;
    contactId: string | null;
    customerProfileId?: string | null;
    customerFullName?: string | null;
    customerPhone?: string | null;
    eventType?: string | null;
    eventDate?: string | null;
    startTime?: string | null;
    venueName?: string | null;
    serviceIds?: string[];
  }
) {
  const existing = await findDraftByConversation(
    supabase,
    params.conversationId
  );

  const patch: Database["public"]["Tables"]["reservations"]["Update"] = {
    contact_id: params.contactId,
    conversation_id: params.conversationId,
    customer_profile_id: params.customerProfileId ?? null,
    source: "instagram_ai",
    status: existing?.status ?? "draft",
  };

  if (params.customerFullName) patch.customer_full_name = params.customerFullName;
  if (params.customerPhone) patch.customer_phone = params.customerPhone;
  if (params.eventType) patch.event_type = params.eventType;
  if (params.eventDate) {
    patch.event_date = params.eventDate;
  }
  if (params.startTime) {
    patch.start_time = params.startTime;
    patch.time_status = "confirmed";
    patch.needs_time_followup = false;
  }
  if (params.venueName) {
    patch.venue_name = params.venueName;
    patch.location = params.venueName;
    patch.location_status = "confirmed";
    patch.needs_location_followup = false;
  }

  if (params.serviceIds && params.serviceIds.length > 0) {
    const quote = await quoteServicesByIds(
      supabase,
      params.serviceIds,
      params.eventDate ?? existing?.event_date ?? undefined
    );
    patch.selected_service_ids = params.serviceIds;
    patch.package_snapshot = quote as unknown as Json;
    patch.subtotal = quote.subtotal;
    patch.discount_amount = quote.discountAmount;
    patch.total_price = quote.totalPrice;
    patch.deposit_amount = quote.depositAmount;
    patch.remaining_amount = quote.remainingAmount;
  }

  if (existing) {
    const updated = await updateReservation(supabase, existing.id, patch);
    if (params.serviceIds && params.serviceIds.length > 0) {
      const quote = await quoteServicesByIds(
        supabase,
        params.serviceIds,
        updated.event_date ?? undefined
      );
      await replaceReservationItems(
        supabase,
        updated.id,
        quote.lines.map((line, index) => ({
          reservation_id: updated.id,
          service_id: line.serviceId,
          service_name_snapshot: line.serviceName,
          unit_price: line.unitPrice,
          quantity: line.quantity,
          discount_amount: line.discountAmount,
          final_price: line.finalPrice,
          sort_order: index,
        }))
      );
    }
    return updated;
  }

  return insertReservation(supabase, {
    ...patch,
    customer_full_name: params.customerFullName ?? "Instagram müşteri",
    status: "draft",
    deposit_status: "not_requested",
    remaining_payment_status: "unpaid",
    city: "Ankara",
    time_status: params.startTime ? "confirmed" : "unknown",
    location_status: params.venueName ? "confirmed" : "unknown",
    needs_time_followup: !params.startTime,
    needs_location_followup: !params.venueName,
  });
}

export async function checkDateAvailability(
  supabase: TypedSupabaseClient,
  params: {
    eventDate: string;
    startTime?: string | null;
    endTime?: string | null;
    platoId?: string | null;
    teamId?: string | null;
    excludeReservationId?: string;
  }
) {
  const settings = await getReservationSettings(supabase);
  const start = combineDateAndTime(params.eventDate, params.startTime, 12);
  const end = combineDateAndTime(params.eventDate, params.endTime, 14);
  if (!params.endTime && params.startTime) {
    end.setHours(start.getHours() + 2);
  }

  const travel = params.startTime
    ? Number(settings?.default_travel_minutes ?? 60)
    : 0;
  const busy = computeEffectiveBusyWindow({
    scheduledStartAt: start,
    scheduledEndAt: end,
    travelBeforeMinutes: travel,
  });

  const existing = await listBusyReservationsForDate(
    supabase,
    params.eventDate
  );

  return checkAvailability({
    candidateStart: busy.effectiveBusyStartAt.toISOString(),
    candidateEnd: busy.effectiveBusyEndAt.toISOString(),
    platoId: params.platoId,
    teamId: params.teamId,
    excludeReservationId: params.excludeReservationId,
    existing: existing.map((row) => ({
      id: row.id,
      status: row.status,
      platoId: row.selected_plato_id,
      teamId: row.assigned_team_id,
      effectiveBusyStartAt: row.effective_busy_start_at,
      effectiveBusyEndAt: row.effective_busy_end_at,
      timeStatus: row.time_status,
    })),
  });
}
