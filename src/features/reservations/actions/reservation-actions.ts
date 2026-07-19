"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import {
  confirmDepositPayment,
  createManualReservation,
  markRemainingPaid,
  markShootCompleted,
} from "@/features/reservations/services/reservations.service";
import { updateServicePrice, updateCampaignActive } from "@/features/catalog/repositories/catalog.repository";
import { upsertPlateau } from "@/features/plateaus/repositories/plateaus.repository";
import {
  buildDepositIbanMessage,
  createPaymentReceipt,
  upsertPaymentAccount,
} from "@/features/payments/services/payments.service";
import { ensureReminderJobsForReservation } from "@/features/reminders/services/reminders.service";

export type ActionResult =
  | { success: true; message?: string; id?: string }
  | { success: false; error: string };

async function requireUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Oturum bulunamadı.");
  return data.user.id;
}

const manualSchema = z.object({
  customerFullName: z.string().min(2),
  customerPhone: z.string().optional(),
  eventType: z.string().optional(),
  eventDate: z.string().min(10),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  venueName: z.string().optional(),
  selectedPlatoId: z.string().uuid().optional(),
  serviceIds: z.array(z.string().uuid()).min(1),
  depositAmount: z.coerce.number().optional(),
  customerNotes: z.string().optional(),
  internalNotes: z.string().optional(),
  conflictOverride: z.boolean().optional(),
  conflictOverrideReason: z.string().optional(),
});

export async function createReservationAction(
  raw: z.infer<typeof manualSchema>
): Promise<ActionResult> {
  const parsed = manualSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz" };
  }
  try {
    const userId = await requireUserId();
    const admin = createAdminClient();
    const result = await createManualReservation(admin, {
      ...parsed.data,
      createdBy: userId,
      source: "admin_panel",
    });
    await ensureReminderJobsForReservation(admin, result.reservation);
    revalidatePath("/dashboard/reservations");
    return { success: true, id: result.reservation.id, message: "Rezervasyon oluşturuldu." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Kayıt başarısız",
    };
  }
}

export async function confirmDepositAction(
  reservationId: string
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const admin = createAdminClient();
    const updated = await confirmDepositPayment(admin, reservationId, userId);
    await ensureReminderJobsForReservation(admin, updated);
    revalidatePath("/dashboard/reservations");
    revalidatePath(`/dashboard/reservations/${reservationId}`);
    revalidatePath("/dashboard/payments");
    return { success: true, message: "Ödeme alındı, rezervasyon kesinleşti." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Onay başarısız",
    };
  }
}

export async function markShootCompletedAction(
  reservationId: string
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const admin = createAdminClient();
    await markShootCompleted(admin, reservationId, userId);
    revalidatePath(`/dashboard/reservations/${reservationId}`);
    return { success: true, message: "Çekim tamamlandı olarak işaretlendi." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "İşlem başarısız",
    };
  }
}

export async function markRemainingPaidAction(
  reservationId: string
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const admin = createAdminClient();
    await markRemainingPaid(admin, reservationId, userId);
    revalidatePath(`/dashboard/reservations/${reservationId}`);
    return { success: true, message: "Kalan ödeme alındı." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "İşlem başarısız",
    };
  }
}

export async function sendIbanAction(
  reservationId: string
): Promise<ActionResult> {
  try {
    await requireUserId();
    const admin = createAdminClient();
    const message = await buildDepositIbanMessage(admin, reservationId);
    revalidatePath(`/dashboard/reservations/${reservationId}`);
    return { success: true, message };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "IBAN gönderilemedi",
    };
  }
}

export async function updateServicePriceAction(
  id: string,
  basePrice: number
): Promise<ActionResult> {
  try {
    await requireUserId();
    const admin = createAdminClient();
    await updateServicePrice(admin, id, basePrice);
    revalidatePath("/dashboard/services");
    return { success: true, message: "Fiyat güncellendi." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Güncelleme başarısız",
    };
  }
}

export async function toggleCampaignAction(
  id: string,
  active: boolean
): Promise<ActionResult> {
  try {
    await requireUserId();
    const admin = createAdminClient();
    await updateCampaignActive(admin, id, active);
    revalidatePath("/dashboard/campaigns");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Güncelleme başarısız",
    };
  }
}

export async function savePlateauAction(input: {
  id?: string;
  name: string;
  description?: string;
  address?: string;
  district?: string;
  active?: boolean;
}): Promise<ActionResult> {
  try {
    await requireUserId();
    const admin = createAdminClient();
    const row = await upsertPlateau(admin, input);
    revalidatePath("/dashboard/plateaus");
    return { success: true, id: row.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Kayıt başarısız",
    };
  }
}

export async function savePaymentAccountAction(input: {
  id?: string;
  bankName: string;
  accountHolderName: string;
  iban: string;
  isDefault?: boolean;
}): Promise<ActionResult> {
  try {
    await requireUserId();
    const admin = createAdminClient();
    const row = await upsertPaymentAccount(admin, input);
    revalidatePath("/dashboard/settings/payment");
    return { success: true, id: row.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Kayıt başarısız",
    };
  }
}

export async function registerReceiptAction(input: {
  reservationId: string;
  fileUrl: string;
  originalFilename?: string;
}): Promise<ActionResult> {
  try {
    await requireUserId();
    const admin = createAdminClient();
    const { analyzeReceiptWithVision } = await import(
      "@/features/payments/services/payments.service"
    );
    const analysis = await analyzeReceiptWithVision(input.fileUrl);
    const result = await createPaymentReceipt(admin, {
      reservationId: input.reservationId,
      fileUrl: input.fileUrl,
      originalFilename: input.originalFilename,
      uploadedVia: "admin_panel",
      analysis,
    });
    revalidatePath("/dashboard/payments");
    revalidatePath(`/dashboard/reservations/${input.reservationId}`);
    return {
      success: true,
      id: result.receipt?.id,
      message: result.duplicate
        ? "Bu dekont daha önce kaydedilmiş."
        : "Dekont kaydedildi, inceleme bekliyor.",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Dekont kaydı başarısız",
    };
  }
}
