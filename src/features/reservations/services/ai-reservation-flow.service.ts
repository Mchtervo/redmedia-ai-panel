import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  checkDateAvailability,
  upsertAiReservationDraft,
} from "@/features/reservations/services/reservations.service";
import {
  findDraftByConversation,
  updateReservation,
} from "@/features/reservations/repositories/reservations.repository";
import { quoteServicesByIds, getReservationSettings } from "@/features/pricing/services/quote-from-db.service";
import { buildDepositIbanMessage } from "@/features/payments/services/payments.service";
import { listActiveServices } from "@/features/catalog/repositories/catalog.repository";
import { processInboundForFollowUp } from "@/features/follow-ups/services/follow-ups.service";
import { getCustomerProfileByContactId } from "@/features/customer-intelligence/repositories/customer-profiles.repository";
import { checkStaffCapacityForServices } from "@/features/team/services/staff.service";
import { computeEffectiveBusyWindow } from "@/features/scheduling/services/availability.service";
import { createPanelNotification } from "@/features/notifications/services/notifications.service";
import { appendTimelineEvent } from "@/features/smart-sales/repositories/smart-sales.repository";

type TypedSupabaseClient = SupabaseClient<Database>;

export type ReservationMissingField =
  | "event_date"
  | "customer_phone"
  | "customer_full_name"
  | "start_time"
  | "venue_name"
  | "services";

/**
 * Mesajdan saat/mekân çıkarımı (heuristik; fiyat yok).
 */
export function extractReservationHintsFromMessage(message: string): {
  startTime: string | null;
  venueName: string | null;
} {
  const n = message.toLocaleLowerCase("tr-TR");
  let startTime: string | null = null;
  const timeMatch =
    n.match(/\b([01]?\d|2[0-3])[:\.]([0-5]\d)\b/) ||
    n.match(/\bsaat\s*([01]?\d|2[0-3])\b/);
  if (timeMatch) {
    const hour = String(timeMatch[1]).padStart(2, "0");
    const minute = timeMatch[2] ? String(timeMatch[2]).padStart(2, "0") : "00";
    startTime = `${hour}:${minute}:00`;
  }

  let venueName: string | null = null;
  const venueMatch = message.match(
    /(?:mekân|mekan|plato|konum|yer|adres)\s*[:\-]?\s*([^\n.!?]{3,80})/i
  );
  if (venueMatch?.[1]) {
    venueName = venueMatch[1].trim();
  }

  return { startTime, venueName };
}

export function listMissingReservationFields(draft: {
  event_date: string | null;
  customer_phone: string | null;
  customer_full_name: string | null;
  start_time: string | null;
  venue_name: string | null;
  selected_service_ids: string[] | null;
}): ReservationMissingField[] {
  const missing: ReservationMissingField[] = [];
  if (!draft.event_date) missing.push("event_date");
  if (!draft.customer_phone?.trim()) missing.push("customer_phone");
  if (
    !draft.customer_full_name?.trim() ||
    draft.customer_full_name === "Instagram müşteri"
  ) {
    missing.push("customer_full_name");
  }
  if (!draft.start_time) missing.push("start_time");
  if (!draft.venue_name?.trim()) missing.push("venue_name");
  if (!draft.selected_service_ids?.length) missing.push("services");
  return missing;
}

/**
 * Webhook sonrası: CRM alanlarından draft güncelle, follow-up planla,
 * AI prompt için rezervasyon özeti üret. AI_RESERVATION açıksa ve
 * müşteri onay niyetindeyse taslağı pending'e yükselt.
 */
