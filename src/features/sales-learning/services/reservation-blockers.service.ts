/**
 * "Neden rezervasyon olmuyor?" — deterministik agregasyon.
 * Kaynak: conversation_analyses (loss_reason, drop_off_point, objections)
 * + sales_patterns (leave_reason). LLM uydurma yok.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;

export type ReservationBlockerItem = {
  id: string;
  label: string;
  count: number;
  source: "loss_reason" | "drop_off_point" | "objection" | "leave_reason";
};

export type ReservationBlockersReport = {
  periodDays: number;
  analyzedWithoutReservation: number;
  lostCount: number;
  openCount: number;
  topReasons: ReservationBlockerItem[];
  topDropOffs: ReservationBlockerItem[];
  topObjections: ReservationBlockerItem[];
  suggestions: string[];
  dataSufficiency: "sufficient" | "partial" | "insufficient";
  generatedAt: string;
};

function countLabels(
  labels: string[],
  source: ReservationBlockerItem["source"]
): ReservationBlockerItem[] {
  const map = new Map<string, number>();
  for (const raw of labels) {
    const key = raw.trim().replace(/\s+/g, " ");
    if (key.length < 2) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({
      id: `${source}:${label.slice(0, 40)}`,
      label,
      count,
      source,
    }))
    .sort((a, b) => b.count - a.count);
}

function parseObjections(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n|/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

function buildSuggestions(report: Omit<ReservationBlockersReport, "suggestions">): string[] {
  const out: string[] = [];
  const top = report.topReasons[0];
  const drop = report.topDropOffs[0];
  const obj = report.topObjections[0];

  if (top) {
    out.push(
      `En sık kayıp nedeni: “${top.label}” (${top.count}). Bu noktaya özel takip mesajı ve FAQ hazırlayın.`
    );
  }
  if (drop) {
    out.push(
      `Konuşmalar en çok “${drop.label}” aşamasında kopuyor. Bu adımdaki cevapları güçlendirin.`
    );
  }
  if (obj) {
    out.push(
      `Sık itiraz: “${obj.label}”. Paket farkı / değer vurgusu ve kapora netliği kontrol edin.`
    );
  }
  if (report.openCount >= 3) {
    out.push(
      `${report.openCount} açık konuşmada rezervasyon oluşmamış. Follow-up kuyruğunu ve Meta gönderim durumunu kontrol edin.`
    );
  }
  if (out.length === 0) {
    out.push(
      "Yeterli kayıp sinyali yok. Daha fazla konuşma analiz edildikçe nedenler burada toplanır."
    );
  }
  return out.slice(0, 5);
}

/**
 * Son N günde rezervasyona dönmeyen konuşmaların kayıp nedenlerini toplar.
 */
export async function collectReservationBlockers(
  supabase: TypedSupabaseClient,
  opts?: { days?: number }
): Promise<ReservationBlockersReport> {
  const days = opts?.days ?? 7;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString();
  const generatedAt = new Date().toISOString();

  const { data: analyses, error } = await supabase
    .from("conversation_analyses")
    .select(
      "sale_outcome,loss_reason,drop_off_point,objections,reservation_created,created_at"
    )
    .gte("created_at", sinceIso)
    .limit(500);
  if (error) throw error;

  const rows = (analyses ?? []).filter((a) => {
    if (a.reservation_created === true) return false;
    if (a.sale_outcome === "won") return false;
    return true;
  });

  const lostCount = rows.filter((a) => a.sale_outcome === "lost").length;
  const openCount = rows.filter(
    (a) => a.sale_outcome === "open" || a.sale_outcome == null
  ).length;

  const lossLabels = rows
    .map((a) => a.loss_reason)
    .filter((v): v is string => Boolean(v?.trim()));
  const dropLabels = rows
    .map((a) => a.drop_off_point)
    .filter((v): v is string => Boolean(v?.trim()));
  const objectionLabels = rows.flatMap((a) => parseObjections(a.objections));

  const { data: patterns } = await supabase
    .from("sales_patterns")
    .select("pattern_type,pattern_text,last_seen_at")
    .eq("pattern_type", "leave_reason")
    .gte("last_seen_at", sinceIso)
    .limit(200);

  const leaveLabels = (patterns ?? [])
    .map((p) => p.pattern_text)
    .filter((v): v is string => Boolean(v?.trim()));

  const topReasons = [
    ...countLabels(lossLabels, "loss_reason"),
    ...countLabels(leaveLabels, "leave_reason"),
  ]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topDropOffs = countLabels(dropLabels, "drop_off_point").slice(0, 6);
  const topObjections = countLabels(objectionLabels, "objection").slice(0, 6);

  const dataSufficiency: ReservationBlockersReport["dataSufficiency"] =
    rows.length >= 10
      ? "sufficient"
      : rows.length >= 3
        ? "partial"
        : "insufficient";

  const base = {
    periodDays: days,
    analyzedWithoutReservation: rows.length,
    lostCount,
    openCount,
    topReasons,
    topDropOffs,
    topObjections,
    dataSufficiency,
    generatedAt,
  };

  return {
    ...base,
    suggestions: buildSuggestions(base),
  };
}

/** Haftalık rapor markdown bölümü. */
export function formatReservationBlockersMarkdown(
  report: ReservationBlockersReport
): string {
  if (report.dataSufficiency === "insufficient") {
    return "## Kaçan rezervasyon nedenleri\nYeterli veri bulunamadı.";
  }
  const lines = [
    `## Kaçan rezervasyon nedenleri (son ${report.periodDays} gün)`,
    `Rezervasyonsuz analiz: ${report.analyzedWithoutReservation} (kayıp ${report.lostCount}, açık ${report.openCount}).`,
    "",
  ];
  if (report.topReasons.length > 0) {
    lines.push("### En sık nedenler");
    for (const r of report.topReasons.slice(0, 5)) {
      lines.push(`- ${r.label} (${r.count})`);
    }
    lines.push("");
  }
  if (report.topDropOffs.length > 0) {
    lines.push("### Kopuş noktaları");
    for (const r of report.topDropOffs.slice(0, 5)) {
      lines.push(`- ${r.label} (${r.count})`);
    }
    lines.push("");
  }
  if (report.suggestions.length > 0) {
    lines.push("### Öneri");
    for (const s of report.suggestions) {
      lines.push(`- ${s}`);
    }
  }
  return lines.join("\n");
}
