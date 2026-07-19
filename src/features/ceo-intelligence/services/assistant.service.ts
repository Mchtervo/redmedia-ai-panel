import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { insertAiRun } from "@/features/ai/repositories/ai-runs.repository";
import {
  CEO_ASSISTANT_NO_DATA,
  type CeoMetricsSnapshot,
  type CeoRiskItem,
} from "@/features/ceo-intelligence/types";
import { collectCeoMetrics } from "@/features/ceo-intelligence/services/metrics.service";
import { detectCeoRisks } from "@/features/ceo-intelligence/services/risks.service";
import {
  buildCeoRecommendations,
  buildSummaryBullets,
} from "@/features/ceo-intelligence/services/recommendations.service";
import { formatTry } from "@/features/ceo-intelligence/utils/time";
import {
  createRoutedChatCompletion,
  getRoutedModel,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";

type TypedSupabaseClient = SupabaseClient<Database>;

const TASK_TYPE = "ceo_management_assistant";

const SYSTEM_PROMPT = `Sen Redmedia CEO Intelligence yönetim asistanısın.
Yalnızca kullanıcının sorusuna ve aşağıda verilen GERÇEK VERİ JSON'una göre Türkçe cevap ver.

ZORUNLU KURALLAR:
- Veride olmayan bilgiyi ASLA tahmin etme, uydurma veya genelleme.
- Veri yoksa veya yetersizse aynen şunu söyle: "${CEO_ASSISTANT_NO_DATA}"
- Fiyat değiştirme, kampanya oluşturma, personel atama, ödeme/rezervasyon onaylama YAPAMAZSIN ve önerme.
- Yalnızca analiz / yorum / tavsiye niteliğinde konuş; karar adminindir.
- Kısa ve net ol; sayıları Türkçe yerelleştirilmiş ver.
- "dataGaps" alanındaki eksikleri dürüstçe belirt.`;

function buildContextPacket(metrics: CeoMetricsSnapshot, extras: unknown) {
  return {
    metrics,
    summaryBullets: buildSummaryBullets(metrics),
    extras,
    money: {
      estimatedRevenueToday: formatTry(metrics.estimatedRevenueToday),
      estimatedRevenueThisWeek: formatTry(metrics.estimatedRevenueThisWeek),
      pendingCollections: formatTry(metrics.pendingCollections),
    },
  };
}

export type CeoAssistantResult = {
  answer: string;
  status: "completed" | "no_data" | "error";
  model: string | null;
};

export async function askCeoAssistant(
  supabase: TypedSupabaseClient,
  question: string,
  askedBy: string | null
): Promise<CeoAssistantResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    return {
      answer: "Lütfen bir soru yazın.",
      status: "no_data",
      model: null,
    };
  }

  const { isAiFeatureEnabled } = await import(
    "@/features/settings/services/ai-feature-flags.service"
  );
  if (!(await isAiFeatureEnabled(supabase, "AI_CEO"))) {
    return {
      answer:
        "CEO Intelligence AI kapalı. Ayarlar → AI Kontrolleri'nden AI_CEO anahtarını açın.",
      status: "no_data",
      model: null,
    };
  }

  const metrics = await collectCeoMetrics(supabase);
  const risks = await detectCeoRisks(supabase, metrics);
  const recommendations = buildCeoRecommendations(metrics, risks);
  const packet = buildContextPacket(metrics, { risks, recommendations });

  if (!isOpenAiConfigured()) {
    const fallback = answerWithoutLlm(trimmed, metrics, risks);
    await logAssistant(supabase, {
      askedBy,
      question: trimmed,
      answer: fallback.answer,
      snapshot: packet,
      model: null,
      status: fallback.status,
    });
    return fallback;
  }

  const model = getRoutedModel("ceo_intelligence");
  try {
    const { completion, modelUsed } = await createRoutedChatCompletion(
      "ceo_intelligence",
      {
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Soru:\n${trimmed}\n\nGERÇEK VERİ JSON:\n${JSON.stringify(packet)}`,
          },
        ],
      }
    );

    const answer =
      completion.choices[0]?.message?.content?.trim() ||
      CEO_ASSISTANT_NO_DATA;
    const status = answer.includes("yeterli veri sistemde yok")
      ? ("no_data" as const)
      : ("completed" as const);

    await insertAiRun(supabase, {
      taskType: TASK_TYPE,
      conversationId: null,
      contactId: null,
      model: modelUsed,
      inputTokens: completion.usage?.prompt_tokens ?? null,
      outputTokens: completion.usage?.completion_tokens ?? null,
      result: { question: trimmed, answer } as Json,
      status: "completed",
    });

    await logAssistant(supabase, {
      askedBy,
      question: trimmed,
      answer,
      snapshot: packet,
      model: modelUsed,
      status,
    });

    return { answer, status, model: modelUsed };
  } catch {
    const answer =
      "Yönetim asistanı şu an yanıt üretemedi. Metrik paneline bakabilir veya tekrar deneyebilirsiniz.";
    await logAssistant(supabase, {
      askedBy,
      question: trimmed,
      answer,
      snapshot: packet,
      model,
      status: "error",
    });
    return { answer, status: "error", model };
  }
}

function answerWithoutLlm(
  question: string,
  metrics: CeoMetricsSnapshot,
  risks: CeoRiskItem[]
): CeoAssistantResult {
  const q = question.toLocaleLowerCase("tr-TR");

  if (q.includes("kapora")) {
    return {
      answer: `Şu an ${metrics.awaitingDeposit} kişi/kapora aşaması bekliyor.`,
      status: "completed",
      model: null,
    };
  }
  if (q.includes("dekont")) {
    return {
      answer: `${metrics.awaitingReceiptReview} dekont onay bekliyor.`,
      status: "completed",
      model: null,
    };
  }
  if (q.includes("rezervasyon") && (q.includes("ay") || q.includes("bu ay"))) {
    return {
      answer: `Bu ay ${metrics.reservationsThisMonth} rezervasyon (onaylı/aktif hattı), ${metrics.cancelledThisMonth} iptal/kayıp.`,
      status: "completed",
      model: null,
    };
  }
  if (q.includes("paket") || q.includes("hizmet")) {
    if (!metrics.topPackages[0]) {
      return { answer: CEO_ASSISTANT_NO_DATA, status: "no_data", model: null };
    }
    const list = metrics.topPackages
      .slice(0, 5)
      .map((p) => `${p.label} (${p.count})`)
      .join(", ");
    return {
      answer: `En çok görülen hizmetler: ${list}.`,
      status: "completed",
      model: null,
    };
  }
  if (q.includes("plato")) {
    if (!metrics.topPlateaus[0]) {
      return { answer: CEO_ASSISTANT_NO_DATA, status: "no_data", model: null };
    }
    const list = metrics.topPlateaus
      .slice(0, 5)
      .map((p) => `${p.label} (${p.count})`)
      .join(", ");
    return {
      answer: `En çok tercih edilen platolar: ${list}.`,
      status: "completed",
      model: null,
    };
  }
  if (q.includes("reklam") || q.includes("kampanya")) {
    if (!metrics.topCampaignsByAttribution[0]) {
      return {
        answer:
          metrics.dataGaps.find((g) => g.includes("attribution")) ??
          CEO_ASSISTANT_NO_DATA,
        status: "no_data",
        model: null,
      };
    }
    const top = metrics.topCampaignsByAttribution[0];
    return {
      answer: `Atıf verisine göre önde: "${top.label}" (${top.count} olay).`,
      status: "completed",
      model: null,
    };
  }
  if (q.includes("çalışan") || q.includes("personel") || q.includes("çekim")) {
    if (q.includes("boş") || q.includes("boşta")) {
      return {
        answer: `Bugün ${metrics.staffOnDutyToday} görevli, ${metrics.staffIdleToday} boşta (aktif ${metrics.staffActiveTotal}).`,
        status: "completed",
        model: null,
      };
    }
    if (!metrics.topStaffByShoots[0]) {
      return { answer: CEO_ASSISTANT_NO_DATA, status: "no_data", model: null };
    }
    const list = metrics.topStaffByShoots
      .slice(0, 5)
      .map((p) => `${p.label} (${p.count})`)
      .join(", ");
    return {
      answer: `Bu ay en çok çekime çıkanlar: ${list}.`,
      status: "completed",
      model: null,
    };
  }
  if (q.includes("boş gün") || q.includes("boş günümüz")) {
    if (metrics.freeDaysThisWeek.length === 0) {
      return {
        answer: "Bu hafta boş gün görünmüyor (veya tüm günler dolu).",
        status: "completed",
        model: null,
      };
    }
    return {
      answer: `Bu hafta boş günler: ${metrics.freeDaysThisWeek.join(", ")}.`,
      status: "completed",
      model: null,
    };
  }
  if (q.includes("pazarlık")) {
    return {
      answer: `Son 30 günde ${metrics.negotiatingLast30Days} profil pazarlık aşamasında güncellendi.`,
      status: "completed",
      model: null,
    };
  }
  if (q.includes("itiraz")) {
    if (!metrics.topObjections[0]) {
      return { answer: CEO_ASSISTANT_NO_DATA, status: "no_data", model: null };
    }
    const list = metrics.topObjections
      .slice(0, 5)
      .map((p) => `${p.label} (${p.count})`)
      .join(", ");
    return {
      answer: `En sık itirazlar: ${list}.`,
      status: "completed",
      model: null,
    };
  }
  if (q.includes("yapılması gereken") || q.includes("bugün yapıl")) {
    const tops = risks.slice(0, 5).map((r) => r.title);
    return {
      answer:
        tops.length > 0
          ? `Bugün dikkat: ${tops.join("; ")}.`
          : "Kritik risk listesi boş; Inbox ve ödemeleri gözden geçirin.",
      status: "completed",
      model: null,
    };
  }
  if (q.includes("satış düş") || q.includes("dün neden")) {
    return {
      answer: `Bugün ${metrics.salesToday}, dün ${metrics.salesYesterday} onay/güncelleme kaydı var. Neden analizi için daha fazla attribution/konuşma özeti gerekir; kesin neden uydurulmaz.`,
      status: "completed",
      model: null,
    };
  }

  return {
    answer: `Canlı özet — yeni müşteri: ${metrics.newCustomersToday}, aktif konuşma: ${metrics.activeConversations}, kapora: ${metrics.awaitingDeposit}, dekont: ${metrics.awaitingReceiptReview}, bugün çekim: ${metrics.shootsToday}. Daha spesifik sorun veya OpenAI anahtarı ile zengin cevap alın.`,
    status: "completed",
    model: null,
  };
}

async function logAssistant(
  supabase: TypedSupabaseClient,
  params: {
    askedBy: string | null;
    question: string;
    answer: string;
    snapshot: unknown;
    model: string | null;
    status: "completed" | "no_data" | "error";
  }
) {
  await supabase.from("ceo_assistant_logs").insert({
    asked_by: params.askedBy,
    question: params.question,
    answer: params.answer,
    data_snapshot: params.snapshot as Json,
    model: params.model,
    status: params.status,
  });
}
