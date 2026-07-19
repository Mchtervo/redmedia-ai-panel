import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  listActiveMistakes,
  listBestConversations,
  listPersonalityTraits,
  listTopPatterns,
} from "@/features/sales-learning/repositories/sales-learning.repository";
import type {
  SalesLearningContext,
  SalesPatternRow,
  SalesPatternType,
} from "@/features/sales-learning/types";
import {
  AI_MISTAKE_TYPE_LABELS,
  PERSONALITY_TRAIT_TYPE_LABELS,
  SALES_PATTERN_TYPE_LABELS,
} from "@/features/sales-learning/types";
import { listActivePlaybooks } from "@/features/playbooks/repositories/playbooks.repository";
import { jsonToStringArray } from "@/features/playbooks/types";

type TypedSupabaseClient = SupabaseClient<Database>;

const PATTERNS_PER_TYPE = 3;
const BEST_CONVERSATION_LIMIT = 3;
const ACTIVE_MISTAKE_LIMIT = 10;
const PERSONALITY_LIMIT = 12;
const PLAYBOOK_LIMIT = 2;

/**
 * Gelen müşteri mesajına göre öncelikli kalıp türleri (AI Decision Rules:
 * "benzer geçmiş konuşmaları ara"). Basit niyet eşlemesi; tüm türler yine
 * yüklenir, öncelikli olanlar prompt'ta öne alınır.
 */
export function detectRelevantPatternTypes(
  customerMessage: string
): SalesPatternType[] {
  const text = customerMessage.toLocaleLowerCase("tr-TR");
  const relevant: SalesPatternType[] = [];

  if (/fiyat|kaç para|ne kadar|ücret|ucret|bütçe|butce|paket/.test(text)) {
    relevant.push("price_explanation", "objection_response");
  }
  if (/pahalı|pahali|indirim|pazarlık|pazarlik|düşün|dusun|bakacağız|bakacagiz/.test(text)) {
    relevant.push("objection_response", "trust_building");
  }
  if (/rezervasyon|tarih|ayır|ayir|kapora|anlaş|anlas|tamamdır|tamamdir/.test(text)) {
    relevant.push("closing", "trust_building");
  }
  if (/merhaba|selam|iyi günler|iyi gunler|bilgi al|nişan|nisan|düğün|dugun/.test(text)) {
    relevant.push("opening");
  }
  if (relevant.length === 0) {
    relevant.push("trust_building", "objection_response");
  }
  return [...new Set(relevant)];
}

/**
 * Cevap üretimi öncesi öğrenilmiş satış hafızasını yükler:
 * kalıplar + şirket kişiliği + aktif hatalar + best conversation library.
 */
export async function loadSalesLearningContext(
  supabase: TypedSupabaseClient
): Promise<SalesLearningContext> {
  const [patterns, personality, activeMistakes, bestConversations, playbooks] =
    await Promise.all([
      listTopPatterns(supabase, { limit: 40 }),
      listPersonalityTraits(supabase, PERSONALITY_LIMIT),
      listActiveMistakes(supabase, ACTIVE_MISTAKE_LIMIT),
      listBestConversations(supabase, BEST_CONVERSATION_LIMIT),
      listActivePlaybooks(supabase, PLAYBOOK_LIMIT),
    ]);

  return { patterns, personality, activeMistakes, bestConversations, playbooks };
}

function pickPatternsForPrompt(
  patterns: SalesPatternRow[],
  relevantTypes: SalesPatternType[]
): SalesPatternRow[] {
  const positiveTypes: SalesPatternType[] = [
    "opening",
    "price_explanation",
    "trust_building",
    "objection_response",
    "closing",
  ];

  const byType = new Map<SalesPatternType, SalesPatternRow[]>();
  for (const pattern of patterns) {
    const list = byType.get(pattern.pattern_type) ?? [];
    if (list.length < PATTERNS_PER_TYPE) {
      list.push(pattern);
      byType.set(pattern.pattern_type, list);
    }
  }

  // Önce mesaja uygun türler, sonra kalan pozitif türler.
  const ordered: SalesPatternRow[] = [];
  const pushed = new Set<string>();
  for (const type of [...relevantTypes, ...positiveTypes]) {
    for (const pattern of byType.get(type) ?? []) {
      if (!pushed.has(pattern.id)) {
        pushed.add(pattern.id);
        ordered.push(pattern);
      }
    }
  }
  return ordered.slice(0, 12);
}

function formatSuccess(pattern: SalesPatternRow): string {
  const parts: string[] = [];
  if (pattern.success_rate != null) {
    parts.push(`başarı %${Math.round(pattern.success_rate)}`);
  }
  parts.push(`${pattern.seen_count} konuşmada görüldü`);
  return parts.join(", ");
}

