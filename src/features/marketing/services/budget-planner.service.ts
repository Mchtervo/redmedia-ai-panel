import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getDailyAdBudgetTry } from "@/features/settings/services/ai-feature-flags.service";

type TypedSupabaseClient = SupabaseClient<Database>;

export type DailyBudgetPlan = {
  dailyBudgetTry: number | null;
  recommendedCreatives: number;
  recommendedStrategies: number;
  coldPct: number;
  warmPct: number;
  hotPct: number;
  coldBudget: number;
  warmBudget: number;
  hotBudget: number;
  rationale: string;
  dataSufficiency: "insufficient" | "partial" | "sufficient";
};

/**
 * Günlük bütçeye göre kaç kreatif / kaç strateji testi önerisi.
 * Meta'da hiçbir şeyi değiştirmez — yalnızca plan önerisi.
 */
export async function buildDailyBudgetPlan(
  supabase: TypedSupabaseClient
): Promise<DailyBudgetPlan> {
  const configured = await getDailyAdBudgetTry(supabase);
  const { count: metricCount } = await supabase
    .from("ad_daily_metrics")
    .select("id", { count: "exact", head: true });

  const hasMetrics = (metricCount ?? 0) > 0;
  const budget = configured && configured > 0 ? configured : null;

  if (!budget) {
    return {
      dailyBudgetTry: null,
      recommendedCreatives: 0,
      recommendedStrategies: 0,
      coldPct: 50,
      warmPct: 30,
      hotPct: 20,
      coldBudget: 0,
      warmBudget: 0,
      hotBudget: 0,
      rationale:
        "Günlük bütçe tanımlı değil. Ayarlar → Günlük reklam bütçesi girin; AI buna göre öneri üretir.",
      dataSufficiency: "insufficient",
    };
  }

  // Basit uzman kuralı: bütçe arttıkça paralel test sayısı artar (üst sınırlı).
  let recommendedCreatives = 2;
  let recommendedStrategies = 1;
  if (budget >= 1000) {
    recommendedCreatives = 3;
    recommendedStrategies = 2;
  }
  if (budget >= 2500) {
    recommendedCreatives = 4;
    recommendedStrategies = 2;
  }
  if (budget >= 5000) {
    recommendedCreatives = 5;
    recommendedStrategies = 3;
  }

  const coldPct = 50;
  const warmPct = 30;
  const hotPct = 20;

  return {
    dailyBudgetTry: budget,
    recommendedCreatives,
    recommendedStrategies,
    coldPct,
    warmPct,
    hotPct,
    coldBudget: Math.round((budget * coldPct) / 100),
    warmBudget: Math.round((budget * warmPct) / 100),
    hotBudget: Math.round((budget * hotPct) / 100),
    rationale: hasMetrics
      ? `Günlük ${budget} TRY için öneri: ${recommendedCreatives} kreatif, ${recommendedStrategies} strateji testi. Bölüşüm soğuk %${coldPct} / ılık %${warmPct} / sıcak %${hotPct}. Meta'da otomatik uygulanmaz — onay sizin.`
      : `Bütçe alındı ancak reklam metriği henüz yetersiz. Yine de başlangıç dağılımı: soğuk %${coldPct} / ılık %${warmPct} / sıcak %${hotPct}. Önce Meta senkronunu çalıştırın.`,
    dataSufficiency: hasMetrics ? "partial" : "insufficient",
  };
}
