"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import {
  testMetaConnection,
  requestSync,
  runManualMetaSync,
  type ManualSyncKind,
} from "@/features/marketing/services/meta-connection.service";
import { META_CONNECTION_TYPES, SOURCE_TYPES } from "@/features/marketing/types";
import { setManualAttribution } from "@/features/marketing/services/attribution.service";
import { generateMarketingStrategyDraft } from "@/features/marketing/services/marketing-strategy.service";
import { createExperiment } from "@/features/marketing/services/experiment.service";
import { createLearning } from "@/features/marketing/services/marketing-learning.service";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Oturum gerekli.");
  return user;
}

export async function testConnectionAction(connectionType: string) {
  const parsed = z.enum(META_CONNECTION_TYPES).safeParse(connectionType);
  if (!parsed.success) return { success: false as const, error: "Geçersiz tür." };
  await requireUser();
  const admin = createAdminClient();
  const result = await testMetaConnection(admin, parsed.data);
  revalidatePath("/dashboard/marketing/connections");
  return { success: true as const, ...result };
}

export async function syncMarketingAction(
  syncType: "ads" | "insights" | "instagram" | "attribution"
) {
  await requireUser();
  const admin = createAdminClient();
  const result = await requestSync(admin, syncType);
  revalidatePath("/dashboard/marketing");
  revalidatePath("/dashboard/marketing/connections");
  return { success: true as const, ...result };
}

export async function runMetaSyncAction(kind: string) {
  const parsed = z
    .enum([
      "full",
      "campaigns",
      "adsets",
      "ads",
      "creatives",
      "insights",
      "instagram",
    ])
    .safeParse(kind);
  if (!parsed.success) {
    return { success: false as const, error: "Geçersiz sync türü." };
  }
  await requireUser();
  const admin = createAdminClient();
  const result = await runManualMetaSync(
    admin,
    parsed.data as ManualSyncKind
  );
  revalidatePath("/dashboard/marketing");
  revalidatePath("/dashboard/marketing/connections");
  revalidatePath("/dashboard/marketing/performance");
  revalidatePath("/dashboard/marketing/instagram");
  return { success: true as const, ...result };
}

export async function testAllConnectionsAction() {
  await requireUser();
  const admin = createAdminClient();
  const { testAllMetaConnections } = await import(
    "@/features/marketing/services/meta-connection.service"
  );
  const result = await testAllMetaConnections(admin);
  revalidatePath("/dashboard/marketing/connections");
  return { success: true as const, ...result };
}

export async function setManualAttributionAction(raw: unknown) {
  const schema = z.object({
    contactId: z.string().uuid(),
    sourceType: z.enum(SOURCE_TYPES),
    notes: z.string().max(2000).optional(),
    reason: z.string().max(500).optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: "Geçersiz form." };
  }
  const user = await requireUser();
  const admin = createAdminClient();
  await setManualAttribution(admin, {
    contactId: parsed.data.contactId,
    sourceType: parsed.data.sourceType,
    notes: parsed.data.notes,
    reason: parsed.data.reason,
    actorId: user.id,
  });
  revalidatePath(`/dashboard/customers/${parsed.data.contactId}`);
  revalidatePath("/dashboard/marketing/attribution");
  return { success: true as const };
}

export async function generateStrategyAction(raw: unknown) {
  const schema = z.object({
    title: z.string().trim().min(2).max(200),
    budgetAmount: z.coerce.number().positive(),
    periodType: z.enum(["daily", "weekly", "monthly", "custom"]),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: "Geçersiz strateji formu." };
  }
  const user = await requireUser();
  const admin = createAdminClient();
  const strategy = await generateMarketingStrategyDraft(admin, {
    title: parsed.data.title,
    budgetAmount: parsed.data.budgetAmount,
    periodType: parsed.data.periodType,
    createdBy: user.id,
  });
  revalidatePath("/dashboard/marketing/strategies");
  return { success: true as const, id: strategy.id };
}

export async function createExperimentAction(raw: unknown) {
  const schema = z.object({
    title: z.string().trim().min(2).max(200),
    experimentType: z.enum([
      "creative",
      "audience",
      "ad_copy",
      "cta",
      "placement",
    ]),
    hypothesis: z.string().trim().min(5).max(2000),
    changedVariable: z.string().trim().min(2).max(200),
    budgetAmount: z.coerce.number().positive().optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: "Geçersiz deney formu." };
  }
  const user = await requireUser();
  const admin = createAdminClient();
  try {
    const exp = await createExperiment(admin, {
      ...parsed.data,
      createdBy: user.id,
    });
    revalidatePath("/dashboard/marketing/experiments");
    return { success: true as const, id: exp.id };
  } catch (e) {
    return {
      success: false as const,
      error: e instanceof Error ? e.message : "Deney oluşturulamadı.",
    };
  }
}

export async function rebuildAttributionFunnelAction(contactId: string) {
  const parsed = z.string().uuid().safeParse(contactId);
  if (!parsed.success) {
    return { success: false as const, error: "Geçersiz müşteri." };
  }
  await requireUser();
  const admin = createAdminClient();
  const { rebuildAttributionFunnelForContact } = await import(
    "@/features/marketing/services/attribution-funnel.service"
  );
  const result = await rebuildAttributionFunnelForContact(admin, parsed.data);
  revalidatePath("/dashboard/marketing/attribution");
  revalidatePath(`/dashboard/marketing/attribution/${parsed.data}`);
  revalidatePath(`/dashboard/customers/${parsed.data}`);
  return {
    success: true as const,
    stages: result.events.length,
    status: result.attributionStatus,
  };
}

export async function generateMarketingDailyReportAction() {
  await requireUser();
  const admin = createAdminClient();
  const { generateMarketingDailyReport } = await import(
    "@/features/marketing/services/marketing-daily-report.service"
  );
  const report = await generateMarketingDailyReport(admin);
  revalidatePath("/dashboard/marketing/attribution");
  revalidatePath("/dashboard/marketing/reports");
  return { success: true as const, ...report };
}

export async function createLearningAction(raw: unknown) {
  const schema = z.object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().min(5).max(4000),
    rationale: z.string().trim().min(5).max(2000),
    confidenceLevel: z.coerce.number().min(0).max(100),
    supportingExperimentCount: z.coerce.number().int().min(0),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: "Geçersiz öğrenim formu." };
  }
  const user = await requireUser();
  const admin = createAdminClient();
  const row = await createLearning(admin, {
    ...parsed.data,
    createdBy: user.id,
  });
  revalidatePath("/dashboard/marketing/memory");
  return { success: true as const, id: row.id };
}
