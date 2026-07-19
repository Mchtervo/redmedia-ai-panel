import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import {
  INSUFFICIENT_DATA_MESSAGE,
  type RecommendationFields,
} from "@/features/marketing/types";
import { resolveMetaAccessToken } from "@/features/marketing/services/meta/token.service";
import { insertAiRun } from "@/features/ai/repositories/ai-runs.repository";
import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";
import { getDailyAdBudgetTry } from "@/features/settings/services/ai-feature-flags.service";
import { isAiFeatureEnabled } from "@/features/settings/services/ai-feature-flags.service";

type TypedSupabaseClient = SupabaseClient<Database>;

const ITEM_TYPES = [
  "budget_allocation",
  "continue",
  "increase_budget",
  "decrease_budget",
  "pause_suggest",
  "remarketing",
  "test_content",
  "new_experiment",
  "other",
] as const;

const strategyLlmSchema = z.object({
  summary: z.string().min(20).max(800),
  overallConfidence: z.number().min(0).max(100),
  items: z
    .array(
      z.object({
        item_type: z.enum(ITEM_TYPES),
        recommendation: z.string().min(10).max(500),
        suggestedBudget: z.number().nullable(),
        expectedGoal: z.string().max(200),
        rationale: z.string().min(10).max(600),
        confidenceLevel: z.number().min(0).max(100),
        temperatureBucket: z
          .enum(["cold", "warm", "hot"])
          .nullable()
          .optional(),
      })
    )
    .min(1)
    .max(8),
});

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  return JSON.parse(fenced?.[1]?.trim() ?? trimmed) as unknown;
}

async function loadStrategyEvidence(supabase: TypedSupabaseClient) {
  const [{ data: metrics }, { data: attributions }, { count: mediaCount }] =
    await Promise.all([
      supabase
        .from("ad_daily_metrics")
        .select("ad_id, spend, impressions, clicks, messages_started, date")
        .order("date", { ascending: false })
        .limit(40),
      supabase
        .from("customer_attributions")
        .select("ad_id, campaign_id, confidence, created_at")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("instagram_media")
        .select("id", { count: "exact", head: true }),
    ]);

  const spend = (metrics ?? []).reduce(
    (sum, row) => sum + Number(row.spend ?? 0),
    0
  );
  const messages = (metrics ?? []).reduce(
    (sum, row) => sum + Number(row.messages_started ?? 0),
    0
  );

  return {
    metricRows: metrics ?? [],
    attributionCount: attributions?.length ?? 0,
    mediaCount: mediaCount ?? 0,
    spend7ish: spend,
    messages7ish: messages,
  };
}

/**
 * Strateji üretir — kampanya aç/kapa/bütçe değiştirMEZ.
 * Veri yetersizse insufficient item döner.
 * AI_MARKETING kapalıysa üretmez.
 */
