import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;

const OPT_OUT =
  /istemiyorum|rahatsız etmeyin|rahatsiz etmeyin|iptal|vazgeçtim|vazgectim/i;

const SOFT_CLOSE: Array<{ pattern: RegExp; reason: string; delayHours: number }> =
  [
    {
      pattern:
        /bugün\s*(konuş|bakar|bakarız|bakariz)|bu\s*akşam|akşama\s*bakar/i,
      reason: "thinking",
      delayHours: 6,
    },
    {
      pattern: /hafta\s*sonu|cumartesi|pazar\s*gün/i,
      reason: "ask_spouse",
      delayHours: 48,
    },
    {
      pattern:
        /düşüneceğim|dusunecegim|düşünelim|dusunelim|karar vermed|henüz karar|henuz karar|daha karar|bakarız|bakariz/i,
      reason: "thinking",
      delayHours: 2,
    },
    { pattern: /eşime sor|esime sor/i, reason: "ask_spouse", delayHours: 24 },
    { pattern: /sonra yaz|size döner|size doner/i, reason: "will_return", delayHours: 24 },
    { pattern: /bütçe|butce|fiyat yüksek|pahalı|pahali/i, reason: "price_high", delayHours: 24 },
    { pattern: /tarih net|tarihimiz netleş/i, reason: "date_unclear", delayHours: 168 },
    { pattern: /şimdilik kalsın|simdilik kalsin/i, reason: "pause", delayHours: 72 },
  ];

export function classifyFollowUpReason(message: string): {
  optOut: boolean;
  reason: string | null;
  delayHours: number | null;
} {
  if (OPT_OUT.test(message)) {
    return { optOut: true, reason: "opt_out", delayHours: null };
  }
  for (const rule of SOFT_CLOSE) {
    if (rule.pattern.test(message)) {
      return {
        optOut: false,
        reason: rule.reason,
        delayHours: rule.delayHours,
      };
    }
  }
  return { optOut: false, reason: null, delayHours: null };
}

export async function cancelFollowUpsForContact(
  supabase: TypedSupabaseClient,
  contactId: string,
  reason: string
) {
  const { error } = await supabase
    .from("follow_up_tasks")
    .update({
      status: "cancelled",
      cancelled_reason: reason,
    })
    .eq("contact_id", contactId)
    .eq("status", "pending");
  if (error) throw error;
}

