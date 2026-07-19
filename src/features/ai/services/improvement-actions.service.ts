/**
 * En yüksek etkili 3 iyileştirme — rapor değil, aksiyon önerisi.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ReservationFunnelSnapshot } from "@/features/ai/services/reservation-funnel.service";
import type { WorstConversationRow } from "@/features/ai/services/conversation-quality.service";
import { getTodayIsoInIstanbul } from "@/features/ai/prompts/simple-assistant";

type TypedSupabase = SupabaseClient<Database>;

export type ImprovementAction = {
  rank: number;
  title: string;
  why: string;
  impact: string;
  how: string;
  href: string | null;
  metric: string;
};

export type HeatMapTrendPoint = {
  weekStart: string;
  reason: string;
  count: number;
};

export type HeatMapBundle = {
  current: { reason: string; label: string; count: number }[];
  weeklyTrend: HeatMapTrendPoint[];
};

export type HumanVsAiInsight = {
  winner: "ai" | "human" | "tie";
  humanAverage: number | null;
  aiAverage: number | null;
  explanation: string;
  examples: {
    title: string;
    whyBetter: string;
    snippet: string;
  }[];
};

const REASON_LABELS: Record<string, string> = {
  price: "Fiyat",
  trust: "Güven",
  too_long: "Çok uzun cevap",
  misunderstood: "Yanlış anlama",
  early_price: "Çok erken fiyat",
  late_price: "Geç fiyat",
  wrong_reply: "Yanlış cevap",
  wrong_nba: "Yanlış NBA",
  competitor: "Rakip",
  unknown: "Belirsiz",
  no_reply: "Cevapsız",
};

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getWeekStart(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!, 12));
  const day = date.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  return addDays(isoDate, -diff);
}

/**
 * Heat map + son 6 haftanın trendi (lost_sale + outcome tags).
 */