/** Eski 12/15k pitch — prompt'a sızmasın (seed zehri). */
function containsLegacyPackagePrice(text: string): boolean {
  return /(?<![.\d])(?:12|15)\.?000\b/.test(text);
}

/**
 * Öğrenilmiş satış hafızasını asistan prompt bloğuna çevirir.
 * Veri yoksa null döner; prompt'a boş bölüm eklenmez.
 */
export function buildSalesLearningPromptBlock(
  context: SalesLearningContext,
  customerMessage: string
): string | null {
  const sections: string[] = [];

  if (context.personality.length > 0) {
    const lines = context.personality
      .filter((trait) => !containsLegacyPackagePrice(trait.trait_text))
      .map(
        (trait) =>
          `- [${PERSONALITY_TRAIT_TYPE_LABELS[trait.trait_type]}] ${trait.trait_text} (${trait.evidence_count} konuşma kanıtı)`
      )
      .join("\n");
    if (lines) {
      sections.push(
        `### Redmedia iletişim kimliği (öğrenilmiş — bu tarza uy)\n${lines}`
      );
    }
  }

  const relevantTypes = detectRelevantPatternTypes(customerMessage);
  const patterns = pickPatternsForPrompt(context.patterns, relevantTypes).filter(
    (p) => !containsLegacyPackagePrice(p.pattern_text)
  );
  const positive = patterns.filter(
    (p) => p.pattern_type !== "failure" && p.pattern_type !== "leave_reason"
  );
  const negative = context.patterns
    .filter(
      (p) =>
        (p.pattern_type === "failure" || p.pattern_type === "leave_reason") &&
        !containsLegacyPackagePrice(p.pattern_text)
    )
    .slice(0, 5);

  if (positive.length > 0) {
    const lines = positive
      .map(
        (p) =>
          `- [${SALES_PATTERN_TYPE_LABELS[p.pattern_type]}] ${p.pattern_text} (${formatSuccess(p)})`
      )
      .join("\n");
    sections.push(
      `### Başarılı satış kalıpları (geçmiş DM'lerden — bu üslubu UYGULA; rakam katalogdan)\n${lines}`
    );
  }

  if (negative.length > 0) {
    const lines = negative
      .map(
        (p) =>
          `- [${SALES_PATTERN_TYPE_LABELS[p.pattern_type]}] ${p.pattern_text}`
      )
      .join("\n");
    sections.push(
      `### Kaybettiren yaklaşımlar / ayrılma sebepleri (bunlardan kaçın)\n${lines}`
    );
  }

  if (context.activeMistakes.length > 0) {
    const lines = context.activeMistakes
      .filter(
        (m) =>
          !containsLegacyPackagePrice(m.correct_approach) &&
          !containsLegacyPackagePrice(m.wrong_reply ?? "")
      )
      .map(
        (m) =>
          `- [${AI_MISTAKE_TYPE_LABELS[m.mistake_type]}] Durum: ${m.trigger_context} → Doğrusu: ${m.correct_approach}`
      )
      .join("\n");
    if (lines) {
      sections.push(
        `### Geçmişte yaptığın hatalar (ASLA TEKRARLAMA)\n${lines}`
      );
    }
  }

  const playbooks = context.playbooks ?? [];
  if (playbooks.length > 0) {
    const lines = playbooks
      .map((playbook) => {
        const steps = jsonToStringArray(playbook.steps)
          .map((step, index) => `${index + 1}) ${step}`)
          .join(" ");
        return `- ${playbook.title} — Ne zaman: ${playbook.trigger_context}\n  Adımlar: ${steps}`;
      })
      .join("\n");
    sections.push(
      `### Onaylı satış playbook'ları (kanıtlanmış akış; duruma uyarla)\n${lines}`
    );
  }

  if (context.bestConversations.length > 0) {
    const lines = context.bestConversations
      .map((best, index) => {
        const parts = [
          best.customerIntent ? `Müşteri isteği: ${best.customerIntent}` : null,
          best.firstCustomerQuestion
            ? `İlk soru: ${best.firstCustomerQuestion}`
            : null,
          best.advancingReply
            ? `Satışı ilerleten cevap: ${best.advancingReply}`
            : null,
        ].filter(Boolean);
        return `${index + 1}. ${parts.join(" · ")}`;
      })
      .join("\n");
    sections.push(
      `### En başarılı satış konuşmalarından örnekler (rezervasyonla sonuçlandı)\n${lines}`
    );
  }

  if (sections.length === 0) {
    return null;
  }

  return sections.join("\n\n");
}
