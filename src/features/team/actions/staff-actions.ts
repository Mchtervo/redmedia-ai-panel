"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import {
  addStaffUnavailability,
  assignStaffToReservation,
  createStaffMemberWithRoles,
  removeStaffAssignment,
  setStaffActive,
  suggestStaffForRole,
  updateStaffMemberWithRoles,
} from "@/features/team/services/staff.service";
import { STAFF_ROLE_SLUGS, UNAVAILABILITY_TYPES } from "@/features/team/types";

export type ActionResult =
  | { success: true; message?: string; id?: string }
  | { success: false; error: string };

async function requireUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Oturum bulunamadı.");
  return data.user.id;
}

const staffSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  profilePhotoUrl: z.string().url().optional().or(z.literal("")),
  active: z.boolean().optional(),
  notes: z.string().optional(),
  defaultStartTime: z.string().optional(),
  defaultEndTime: z.string().optional(),
  roleIds: z.array(z.string().uuid()).min(1, "En az bir rol seçin"),
  primaryRoleId: z.string().uuid().optional(),
});

export async function saveStaffMemberAction(
  raw: z.infer<typeof staffSchema>
): Promise<ActionResult> {
  const parsed = staffSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Geçersiz form",
    };
  }
  try {
    const userId = await requireUserId();
    const admin = createAdminClient();
    const data = parsed.data;
    if (data.id) {
      const row = await updateStaffMemberWithRoles(admin, data.id, {
        fullName: data.fullName,
        phone: data.phone || null,
        email: data.email || null,
        profilePhotoUrl: data.profilePhotoUrl || null,
        active: data.active,
        notes: data.notes || null,
        defaultStartTime: data.defaultStartTime || null,
        defaultEndTime: data.defaultEndTime || null,
        roleIds: data.roleIds,
        primaryRoleId: data.primaryRoleId,
        actorId: userId,
      });
      revalidatePath("/dashboard/team");
      revalidatePath(`/dashboard/team/${data.id}`);
      return { success: true, id: row?.id, message: "Personel güncellendi." };
    }
    const row = await createStaffMemberWithRoles(admin, {
      fullName: data.fullName,
      phone: data.phone || null,
      email: data.email || null,
      profilePhotoUrl: data.profilePhotoUrl || null,
      active: data.active ?? true,
      notes: data.notes || null,
      defaultStartTime: data.defaultStartTime || null,
      defaultEndTime: data.defaultEndTime || null,
      roleIds: data.roleIds,
      primaryRoleId: data.primaryRoleId,
      actorId: userId,
    });
    revalidatePath("/dashboard/team");
    return { success: true, id: row?.id, message: "Personel eklendi." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Kayıt başarısız",
    };
  }
}

export async function setStaffActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const admin = createAdminClient();
    await setStaffActive(admin, id, active, userId);
    revalidatePath("/dashboard/team");
    revalidatePath(`/dashboard/team/${id}`);
    return {
      success: true,
      message: active ? "Personel aktif edildi." : "Personel pasif yapıldı.",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "İşlem başarısız",
    };
  }
}

const leaveSchema = z.object({
  staffMemberId: z.string().uuid(),
  startAt: z.string().min(10),
  endAt: z.string().min(10),
  reason: z.string().optional(),
  type: z.enum(UNAVAILABILITY_TYPES),
});

export async function addStaffLeaveAction(
  raw: z.infer<typeof leaveSchema>
): Promise<ActionResult> {
  const parsed = leaveSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Geçersiz",
    };
  }
  try {
    const userId = await requireUserId();
    const admin = createAdminClient();
    const row = await addStaffUnavailability(admin, {
      ...parsed.data,
      actorId: userId,
    });
    revalidatePath("/dashboard/team");
    revalidatePath(`/dashboard/team/${parsed.data.staffMemberId}`);
    revalidatePath("/dashboard/team/calendar");
    return { success: true, id: row.id, message: "İzin eklendi." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "İzin eklenemedi",
    };
  }
}

const assignSchema = z.object({
  reservationId: z.string().uuid(),
  reservationItemId: z.string().uuid().optional(),
  staffMemberId: z.string().uuid(),
  assignedRole: z.enum(STAFF_ROLE_SLUGS),
  candidateStartAt: z.string().min(10),
  candidateEndAt: z.string().min(10),
  overrideConflict: z.boolean().optional(),
  overrideReason: z.string().optional(),
  notes: z.string().optional(),
});

export async function assignStaffAction(
  raw: z.infer<typeof assignSchema>
): Promise<ActionResult> {
  const parsed = assignSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Geçersiz",
    };
  }
  try {
    const userId = await requireUserId();
    const admin = createAdminClient();
    const row = await assignStaffToReservation(admin, {
      ...parsed.data,
      actorId: userId,
    });
    revalidatePath(`/dashboard/reservations/${parsed.data.reservationId}`);
    revalidatePath("/dashboard/team");
    revalidatePath("/dashboard/team/calendar");
    return { success: true, id: row.id, message: "Personel atandı." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Atama başarısız",
    };
  }
}

export async function unassignStaffAction(
  assignmentId: string,
  reservationId: string
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const admin = createAdminClient();
    await removeStaffAssignment(admin, assignmentId, userId);
    revalidatePath(`/dashboard/reservations/${reservationId}`);
    revalidatePath("/dashboard/team/calendar");
    return { success: true, message: "Atama iptal edildi." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "İptal başarısız",
    };
  }
}

export async function getStaffSuggestionsAction(input: {
  requiredRole: (typeof STAFF_ROLE_SLUGS)[number];
  candidateStartAt: string;
  candidateEndAt: string;
  excludeReservationId?: string;
}) {
  try {
    await requireUserId();
    const admin = createAdminClient();
    return {
      success: true as const,
      data: await suggestStaffForRole(admin, input),
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Öneri alınamadı",
    };
  }
}