export async function getLostHeatMapWithTrend(
  supabase: TypedSupabase
): Promise<HeatMapBundle> {
  const today = getTodayIsoInIstanbul();
  const fromWeek = getWeekStart(addDays(today, -7 * 5));
  const from = `${fromWeek}T00:00:00Z`;

  const counts = new Map<string, number>();
  const weekly = new Map<string, Map<string, number>>();

  const { data: analyses } = await supabase
    .from("lost_sale_analyses")
    .select("primary_reason, created_at")
    .gte("created_at", from)
    .limit(500);

  for (const a of analyses ?? []) {
    const reason = a.primary_reason || "unknown";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
    const week = getWeekStart(a.created_at.slice(0, 10));
    if (!weekly.has(week)) weekly.set(week, new Map());
    const m = weekly.get(week)!;
    m.set(reason, (m.get(reason) ?? 0) + 1);
  }

  const { data: tags } = await supabase
    .from("conversation_outcome_tags")
    .select("lost_reason, customer_lost, updated_at")
    .eq("customer_lost", true)
    .gte("updated_at", from)
    .limit(500);

  for (const t of tags ?? []) {
    if (!t.lost_reason) continue;
    const reason = t.lost_reason;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
    const week = getWeekStart(t.updated_at.slice(0, 10));
    if (!weekly.has(week)) weekly.set(week, new Map());
    const m = weekly.get(week)!;
    m.set(reason, (m.get(reason) ?? 0) + 1);
  }

  // Quality loss_reason (Türkçe) → normalize
  const { data: qualities } = await supabase
    .from("conversation_quality_scores")
    .select("loss_reason, issues, scored_at")
    .not("loss_reason", "is", null)
    .gte("scored_at", from)
    .limit(500);

  for (const q of qualities ?? []) {
    const issues = q.issues ?? [];
    const reason =
      issues.find((i) =>
        [
          "price",
          "too_long",
          "no_reply",
          "trust",
          "competitor",
          "early_price",
        ].includes(i)
      ) ?? "unknown";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
    const week = getWeekStart(q.scored_at.slice(0, 10));
    if (!weekly.has(week)) weekly.set(week, new Map());
    const m = weekly.get(week)!;
    m.set(reason, (m.get(reason) ?? 0) + 1);
  }

  const current = [...counts.entries()]
    .map(([reason, count]) => ({
      reason,
      label: REASON_LABELS[reason] ?? reason,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const weeklyTrend: HeatMapTrendPoint[] = [];
  for (const [weekStart, reasonMap] of [...weekly.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    for (const [reason, count] of reasonMap) {
      weeklyTrend.push({ weekStart, reason, count });
    }
  }

  return { current, weeklyTrend };
}

/**
 * Funnel + heat + worst listeden en yüksek etkili 3 aksiyon.
 */
export function buildTopImprovements(input: {
  funnel: ReservationFunnelSnapshot;
  heat: HeatMapBundle;
  worst: WorstConversationRow[];
}): ImprovementAction[] {
  const candidates: Omit<ImprovementAction, "rank">[] = [];

  if (input.funnel.biggestDrop && input.funnel.biggestDrop.lost >= 3) {
    const d = input.funnel.biggestDrop;
    candidates.push({
      title: `${d.from} → ${d.to} sızıntısını kapat`,
      why: `Funnel'da en büyük düşüş: ${d.lost} konuşma (%${d.rate}).`,
      impact: `Conversion'ı doğrudan artırır (şu an %${input.funnel.conversionPct}).`,
      how:
        d.to === "Fiyat verildi"
          ? "İkinci fiyat talebinde katalog rakamını ver; dump yapma."
          : d.to === "Takip"
            ? "24–48 saat içinde tek soruluk takip mesajı gönder."
            : d.to === "Kapora"
              ? "Fiyat kabulünden sonra kapora adımını tek net CTA ile iste."
              : "Rezervasyon onay akışını sadeleştir; belirsiz bırakma.",
      href: "/dashboard/ai",
      metric: `${d.lost} kayıp adım`,
    });
  }

  const topHeat = input.heat.current[0];
  if (topHeat) {
    const howByReason: Record<string, string> = {
      price:
        "Önce 1 referans/örnek → empati → sonra katalog fiyat. İndirim uydurma.",
      too_long: "Max 3 satır, tek soru. Paket dump yasak.",
      no_reply: "Cevapsızlara 24s sonra yumuşak takip şablonu.",
      trust: "Fiyattan önce kısa örnek video / referans teklif et.",
      early_price: "İlk mesajda fiyat yok; ihtiyaç netleşince ver.",
      competitor: "Rakibe saldırmadan farkı 1 cümlede anlat.",
    };
    candidates.push({
      title: `Kayıp nedeni: ${topHeat.label}`,
      why: `Heat map'te en sık neden (${topHeat.count} vaka).`,
      impact: "En kötü 20'nin büyük kısmını tek hamlede yükseltir.",
      how: howByReason[topHeat.reason] ?? "En kötü 20'yi tek tek düzelt, pattern'i playbook'a yaz.",
      href: input.worst[0]
        ? `/dashboard/ai/corrections/${input.worst[0].conversationId}`
        : null,
      metric: `${topHeat.count} kayıp`,
    });
  }

  const noReply = input.worst.filter((w) =>
    /cevap vermedi/i.test(w.lossReason ?? w.primaryIssue ?? "")
  ).length;
  const tooLong = input.worst.filter(
    (w) =>
      w.factors.some((f) => /uzun/i.test(f.label)) ||
      /uzun/i.test(w.primaryIssue ?? "")
  ).length;
  const priceLost = input.worst.filter((w) =>
    /fiyat/i.test(w.lossReason ?? w.primaryIssue ?? "")
  ).length;

  if (noReply >= 3) {
    candidates.push({
      title: "Cevapsız konuşmalara takip şablonu",
      why: `En kötü listede ~${noReply} konuşma cevap alamamış.`,
      impact: "Takip adımını doldurur → kapora ihtimali artar.",
      how: "Önerilen alternatif cevabı kopyala, personel/AI follow-up olarak gönder.",
      href: input.worst.find((w) => /cevap/i.test(w.lossReason ?? ""))
        ? `/dashboard/ai/corrections/${input.worst.find((w) => /cevap/i.test(w.lossReason ?? ""))!.conversationId}`
        : null,
      metric: `${noReply} konuşma`,
    });
  }
  if (tooLong >= 3) {
    candidates.push({
      title: "Cevap uzunluğunu kısalt",
      why: `En kötü listede ~${tooLong} konuşmada uzun cevap cezası var.`,
      impact: "Reply rate ve rezervasyon oranını birlikte iyileştirir.",
      how: "Strategist: max 3 satır kuralını production'da zorunlu tut.",
      href: null,
      metric: `${tooLong} konuşma`,
    });
  }
  if (priceLost >= 3) {
    candidates.push({
      title: "Fiyat itirazı playbook'u",
      why: `En kötü listede ~${priceLost} fiyat kaybı.`,
      impact: "Funnel'da fiyat→kapora sızıntısını azaltır.",
      how: "Güven → örnek → katalog fiyat sırasını sabitle; indirim insan onayına.",
      href: null,
      metric: `${priceLost} konuşma`,
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      title: "En kötü 20'yi tek tek düzelt",
      why: "Yeterli heat/funnel sinyali yok; en düşük skorlardan başla.",
      impact: "Her düzeltme playbook + benchmark'a girer.",
      how: "İlk konuşmayı aç → alternatif cevabı uygula → sonucu etiketle.",
      href: input.worst[0]
        ? `/dashboard/ai/corrections/${input.worst[0].conversationId}`
        : "/dashboard/ai",
      metric: `${input.worst.length} vaka`,
    });
  }

  return candidates.slice(0, 3).map((c, i) => ({ ...c, rank: i + 1 }));
}

/**
 * Human vs AI — somut örneklerle açıklama.
 */
export async function getHumanVsAiInsights(
  supabase: TypedSupabase,
  averages: { humanAverage: number | null; aiAverage: number | null } | null
): Promise<HumanVsAiInsight> {
  const human = averages?.humanAverage ?? null;
  const ai = averages?.aiAverage ?? null;

  let winner: HumanVsAiInsight["winner"] = "tie";
  if (human != null && ai != null) {
    if (human > ai + 2) winner = "human";
    else if (ai > human + 2) winner = "ai";
  }

  // AI-ağırlıklı düşük skor vs staff-ağırlıklı yüksek skor örnekleri
  const { data: scores } = await supabase
    .from("conversation_quality_scores")
    .select("conversation_id, score, primary_issue, summary, loss_reason")
    .order("score", { ascending: true })
    .limit(40);

  const examples: HumanVsAiInsight["examples"] = [];

  if (scores && scores.length > 0) {
    const ids = scores.map((s) => s.conversation_id);
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, sender_type, content")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false });

    const aiHeavy = new Set<string>();
    const staffHeavy = new Set<string>();
    const count = new Map<string, { ai: number; staff: number }>();
    const lastOutbound = new Map<string, string>();

    for (const m of msgs ?? []) {
      const c = count.get(m.conversation_id) ?? { ai: 0, staff: 0 };
      if (m.sender_type === "ai") c.ai += 1;
      if (m.sender_type === "staff") c.staff += 1;
      count.set(m.conversation_id, c);
      if (
        (m.sender_type === "ai" || m.sender_type === "staff") &&
        !lastOutbound.has(m.conversation_id) &&
        m.content
      ) {
        lastOutbound.set(m.conversation_id, m.content.slice(0, 140));
      }
    }
    for (const [id, c] of count) {
      if (c.ai > c.staff) aiHeavy.add(id);
      else if (c.staff > c.ai) staffHeavy.add(id);
    }

    const weakAi = scores.find((s) => aiHeavy.has(s.conversation_id));
    const strongStaff = [...scores]
      .reverse()
      .find((s) => staffHeavy.has(s.conversation_id) && s.score >= 70);

    if (weakAi) {
      examples.push({
        title: "AI'nin zayıf kaldığı örnek",
        whyBetter:
          weakAi.loss_reason ??
          weakAi.primary_issue ??
          "AI konuşmayı rezervasyona taşıyamadı.",
        snippet: lastOutbound.get(weakAi.conversation_id) ?? weakAi.summary ?? "",
      });
    }
    if (strongStaff) {
      examples.push({
        title: "Personelin daha iyi olduğu örnek",
        whyBetter:
          "Personel kısa + net ilerletti; skor yüksek / rezervasyon sinyali güçlü.",
        snippet:
          lastOutbound.get(strongStaff.conversation_id) ??
          strongStaff.summary ??
          "",
      });
    }
  }

  let explanation: string;
  if (winner === "human") {
    explanation = `Personel ortalaması (${human}) AI'den (${ai}) yüksek. AI genelde uzun cevap / erken fiyat / takip eksikliğinde kaybediyor; personel örneklerini playbook'a taşıyın.`;
  } else if (winner === "ai") {
    explanation = `AI ortalaması (${ai}) personelden (${human}) yüksek. AI'nin güçlü olduğu kısa/net cevapları koruyun; personel müdahalesini onay gereken durumlara bırakın.`;
  } else {
    explanation =
      human == null && ai == null
        ? "Henüz yeterli Human vs AI skoru yok. En kötü 20'yi düzeltirken AI/personel farkını etiketleyin."
        : `Skorlar yakın (İnsan ${human ?? "—"} / AI ${ai ?? "—"}). Fark, tek tek konuşma örneklerinde; aşağıdaki vakaları inceleyin.`;
  }

  if (examples.length === 0) {
    examples.push({
      title: "Örnek henüz yok",
      whyBetter: "quality:score + gerçek DM sonrası örnekler dolacak.",
      snippet: "En kötü konuşmayı açıp alternatif cevabı uygulayın.",
    });
  }

  return {
    winner,
    humanAverage: human,
    aiAverage: ai,
    explanation,
    examples: examples.slice(0, 3),
  };
}