export async function syncReservationContextAfterMessage(
  supabase: TypedSupabaseClient,
  params: {
    conversationId: string;
    contactId: string;
    customerMessage: string;
  }
) {
  const profile = await getCustomerProfileByContactId(
    supabase,
    params.contactId
  );

  const serviceIds = await matchServiceIdsFromMessage(
    supabase,
    params.customerMessage,
    profile?.requested_services ?? []
  );

  const hints = extractReservationHintsFromMessage(params.customerMessage);

  const draft = await upsertAiReservationDraft(supabase, {
    conversationId: params.conversationId,
    contactId: params.contactId,
    customerProfileId: profile?.id ?? null,
    customerFullName: profile?.full_name ?? null,
    customerPhone: profile?.phone ?? null,
    eventType: profile?.event_type ?? null,
    eventDate: profile?.event_date ?? null,
    startTime: hints.startTime,
    venueName: hints.venueName ?? profile?.venue ?? null,
    serviceIds: serviceIds.length > 0 ? serviceIds : undefined,
  });

  await processInboundForFollowUp(supabase, {
    contactId: params.contactId,
    conversationId: params.conversationId,
    message: params.customerMessage,
    reservationId: draft.id,
  });

  // Otomatik rezervasyon yükseltme (varsayılan kapalı — AI_RESERVATION)
  if (isReservationConfirmationIntent(params.customerMessage)) {
    await tryPromoteAiDraftReservation(supabase, {
      draftId: draft.id,
      conversationId: params.conversationId,
      contactId: params.contactId,
    });
  }

  return draft;
}

/**
 * AI_RESERVATION açık + zorunlu alanlar dolu + taslak hâlâ draft ise
 * status=pending yapar (confirmed değil — kapora admin onayı).
 */
export async function tryPromoteAiDraftReservation(
  supabase: TypedSupabaseClient,
  params: {
    draftId: string;
    conversationId: string;
    contactId: string;
  }
): Promise<{ promoted: boolean; reason: string }> {
  const { isAiFeatureEnabled } = await import(
    "@/features/settings/services/ai-feature-flags.service"
  );
  if (!(await isAiFeatureEnabled(supabase, "AI_RESERVATION"))) {
    return { promoted: false, reason: "ai_reservation_disabled" };
  }

  const draft = await findDraftByConversation(
    supabase,
    params.conversationId
  );
  if (!draft || draft.id !== params.draftId) {
    return { promoted: false, reason: "draft_not_found" };
  }
  if (draft.status !== "draft") {
    return { promoted: false, reason: "already_advanced" };
  }

  const missing = listMissingReservationFields(draft);
  // Pending için minimum: tarih + telefon + ad (+ mümkünse hizmet)
  const hardMissing = missing.filter((f) =>
    ["event_date", "customer_phone", "customer_full_name"].includes(f)
  );
  if (hardMissing.length > 0) {
    return {
      promoted: false,
      reason: `missing:${hardMissing.join(",")}`,
    };
  }

  await updateReservation(supabase, draft.id, {
    status: "pending_customer",
    deposit_status:
      draft.deposit_status === "not_requested"
        ? "requested"
        : draft.deposit_status,
  });

  await createPanelNotification(supabase, {
    type: "reservation_ai_pending",
    title: "AI rezervasyon taslağı onay bekliyor",
    body: `${draft.customer_full_name ?? "Müşteri"} · ${draft.event_date ?? "tarih yok"}`,
    payload: {
      reservationId: draft.id,
      conversationId: params.conversationId,
      contactId: params.contactId,
    },
    reservationId: draft.id,
  });

  await appendTimelineEvent(supabase, {
    contactId: params.contactId,
    conversationId: params.conversationId,
    reservationId: draft.id,
    eventType: "reservation_pending",
    title: "AI rezervasyonu pending yaptı",
    body: "Zorunlu alanlar dolu; kapora/admin onayı bekleniyor.",
    actorType: "ai",
  }).catch(() => undefined);

  return { promoted: true, reason: "promoted_pending" };
}

async function matchServiceIdsFromMessage(
  supabase: TypedSupabaseClient,
  message: string,
  requestedServices: string[]
): Promise<string[]> {
  const services = await listActiveServices(supabase);
  const haystack = `${message} ${requestedServices.join(" ")}`.toLocaleLowerCase(
    "tr-TR"
  );
  const matched: string[] = [];

  for (const service of services) {
    const tokens = [
      service.name.toLocaleLowerCase("tr-TR"),
      service.slug.replace(/-/g, " "),
      service.service_type,
    ];
    if (tokens.some((t) => t && haystack.includes(t))) {
      matched.push(service.id);
    }
  }

  // drone keyword
  if (/\bdrone\b/i.test(haystack)) {
    const drone = services.find((s) => s.service_type === "drone");
    if (drone && !matched.includes(drone.id)) matched.push(drone.id);
  }

  return matched;
}