export async function scheduleFollowUp(
  supabase: TypedSupabaseClient,
  params: {
    contactId: string;
    conversationId?: string | null;
    reservationId?: string | null;
    reason: string;
    delayHours: number;
    message?: string | null;
  }
) {
  const { count } = await supabase
    .from("follow_up_tasks")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", params.contactId)
    .in("status", ["pending", "sent", "queued"]);

  if ((count ?? 0) >= 3) {
    return null;
  }

  const scheduledAt = new Date(
    Date.now() + params.delayHours * 60 * 60 * 1000
  ).toISOString();

  const defaultMessage =
    params.reason === "price_high"
      ? "Bütçe başlığı önemli, haklısınız. İsterseniz Elite ile Basic farkını iki satırda sadeleştirip gereksiz kalemi eleyelim."
      : params.reason === "ask_spouse"
        ? "Merhaba, eşinize iletebileceğiniz kısa özeti isterseniz tek mesajda yeniden yazayım; kararınız netleşince devam ederiz."
        : params.reason === "thinking"
          ? "Selam, mesajım arada kaybolmasın diye yazdım. İsterseniz iki paket içinden size en yakın olanı birlikte sadeleştirebilirim."
          : "Merhaba, çekim detaylarını değerlendirme fırsatınız oldu mu? İsterseniz kaldığınız yerden net bir özet çıkarayım.";

  const { data, error } = await supabase
    .from("follow_up_tasks")
    .insert({
      contact_id: params.contactId,
      conversation_id: params.conversationId ?? null,
      reservation_id: params.reservationId ?? null,
      reason: params.reason,
      scheduled_at: scheduledAt,
      status: "pending",
      ai_generated_message: params.message ?? defaultMessage,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function processInboundForFollowUp(
  supabase: TypedSupabaseClient,
  params: {
    contactId: string;
    conversationId: string;
    message: string;
    reservationId?: string | null;
  }
) {
  // Her müşteri cevabında bekleyen takipleri iptal et (spam önleme)
  const { cancelPendingFollowUpsOnReply } = await import(
    "@/features/smart-sales/services/follow-up-cadence.service"
  );
  await cancelPendingFollowUpsOnReply(supabase, params.contactId);

  const classified = classifyFollowUpReason(params.message);
  if (classified.optOut) {
    await cancelFollowUpsForContact(
      supabase,
      params.contactId,
      "customer_opt_out"
    );
    return { action: "cancelled" as const };
  }
  if (classified.reason && classified.delayHours != null) {
    const task = await scheduleFollowUp(supabase, {
      contactId: params.contactId,
      conversationId: params.conversationId,
      reservationId: params.reservationId,
      reason: classified.reason,
      delayHours: classified.delayHours,
    });
    return { action: "scheduled" as const, task };
  }
  return { action: "none" as const };
}

export type FollowUpTaskListItem = {
  id: string;
  reason: string;
  status: string;
  scheduled_at: string;
  attempt_count: number;
  ai_generated_message: string | null;
  conversation_id: string | null;
  contact_id: string | null;
  canSendViaMeta: boolean;
  contactUsername: string | null;
};

export async function listFollowUpTasks(
  supabase: TypedSupabaseClient
): Promise<FollowUpTaskListItem[]> {
  const { data, error } = await supabase
    .from("follow_up_tasks")
    .select(
      "id,reason,status,scheduled_at,attempt_count,ai_generated_message,conversation_id,contact_id"
    )
    .order("scheduled_at", { ascending: true })
    .limit(100);
  if (error) throw error;

  const contactIds = [
    ...new Set(
      (data ?? [])
        .map((r) => r.contact_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const contactMap = new Map<
    string,
    { username: string | null; meta_igsid: string | null }
  >();
  if (contactIds.length > 0) {
    const { data: contacts, error: cErr } = await supabase
      .from("contacts")
      .select("id,username,meta_igsid")
      .in("id", contactIds);
    if (cErr) throw cErr;
    for (const c of contacts ?? []) {
      contactMap.set(c.id, {
        username: c.username,
        meta_igsid: c.meta_igsid,
      });
    }
  }

  return (data ?? []).map((row) => {
    const contact = row.contact_id
      ? (contactMap.get(row.contact_id) ?? null)
      : null;
    const igsid = contact?.meta_igsid?.trim() ?? "";
    return {
      id: row.id,
      reason: row.reason,
      status: row.status,
      scheduled_at: row.scheduled_at,
      attempt_count: row.attempt_count,
      ai_generated_message: row.ai_generated_message,
      conversation_id: row.conversation_id,
      contact_id: row.contact_id,
      canSendViaMeta: /^\d{5,}$/.test(igsid),
      contactUsername: contact?.username ?? null,
    };
  });
}

/**
 * Tek follow-up görevini Meta DM ile gönderir; başarıda status=sent.
 */
export async function sendFollowUpViaMeta(
  supabase: TypedSupabaseClient,
  taskId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: task, error } = await supabase
    .from("follow_up_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw error;
  if (!task) return { ok: false, message: "Görev bulunamadı." };
  if (task.status !== "queued" && task.status !== "pending") {
    return { ok: false, message: "Görev gönderilebilir durumda değil." };
  }
  if (!task.contact_id) {
    return { ok: false, message: "Görevde müşteri yok." };
  }
  const text = task.ai_generated_message?.trim();
  if (!text) return { ok: false, message: "Gönderilecek mesaj yok." };

  const { sendMetaDmForContact } = await import(
    "@/features/marketing/services/meta/meta-messaging.service"
  );
  const sent = await sendMetaDmForContact(supabase, {
    contactId: task.contact_id,
    conversationId: task.conversation_id,
    text,
  });

  const now = new Date().toISOString();
  if (!sent.ok) {
    const nextAttempts = task.attempt_count + 1;
    await supabase
      .from("follow_up_tasks")
      .update({
        attempt_count: nextAttempts,
        last_attempt_at: now,
        status: nextAttempts >= 3 ? "failed" : task.status,
      })
      .eq("id", task.id);
    return { ok: false, message: sent.message };
  }

  await supabase
    .from("follow_up_tasks")
    .update({
      status: "sent",
      attempt_count: task.attempt_count + 1,
      last_attempt_at: now,
      cancelled_reason: null,
    })
    .eq("id", task.id);

  return { ok: true };
}

export async function runDueFollowUps(supabase: TypedSupabaseClient) {
  const { isAiFeatureEnabled } = await import(
    "@/features/settings/services/ai-feature-flags.service"
  );
  if (!(await isAiFeatureEnabled(supabase, "AI_FOLLOW_UP"))) {
    return {
      processed: 0,
      sentViaMeta: 0,
      queued: 0,
      total: 0,
      skippedByFlag: true as const,
    };
  }

  const { createPanelNotification } = await import(
    "@/features/notifications/services/notifications.service"
  );
  const { sendMetaDmForContact } = await import(
    "@/features/marketing/services/meta/meta-messaging.service"
  );

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("follow_up_tasks")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .limit(50);
  if (error) throw error;

  let processed = 0;
  let sentViaMeta = 0;
  let queued = 0;

  for (const task of data ?? []) {
    if (task.attempt_count >= 3) {
      await supabase
        .from("follow_up_tasks")
        .update({ status: "skipped", cancelled_reason: "max_attempts" })
        .eq("id", task.id);
      continue;
    }

    const text = task.ai_generated_message?.trim();
    if (task.contact_id && text) {
      const sent = await sendMetaDmForContact(supabase, {
        contactId: task.contact_id,
        conversationId: task.conversation_id,
        text,
      });
      if (sent.ok) {
        await supabase
          .from("follow_up_tasks")
          .update({
            status: "sent",
            attempt_count: task.attempt_count + 1,
            last_attempt_at: now,
          })
          .eq("id", task.id);
        sentViaMeta += 1;
        processed += 1;
        continue;
      }
      // missing_igsid / window → personel kuyruğu
    }

    await supabase
      .from("follow_up_tasks")
      .update({
        status: "queued",
        attempt_count: task.attempt_count + 1,
        last_attempt_at: now,
      })
      .eq("id", task.id);

    await createPanelNotification(supabase, {
      type: "follow_up_due",
      title: "Takip mesajı gönderilmeyi bekliyor",
      body: (task.ai_generated_message ?? "Follow-up görevi hazır.").slice(
        0,
        180
      ),
      payload: {
        followUpTaskId: task.id,
        conversationId: task.conversation_id,
        contactId: task.contact_id,
      },
    });

    queued += 1;
    processed += 1;
  }
  return {
    processed,
    sentViaMeta,
    queued,
    total: data?.length ?? 0,
    skippedByFlag: false as const,
  };
}