export async function generateMarketingStrategyDraft(
  supabase: TypedSupabaseClient,
  params: {
    title: string;
    budgetAmount: number;
    periodType: "daily" | "weekly" | "monthly" | "custom";
    createdBy: string | null;
  }
) {
  if (!(await isAiFeatureEnabled(supabase, "AI_MARKETING"))) {
    throw new Error(
      "Pazarlama AI kapalı. Ayarlar → AI Kontrolleri'nden AI_MARKETING'i açın."
    );
  }

  const { count: metricCount } = await supabase
    .from("ad_daily_metrics")
    .select("id", { count: "exact", head: true });

  const token = await resolveMetaAccessToken(supabase);
  const hasData = (metricCount ?? 0) > 0 && Boolean(token);
  const configuredBudget =
    (await getDailyAdBudgetTry(supabase)) ?? params.budgetAmount;

  const { data: strategy, error } = await supabase
    .from("marketing_strategies")
    .insert({
      title: params.title,
      period_type: params.periodType,
      budget_amount: configuredBudget,
      data_sufficiency: hasData ? "partial" : "insufficient",
      overall_confidence: hasData ? 40 : 0,
      status: "draft",
      summary: hasData
        ? "Taslak strateji üretiliyor…"
        : INSUFFICIENT_DATA_MESSAGE,
      created_by: params.createdBy,
    })
    .select("*")
    .single();

  if (error) throw error;

  type ItemInsert = RecommendationFields & {
    item_type: Database["public"]["Tables"]["marketing_strategy_items"]["Insert"]["item_type"];
  };

  let items: ItemInsert[] = [];
  let overallConfidence = hasData ? 40 : 0;
  let summary = hasData
    ? "Taslak strateji — tüm maddeler öneridir; otomatik uygulanmaz."
    : INSUFFICIENT_DATA_MESSAGE;

  if (!hasData) {
    items = [
      {
        item_type: "other",
        recommendation: INSUFFICIENT_DATA_MESSAGE,
        suggestedBudget: null,
        expectedGoal: "Veri birikimi",
        rationale:
          "Meta bağlantısı veya reklam metrikleri yok. Sahte öneri üretilmedi.",
        dataRangeLabel: "—",
        dataSufficiency: "insufficient",
        confidenceLevel: 0,
      },
    ];
  } else if (!isOpenAiConfigured()) {
    items = [
      {
        item_type: "budget_allocation",
        recommendation: `Günlük ${configuredBudget} TRY bütçeyi soğuk/ılık/sıcak kovalara bölün; dönüşüm sinyali zayıf reklamlarda duraklatma önerin (manuel).`,
        suggestedBudget: configuredBudget * 0.5,
        expectedGoal: "Rezervasyon ve kapora odaklı harcama",
        rationale:
          "OpenAI yapılandırılmadığı için kural tabanlı taslak üretildi.",
        dataRangeLabel: "ad_daily_metrics + attribution",
        dataSufficiency: "partial",
        confidenceLevel: 30,
      },
    ];
    overallConfidence = 30;
  } else {
    const evidence = await loadStrategyEvidence(supabase);
    const system = `Sen Redmedia (Ankara düğün/nişan video) için Meta reklam stratejisti AI'sısın.
KURALLAR:
- Kampanya aç/kapa/bütçe DEĞİŞTİRME; yalnızca ÖNERİ üret.
- Sıcak (hot), ılık (warm), soğuk (cold) kova mantığı kullan.
- Günlük bütçeye göre kaç kreatif / kaç test stratejisi öner.
- Trafik / etkileşim / mesaj hedefi önerisi ver.
- Instagram organik içerikleri kreatife çevirme önerisi verebilirsin.
- Fiyat veya hizmet UYDURMA.
- Türkçe yaz.
- SADECE JSON: {"summary","overallConfidence","items":[{"item_type","recommendation","suggestedBudget","expectedGoal","rationale","confidenceLevel","temperatureBucket"}]}
item_type: budget_allocation|continue|increase_budget|decrease_budget|pause_suggest|remarketing|test_content|new_experiment|other
temperatureBucket: cold|warm|hot (soğuk/ılık/sıcak kitle)`;

    const user = JSON.stringify({
      dailyBudgetTry: configuredBudget,
      periodType: params.periodType,
      evidence: {
        recentMetricSample: evidence.metricRows.slice(0, 15),
        attributionSampleCount: evidence.attributionCount,
        instagramMediaCount: evidence.mediaCount,
        spendSumSample: evidence.spend7ish,
        messagesSumSample: evidence.messages7ish,
      },
      successDefinition:
        "Başarı = rezervasyon/kapora/ciro; yalnızca mesaj sayısı başarı sayılmaz.",
    });

    try {
      const { completion, modelUsed } = await createRoutedChatCompletion(
        "marketing_strategy",
        {
          temperature: 0.35,
          max_tokens: 1200,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }
      );

      const rawText = completion.choices[0]?.message?.content?.trim() ?? "";
      const parsed = strategyLlmSchema.parse(extractJsonObject(rawText));
      summary = parsed.summary;
      overallConfidence = Math.round(parsed.overallConfidence);
      items = parsed.items.map((item) => ({
        item_type: item.item_type,
        recommendation: item.recommendation,
        suggestedBudget: item.suggestedBudget,
        expectedGoal: item.expectedGoal,
        rationale: `${item.rationale}${
          item.temperatureBucket
            ? ` [kova: ${item.temperatureBucket}]`
            : ""
        }`,
        dataRangeLabel: "ad_daily_metrics + attribution + IG medya",
        dataSufficiency: "partial" as const,
        confidenceLevel: Math.round(item.confidenceLevel),
      }));

      await insertAiRun(supabase, {
        taskType: "marketing_strategy",
        conversationId: null,
        contactId: null,
        model: modelUsed,
        inputTokens: completion.usage?.prompt_tokens ?? null,
        outputTokens: completion.usage?.completion_tokens ?? null,
        result: {
          input: { dailyBudgetTry: configuredBudget },
          output: { itemCount: items.length, summary },
        } as Json,
        status: "completed",
        requiresHumanApproval: false,
      });
    } catch (llmError) {
      console.error(
        "[marketing-strategy] LLM hatası:",
        llmError instanceof Error ? llmError.message : "bilinmeyen"
      );
      items = [
        {
          item_type: "other",
          recommendation:
            "Strateji modeli şu an yanıt veremedi. Metrikler mevcut; lütfen tekrar deneyin.",
          suggestedBudget: null,
          expectedGoal: "Tekrar üretim",
          rationale: "LLM veya JSON ayrıştırma hatası; sahte strateji yazılmadı.",
          dataRangeLabel: "partial",
          dataSufficiency: "partial",
          confidenceLevel: 10,
        },
      ];
      overallConfidence = 10;
      summary =
        "AI strateji üretimi başarısız oldu; otomatik sahte öneri eklenmedi.";
    }
  }

  await supabase
    .from("marketing_strategies")
    .update({
      summary,
      overall_confidence: overallConfidence,
      data_sufficiency: hasData ? "partial" : "insufficient",
    })
    .eq("id", strategy.id);

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const itemType = (ITEM_TYPES as readonly string[]).includes(item.item_type)
      ? item.item_type
      : "other";

    await supabase.from("marketing_strategy_items").insert({
      strategy_id: strategy.id,
      item_type:
        itemType as Database["public"]["Tables"]["marketing_strategy_items"]["Insert"]["item_type"],
      recommendation: item.recommendation,
      suggested_budget: item.suggestedBudget,
      expected_goal: item.expectedGoal,
      rationale: item.rationale,
      data_range_label: item.dataRangeLabel,
      data_sufficiency: item.dataSufficiency,
      confidence_level: item.confidenceLevel,
      sort_order: i,
    });
  }

  await supabase.from("marketing_strategy_history").insert({
    strategy_id: strategy.id,
    event_type: "generated",
    title: "Strateji taslağı oluşturuldu",
    detail: summary,
    confidence_level: overallConfidence,
    rationale:
      "AI yalnızca öneri üretir; kampanya/bütçe değiştirilmez. Onay insanındır.",
    snapshot: {
      strategyId: strategy.id,
      itemCount: items.length,
      dailyBudgetTry: configuredBudget,
    } as Json,
    actor_id: params.createdBy,
  });

  return { ...strategy, summary, overall_confidence: overallConfidence };
}

export async function listStrategies(supabase: TypedSupabaseClient) {
  const { data: strategies, error } = await supabase
    .from("marketing_strategies")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;

  const result = [];
  for (const s of strategies ?? []) {
    const { data: items } = await supabase
      .from("marketing_strategy_items")
      .select("*")
      .eq("strategy_id", s.id)
      .order("sort_order");
    result.push({ ...s, marketing_strategy_items: items ?? [] });
  }
  return result;
}

export async function listStrategyHistory(
  supabase: TypedSupabaseClient,
  limit = 50
) {
  const { data, error } = await supabase
    .from("marketing_strategy_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