export async function buildReservationPromptBlock(
  supabase: TypedSupabaseClient,
  conversationId: string
): Promise<string> {
  const draft = await findDraftByConversation(supabase, conversationId);
  if (!draft) {
    return "(aktif rezervasyon taslağı yok)";
  }

  let availabilityLine = "müsaitlik henüz sorgulanmadı";
  if (draft.event_date) {
    const avail = await checkDateAvailability(supabase, {
      eventDate: draft.event_date,
      startTime: draft.start_time,
      endTime: draft.end_time,
      platoId: draft.selected_plato_id,
      teamId: draft.assigned_team_id,
      excludeReservationId: draft.id,
    });
    if (avail.hasUnknownTimeConfirmed) {
      availabilityLine =
        "Bu tarihte saati netleşmemiş confirmed rezervasyon var; kesin müsait deme, kontrol gerektiğini söyle.";
    } else if (avail.hardConflict) {
      availabilityLine =
        "Çakışma var; alternatif saat/tarih/plato öner, kesin rezervasyon sözü verme.";
    } else if (avail.available) {
      availabilityLine =
        "Belirttiğiniz tarih şu an müsait görünüyor. Rezervasyonun kesinleşmesi için kapora gerekir. Takvim sorgusu yapılmadan müsait deme.";
    } else {
      availabilityLine = `Uyarılar: ${avail.softWarnings.join("; ") || "kontrol gerekli"}`;
    }
  }

  let staffLine =
    "personel kontrolü yapılmadı (hizmet veya saat eksik); kesin ekip müsaitliği söyleme";
  let requiredRolesLine = "—";
  let suggestedStaffLine = "—";

  if (draft.event_date && draft.selected_service_ids?.length) {
    const settings = await getReservationSettings(supabase);
    const start = draft.start_time
      ? new Date(
          `${draft.event_date}T${draft.start_time.slice(0, 5)}:00+03:00`
        )
      : new Date(`${draft.event_date}T12:00:00+03:00`);
    const end = draft.end_time
      ? new Date(`${draft.event_date}T${draft.end_time.slice(0, 5)}:00+03:00`)
      : new Date(start.getTime() + 2 * 3600000);
    const travelBefore = draft.start_time
      ? Number(settings?.default_travel_minutes ?? 60)
      : 0;
    const busy = computeEffectiveBusyWindow({
      scheduledStartAt: start,
      scheduledEndAt: end,
      travelBeforeMinutes: travelBefore,
      preparationBeforeMinutes: 0,
      travelAfterMinutes: 0,
    });

    const capacity = await checkStaffCapacityForServices(supabase, {
      serviceIds: draft.selected_service_ids,
      candidateStartAt: busy.effectiveBusyStartAt.toISOString(),
      candidateEndAt: busy.effectiveBusyEndAt.toISOString(),
      excludeReservationId: draft.id,
    });

    requiredRolesLine =
      capacity.roles.map((r) => `${r.roleLabel} (x${r.quantity})`).join(", ") ||
      "rol yok";
    suggestedStaffLine =
      capacity.suggestedStaffIds.slice(0, 5).join(", ") || "öneri yok";

    if (!capacity.allSatisfied) {
      staffLine =
        "Belirttiğiniz saat için ekip uygunluğunu ayrıca kontrol etmemiz gerekiyor. Kesin müsaitlik verme; personel atama.";
      if (availabilityLine.includes("müsait görünüyor")) {
        availabilityLine =
          "Takvimde slot görünebilir ancak ekip kapasitesi yetersiz; kesin müsait deme.";
      }
    } else {
      staffLine = `Ekip kapasitesi şu an yeterli görünüyor (${capacity.lines.join("; ")}). Yine de kesin personel ataması yapma; admin panelden seçilir.`;
    }
  }

  let priceLine = "fiyat henüz hesaplanmadı (hizmet seçilmedi)";
  if (draft.selected_service_ids?.length) {
    const quote = await quoteServicesByIds(
      supabase,
      draft.selected_service_ids,
      draft.event_date ?? undefined
    );
    priceLine = `Hesaplanan toplam (DB): ${quote.totalPrice} TL; kapora ${quote.depositAmount} TL; kalan ${quote.remainingAmount} TL. Kampanyalar: ${quote.appliedCampaignNames.join(", ") || "yok"}. Bu rakamlar dışında fiyat uydurma.`;
  }

  const missing = listMissingReservationFields(draft);
  // Müşteriye sorulacak alanlar — saat/ekipman ASLA müşteriye sorulmaz.
  const askCustomerFields = missing.filter(
    (m) => m !== "start_time" && m !== "customer_full_name"
  );
  const missingLabels: Record<ReservationMissingField, string> = {
    event_date: "tarih",
    customer_phone: "telefon",
    customer_full_name: "ad soyad",
    start_time: "saat (müşteriye SORMA — ekip planlar)",
    venue_name: "mekân türü (kendi plato / başka plato / dış)",
    services: "hizmet/paket",
  };
  const missingLine =
    askCustomerFields.length === 0
      ? "Müşteriye sorulacak zorunlu alan kalmadı (saat eksikse bile müşteriye sorma)."
      : `Müşteriye sorulacak eksikler (yalnızca bunlar, tek tek): ${askCustomerFields
          .map((m) => missingLabels[m])
          .join(", ")}. Saat / kişi sayısı / ekipman SORMA.`;

  return [
    `Taslak ID: ${draft.id}`,
    `Durum: ${draft.status}`,
    `Etkinlik: ${draft.event_type ?? "—"}`,
    `Tarih: ${draft.event_date ?? "—"}`,
    `Saat: ${draft.start_time ?? "bilinmiyor"} (${draft.time_status})`,
    `Mekân: ${draft.venue_name ?? "bilinmiyor"} (${draft.location_status})`,
    `Telefon: ${draft.customer_phone ?? "yok"}`,
    `Ad: ${draft.customer_full_name ?? "—"}`,
    missingLine,
    `Müsaitlik: ${availabilityLine}`,
    `Personel: ${staffLine}`,
    `required_role: ${requiredRolesLine}`,
    `suggested_staff_ids: ${suggestedStaffLine}`,
    `Fiyat: ${priceLine}`,
    `Kapora durumu: ${draft.deposit_status}`,
  ].join("\n");
}

