import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;

/** Araştırma SLA: ~2 saat → ertesi gün → 3 gün nazik kapanış → uzun vadeli açık kapı. */
const CADENCE: Array<{
  hours: number;
  reason: string;
  message: string;
}> = [
  {
    hours: 2,
    reason: "cadence_2h",
    message:
      "Selam, mesajım arada kaybolmasın diye yazdım. İsterseniz Elite ve Basic içinden size en uygun olanı birlikte sadeleştirebilirim.",
  },
  {
    hours: 24,
    reason: "cadence_24h",
    message:
      "Günaydın, dün konuştuğumuz seçenekler için takvim tarafı hâlâ değerlendirilebilir. İsterseniz bugün içinde kapora ile tarihi nasıl kilitleyeceğimizi kısaca anlatayım.",
  },
  {
    hours: 72,
    reason: "cadence_3d",
    message:
      "Merhaba, kapanış yapmadan önce bir kez daha yazmak istedim. İhtiyaç değiştiyse ya da daha sade bir kapsam istiyorsanız ona göre de özet çıkarabilirim.",
  },
  {
    hours: 168,
    reason: "cadence_7d",
    message:
      "Merhaba, hâlâ değerlendirme aşamasındaysanız buradayız. Tarihiniz netleşince tek mesajla kaldığımız yerden devam edebiliriz.",
  },
  {
    hours: 720,
    reason: "cadence_30d",
    message:
      "Merhaba, uzun süredir yazışmamıştık. Çekim planınız devam ediyorsa güncel ihtiyaçlarınıza göre yeniden bakabiliriz; acele yok, buradayız.",
  },
];

/**
 * Müşteri her cevap verdiğinde bekleyen takipleri iptal eder.
 */
export async function cancelPendingFollowUpsOnReply(
  supabase: TypedSupabaseClient,
  contactId: string
) {
  const { error } = await supabase
    .from("follow_up_tasks")
    .update({
      status: "cancelled",
      cancelled_reason: "customer_replied",
    })
    .eq("contact_id", contactId)
    .in("status", ["pending", "queued"]);
  if (error) throw error;
}

/**
 * Sessizlik sonrası 24s / 3g / 7g / 30g planı — mesajlar farklı.
 * Aynı contact için cadence reason'ları zaten pending ise yeniden eklemez.
 */
export async function scheduleSalesCadence(
  supabase: TypedSupabaseClient,
  params: {
    contactId: string;
    conversationId?: string | null;
    reservationId?: string | null;
  }
) {
  const { data: existing } = await supabase
    .from("follow_up_tasks")
    .select("reason")
    .eq("contact_id", params.contactId)
    .in("status", ["pending", "queued"])
    .like("reason", "cadence_%");

  const existingReasons = new Set((existing ?? []).map((r) => r.reason));

  const created = [];
  for (const step of CADENCE) {
    if (existingReasons.has(step.reason)) continue;

    const scheduledAt = new Date(
      Date.now() + step.hours * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase
      .from("follow_up_tasks")
      .insert({
        contact_id: params.contactId,
        conversation_id: params.conversationId ?? null,
        reservation_id: params.reservationId ?? null,
        reason: step.reason,
        scheduled_at: scheduledAt,
        status: "pending",
        ai_generated_message: step.message,
      })
      .select("*")
      .single();
    if (error) throw error;
    created.push(data);
  }
  return created;
}

export async function scheduleSatisfactionFlow(
  supabase: TypedSupabaseClient,
  params: {
    contactId: string;
    reservationId: string;
    conversationId?: string | null;
  }
) {
  const steps: Array<{
    step: "thanks" | "review" | "google" | "instagram_tag" | "referral";
    delayHours: number;
    message: string;
  }> = [
    {
      step: "thanks",
      delayHours: 2,
      message:
        "Çekiminiz için tekrar teşekkür ederiz. İyi ki bizimle çalıştınız; teslim sürecinde de yanınızdayız.",
    },
    {
      step: "review",
      delayHours: 48,
      message:
        "Deneyiminizi kısaca paylaşmak ister misiniz? Geri bildiriminiz bizim için çok değerli.",
    },
    {
      step: "google",
      delayHours: 72,
      message:
        "Uygun görürseniz Google üzerinden kısa bir değerlendirme bırakmanız bizi çok mutlu eder. İsterseniz linki iletebiliriz.",
    },
    {
      step: "instagram_tag",
      delayHours: 96,
      message:
        "Çekimlerden paylaşım yaparsanız bizi etiketlemeniz harika olur; hikâyenizi büyük bir keyifle paylaşırız.",
    },
    {
      step: "referral",
      delayHours: 168,
      message:
        "Çevrenizde düğün/nişan çekecek birileri varsa bizi önermeniz en güzel referans olur. Teşekkürler!",
    },
  ];

  for (const s of steps) {
    await supabase.from("satisfaction_tasks").upsert(
      {
        contact_id: params.contactId,
        reservation_id: params.reservationId,
        conversation_id: params.conversationId ?? null,
        step: s.step,
        scheduled_at: new Date(
          Date.now() + s.delayHours * 60 * 60 * 1000
        ).toISOString(),
        status: "pending",
        message_template: s.message,
      },
      { onConflict: "reservation_id,step" }
    );
  }

  await supabase
    .from("customer_profiles")
    .update({ satisfaction_flow_status: "pending" })
    .eq("contact_id", params.contactId);
}

export async function runDueSatisfactionTasks(
  supabase: TypedSupabaseClient
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("satisfaction_tasks")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .limit(40);
  if (error) throw error;

  let processed = 0;
  for (const task of data ?? []) {
    await supabase
      .from("satisfaction_tasks")
      .update({ status: "queued" })
      .eq("id", task.id);
    processed += 1;
  }
  return { processed, total: data?.length ?? 0 };
}