export function isReservationConfirmationIntent(message: string): boolean {
  const n = message.toLocaleLowerCase("tr-TR");
  return (
    /(rezervasyon(u|umu)?\s*(onay|onaylıyorum|oluştur)|tamam\s*(olsun|dır|dir)?|kaporayı?\s*(yatır|gönder|öder)|ödemeyi?\s*yap(acağ|arım)|kesinleştir|onaylıyorum|evet\s*(olsun|yapalım|tamam)|ibana?\s*gönder)/i.test(
      n
    ) || /^(onay|tamam|olur|evet)[.!]?$/i.test(n.trim())
  );
}

export async function maybeBuildIbanReply(
  supabase: TypedSupabaseClient,
  conversationId: string,
  customerMessage: string
): Promise<string | null> {
  const wantsIban =
    /iban|kapora|ödeme|odeme|hesap|dekont/i.test(customerMessage) ||
    isReservationConfirmationIntent(customerMessage);

  if (!wantsIban) return null;

  const draft = await findDraftByConversation(supabase, conversationId);
  if (!draft) return null;
  if (!draft.event_date || !draft.customer_phone) {
    return null;
  }

  // Zaten confirmed ise IBAN tekrar gönderme
  if (draft.status === "confirmed") return null;

  return buildDepositIbanMessage(supabase, draft.id);
}
